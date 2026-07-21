"""GT-free temporal stability metrics for segmentation masks / alpha mattes.

v2 — hardened after adversarial review (metric_attack/):
  * dual-compensator warping: Farneback dense flow AND global phase-
    correlation shift on the alpha channel; per pair the compensator that
    better explains the change wins. Fixes the flat-shaded-art failure
    (Farneback has no gradients inside uniform regions; a stable flat
    object at 25 px/frame scored 0.13-0.20 warp_error with flow alone).
  * fractional alpha interface: sequences are float32 alpha in [0,1]
    (bool/uint8 accepted and normalized). dtssd_flow now actually sees
    feather flicker; binary ops threshold at 0.5 internally.
  * t_deform: multi-contour (point budget split by perimeter share),
    tangent-relative shape-context angles (Belongie et al. sec 3.2),
    sub-pixel marching-squares contours with arc-length resampling, and
    a 10%-trimmed matched-cost mean. Rigid rotation is suppressed from
    ~3x jitter to a bounded second-order residual (~0.0015 per deg/frame
    from grid-anchored sampling offsets); it is NOT exactly zero —
    rotation-heavy content should lean on warp_error as primary.
  * topo churn: overlap-matched births/deaths instead of count diffs ->
    a component oscillating around min_area at a fixed spot no longer
    churns. Merge/split restructuring is a documented blind spot.

Literature grounding:
  warp_error — flow-compensated mask disagreement (warp-error/TC family;
    Lai et al., ECCV 2018). dtssd_flow — GT-free adaptation of dtSSD
    (Erofeev et al., BMVC 2015). t_deform — DAVIS-T-inspired boundary
    deformation cost (Perazzi et al., CVPR 2016).

Application protocol: score raw-motion frames only; exclude intentional
cross-fade (ease) windows — a legitimate morph is not instability.
"""
from __future__ import annotations

import cv2
import numpy as np
from scipy import ndimage
from scipy.optimize import linear_sum_assignment


def _as_alpha(m: np.ndarray) -> np.ndarray:
    """Accept bool / uint8 [0..255] / float [0..1]; return float32 [0..1]."""
    if m.dtype == np.bool_:
        return m.astype(np.float32)
    a = m.astype(np.float32)
    return a / 255.0 if a.max() > 1.5 else a


# ---------------------------------------------------------------- warping

def _flow(gray_a: np.ndarray, gray_b: np.ndarray) -> np.ndarray:
    return cv2.calcOpticalFlowFarneback(
        gray_a, gray_b, None,
        pyr_scale=0.5, levels=4, winsize=21, iterations=3,
        poly_n=7, poly_sigma=1.5, flags=0)


def _warp_by_maps(alpha_a, map_x, map_y):
    h, w = alpha_a.shape
    warped = cv2.remap(alpha_a, map_x, map_y, interpolation=cv2.INTER_LINEAR,
                       borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    valid = (map_x >= 0) & (map_x <= w - 1) & (map_y >= 0) & (map_y <= h - 1)
    return warped, valid


def _err(warped_a, alpha_b, valid):
    wa = (warped_a > 0.5)
    mb = (alpha_b > 0.5)
    inter = (wa & mb & valid).sum()
    union = ((wa | mb) & valid).sum()
    warp_err = 0.0 if union == 0 else 1.0 - inter / union
    d = (alpha_b - warped_a)[valid]
    dtssd = float(np.sqrt((d * d).mean())) if d.size else 0.0
    return float(warp_err), dtssd


def warp_pair(alpha_a: np.ndarray, alpha_b: np.ndarray,
              rgb_a: np.ndarray, rgb_b: np.ndarray) -> tuple[float, float]:
    """(warp_error, dtssd_flow) for one adjacent pair, dual-compensator.

    Backward warp under two motion models — dense Farneback flow on the
    RGB, and a single global shift from phase correlation on the alpha —
    and keep the model that better explains the pair. Instability is only
    what NEITHER a smooth flow field NOR a rigid translation can explain.
    """
    alpha_a = _as_alpha(alpha_a)
    alpha_b = _as_alpha(alpha_b)
    h, w = alpha_a.shape
    xs, ys = np.meshgrid(np.arange(w, dtype=np.float32),
                         np.arange(h, dtype=np.float32))

    if alpha_a.max() == 0 and alpha_b.max() == 0:
        return 0.0, 0.0

    # compensator 1: dense flow (backward: b <- a)
    ga = cv2.cvtColor(rgb_a, cv2.COLOR_RGB2GRAY)
    gb = cv2.cvtColor(rgb_b, cv2.COLOR_RGB2GRAY)
    flow_ba = _flow(gb, ga)
    w1, v1 = _warp_by_maps(alpha_a, xs + flow_ba[:, :, 0], ys + flow_ba[:, :, 1])
    e1 = _err(w1, alpha_b, v1)

    # compensator 2: global shift via phase correlation on alpha
    win = cv2.createHanningWindow((w, h), cv2.CV_32F)
    (dx, dy), _resp = cv2.phaseCorrelate(alpha_a * win, alpha_b * win)
    w2, v2 = _warp_by_maps(alpha_a, xs - np.float32(dx), ys - np.float32(dy))
    e2 = _err(w2, alpha_b, v2)

    return e1 if e1[0] <= e2[0] else e2


# ------------------------------------------------------- DAVIS-T lite v2

def _contours_with_tangents(mask: np.ndarray, n_total: int = 100,
                            min_area: int = 100):
    """Sample points + tangent angles across ALL external contours with
    area >= min_area, budget split by perimeter share.

    Sub-pixel marching-squares contours + uniform arc-length resampling:
    pixel-grid aliasing on a rigidly rotating shape must not read as
    deformation, and chain-code point density (diagonals sqrt(2) longer)
    must not bias sampling. Holes are filled first (RETR_EXTERNAL
    semantics — hole dynamics belong to topo_pair)."""
    from skimage.measure import find_contours
    filled = ndimage.binary_fill_holes(mask)
    raw = find_contours(filled.astype(np.float32), 0.5)
    cnts = []
    for c in raw:
        xy = np.stack([c[:, 1], c[:, 0]], axis=1).astype(np.float64)  # (x, y)
        if len(xy) < 8:
            continue
        x, y = xy[:, 0], xy[:, 1]
        area = 0.5 * abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))
        if area >= min_area:
            cnts.append(xy)
    if not cnts:
        return None, None
    seglens = [np.linalg.norm(np.diff(np.vstack([c, c[:1]]), axis=0), axis=1) for c in cnts]
    perims = np.array([s.sum() for s in seglens])
    budgets = np.maximum(8, np.round(n_total * perims / perims.sum())).astype(int)
    pts_all, tan_all = [], []
    for c, sl, k in zip(cnts, seglens, budgets):
        cum = np.concatenate([[0.0], np.cumsum(sl)])
        total = cum[-1]
        closed = np.vstack([c, c[:1]])
        targets = np.linspace(0, total, k, endpoint=False)
        px = np.interp(targets, cum, closed[:, 0])
        py = np.interp(targets, cum, closed[:, 1])
        pts = np.stack([px, py], axis=1)
        nxt = np.roll(pts, -1, axis=0)
        prv = np.roll(pts, 1, axis=0)
        tan = np.arctan2(nxt[:, 1] - prv[:, 1], nxt[:, 0] - prv[:, 0])
        pts_all.append(pts.astype(np.float32))
        tan_all.append(tan.astype(np.float32))
    return np.concatenate(pts_all), np.concatenate(tan_all)


def _shape_context(pts: np.ndarray, tangents: np.ndarray,
                   nbins_r: int = 5, nbins_t: int = 12,
                   r_inner: float = 0.125, r_outer: float = 2.0) -> np.ndarray:
    """Shape-context histograms, radii normalized by mean pairwise
    distance (translation+scale invariant), angles measured RELATIVE TO
    THE LOCAL TANGENT (rotation invariant; Belongie et al. sec 3.2)."""
    n = len(pts)
    d = np.linalg.norm(pts[:, None, :] - pts[None, :, :], axis=-1)
    mean_d = d.sum() / max(n * (n - 1), 1)
    dn = d / max(mean_d, 1e-9)
    r_edges = np.logspace(np.log10(r_inner), np.log10(r_outer), nbins_r)
    r_bin = np.digitize(dn, r_edges)
    ang = np.arctan2(pts[None, :, 1] - pts[:, None, 1],
                     pts[None, :, 0] - pts[:, None, 0])
    rel = ang - tangents[:, None]
    t_bin = np.floor(((rel + 3 * np.pi) % (2 * np.pi)) / (2 * np.pi / nbins_t)).astype(int) % nbins_t
    hists = np.zeros((n, nbins_r * nbins_t), dtype=np.float32)
    for i in range(n):
        sel = np.ones(n, dtype=bool)
        sel[i] = False
        rb, tb = r_bin[i][sel], t_bin[i][sel]
        inside = rb < nbins_r
        np.add.at(hists[i], rb[inside] * nbins_t + tb[inside], 1.0)
        s = hists[i].sum()
        if s > 0:
            hists[i] /= s
    return hists


def t_deform_pair(mask_a: np.ndarray, mask_b: np.ndarray, n: int = 100) -> float | None:
    """Mean chi^2 cost of Hungarian matching between consecutive frames'
    shape-context sets (all components, tangent-aligned). None when either
    frame has no usable contour. Documented blind spot: interior holes
    (RETR_EXTERNAL) — hole dynamics belong to topo_pair."""
    ma = _as_alpha(mask_a) > 0.5
    mb = _as_alpha(mask_b) > 0.5
    pa, ta = _contours_with_tangents(ma, n)
    pb, tb = _contours_with_tangents(mb, n)
    if pa is None or pb is None:
        return None
    ha, hb = _shape_context(pa, ta), _shape_context(pb, tb)
    num = (ha[:, None, :] - hb[None, :, :]) ** 2
    den = ha[:, None, :] + hb[None, :, :] + 1e-9
    cost = 0.5 * (num / den).sum(-1)
    ri, ci = linear_sum_assignment(cost)
    matched = np.sort(cost[ri, ci])
    # trimmed mean: corner-adjacent samples of a rigidly moving shape
    # produce a few outlier costs (arc-length sampling lands differently
    # on corners each frame); genuine deformation is distributed. Trim
    # the top 10% so rotation doesn't read as deformation while
    # localized morphs (>=10-25% of points) still register.
    k = max(1, int(len(matched) * 0.9))
    return float(matched[:k].mean())


# ------------------------------------------------------ topology churn v2

def _labeled_big(m: np.ndarray, min_area: int):
    lab, n = ndimage.label(m)
    keep = []
    if n:
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        keep = [i + 1 for i, s in enumerate(sizes) if s >= min_area]
    return lab, keep


def topo_pair(mask_a: np.ndarray, mask_b: np.ndarray, min_area: int = 30) -> int:
    """Overlap-matched births+deaths of components and enclosed holes.

    A component >= min_area counts as born/dead only if it overlaps
    NOTHING of the other frame's same-class mask — so a stable blob
    oscillating around the size threshold does not churn. Merge/split
    with preserved overlap is a documented blind spot."""
    ma = _as_alpha(mask_a) > 0.5
    mb = _as_alpha(mask_b) > 0.5

    def churn(a, b):
        c = 0
        for src, other in ((a, b), (b, a)):
            lab, keep = _labeled_big(src, min_area)
            for i in keep:
                if not (other & (lab == i)).any():
                    c += 1
        return c

    holes_a = ndimage.binary_fill_holes(ma) & ~ma
    holes_b = ndimage.binary_fill_holes(mb) & ~mb
    return churn(ma, mb) + churn(holes_a, holes_b)


# ------------------------------------------------------------ sequence

def sequence_metrics(alphas: list[np.ndarray], rgbs: list[np.ndarray]) -> dict:
    """All metrics over a sequence. alphas: HxW bool/uint8/float;
    rgbs: uint8 HxWx3. Caller excludes intentional cross-fade windows."""
    we, dt, td, tp = [], [], [], []
    for a, b, ra, rb in zip(alphas, alphas[1:], rgbs, rgbs[1:]):
        w, d = warp_pair(a, b, ra, rb)
        we.append(w)
        dt.append(d)
        t = t_deform_pair(a, b)
        if t is not None:
            td.append(t)
        tp.append(topo_pair(a, b))
    def agg(xs):
        return {'mean': float(np.mean(xs)), 'p95': float(np.percentile(xs, 95))} if xs else {'mean': 0.0, 'p95': 0.0}
    return {'warp_error': agg(we), 'dtssd_flow': agg(dt),
            't_deform': agg(td), 'topo_flicker': agg(tp),
            'pairs': len(we)}
