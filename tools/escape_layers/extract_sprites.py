"""Extract rotoscoped sprite sheets from escape-room animation clips.

Takes a video clip (24fps, 1280x720), a before-scene PNG, and an after-scene
PNG, and produces:
  1. A lossless WebP sprite sheet (48 frames at 12fps, 7 columns)
  2. A patch PNG (the before-scene crop at the animation bbox)

The pipeline:
  - Extract all 96 frames via ffmpeg
  - Stabilize each frame against the before-scene reference
  - Build a scene-change mask (before vs after, largest CC, dilated)
  - Per-frame binary-alpha change masks (L1 > 90, within scene mask)
  - Morphological cleanup + core-region connected-component filter
  - 1px Gaussian feather at alpha edges
  - Minimum connected-component area filter (kills ghost streaks)
  - Subsample 96→48 (every 2nd frame)
  - Smoothstep tail ease: last N frames blend toward after-state overlay
    (default 4: raw motion plays through, cross-fade exposure ~0.3s at the
    settle — a 22-frame ease reads as a lingering mid-animation double image)
  - Pack into sprite sheet, save as lossless WebP + patch PNG

Usage:
  python3 tools/escape_layers/extract_sprites.py \\
    --clip public/escape-video/toyroom_chest.mp4 \\
    --before assets/game/escape/toyroom_pillow_taken.png \\
    --after assets/game/escape/toyroom_chest_reveal.png \\
    --bbox 288,115,356,330 \\
    --out-dir public/escape-sprites \\
    --name toyroom_chest

Or use extract_all() programmatically for batch processing.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

sys.path.insert(0, '/home/ivanmkc/persistence-of-dreams')
from tools.stabilize import stabilize_frame  # type: ignore[import-untyped]

ROOT = Path(__file__).resolve().parent.parent.parent

# Held-frame drift fade window (fractional after-alpha): drift below LO is
# transparent, above HI fully opaque, smoothstep between. E4 sweeps HI.
AFTER_FADE_LO = 25.0
AFTER_FADE_HI = 90.0


def compute_scene_bbox(
    before: np.ndarray,
    after: np.ndarray,
    pad: int = 20,
    dilation: int = 10,
) -> dict[str, int]:
    """Derive the animation bounding box from before/after scene delta."""
    delta = np.abs(before.astype(np.int16) - after.astype(np.int16)).sum(axis=-1)
    mask = delta > 25
    mask = ndimage.binary_closing(mask, iterations=3)
    mask = ndimage.binary_opening(mask, iterations=2)

    labels, num = ndimage.label(mask)
    if num > 0:
        sizes = ndimage.sum(mask, labels, range(1, num + 1))
        mask = labels == (int(np.argmax(sizes)) + 1)

    mask = ndimage.binary_dilation(mask, iterations=dilation)

    if mask.any():
        ys, xs = np.where(mask)
        y1 = max(0, int(ys.min()) - pad)
        y2 = min(before.shape[0], int(ys.max()) + pad)
        x1 = max(0, int(xs.min()) - pad)
        x2 = min(before.shape[1], int(xs.max()) + pad)
        return {"x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1}

    return {"x": 0, "y": 0, "w": before.shape[1], "h": before.shape[0]}


def normalize_to_reference(
    frame: np.ndarray,
    ref: np.ndarray,
    agree_thresh: int = 20,
    gain_clip: tuple[float, float] = (0.85, 1.18),
) -> np.ndarray:
    """Correct global Veo tonal drift: per-channel gain matched on pixels
    where frame and reference already roughly agree (background)."""
    diff = np.abs(frame.astype(np.int16) - ref.astype(np.int16)).mean(axis=-1)
    agree = diff < agree_thresh
    if agree.sum() < 5000:
        return frame
    out = frame.astype(np.float32)
    for ch in range(3):
        f_med = float(np.median(frame[:, :, ch][agree]))
        r_med = float(np.median(ref[:, :, ch][agree]))
        if f_med < 1:
            continue
        gain = np.clip(r_med / f_med, *gain_clip)
        out[:, :, ch] *= gain
    return np.clip(out, 0, 255).astype(np.uint8)


def compute_content_bbox(
    frames_dir: Path,
    before_img: np.ndarray,
    after_img: np.ndarray,
    old_bbox: dict[str, int],
    frame_count: int,
    rest_mask_scene: np.ndarray | None = None,
    sibling_exclude: np.ndarray | None = None,
    sibling_silhouettes: np.ndarray | None = None,
    change_thresh: int = 90,
    after_thresh: int = 60,
    min_cc_area: int = 250,
    pad: int = 8,
    stabilize_thresh: int = 15,
) -> dict[str, int]:
    """True content-derived bbox measured on FULL-SCENE frames before any
    crop: union of per-frame change extents (components intersecting the
    seed region) + after-vs-before extents + rest silhouette + pad.

    The seed is the old bbox plus the strong after-diff near it, so motion
    that crosses the old bbox edge (a puppy walking out, a lid opening
    upward) widens the bbox instead of being sliced. Sibling territory and
    weak broad after-diff (chain-state regeneration drift) cannot seed —
    that is what blew the toolbox bbox to 1073x634 on the first attempt."""
    h_full, w_full = before_img.shape[:2]
    seed = np.zeros((h_full, w_full), dtype=bool)
    y0, x0 = old_bbox["y"], old_bbox["x"]
    seed[y0:y0 + old_bbox["h"], x0:x0 + old_bbox["w"]] = True
    if sibling_exclude is not None:
        sib = sibling_exclude & ~seed
    else:
        sib = np.zeros((h_full, w_full), dtype=bool)

    after_d = np.abs(after_img.astype(np.int16) - before_img.astype(np.int16)).sum(-1) > after_thresh
    after_d = ndimage.binary_opening(after_d, iterations=3)
    after_d &= ~sib
    labels, num = ndimage.label(after_d)
    after_keep = np.zeros_like(after_d)
    for lbl in range(1, num + 1):
        comp = labels == lbl
        if comp.sum() >= min_cc_area and (comp & seed).any():
            after_keep |= comp
    seed |= after_keep

    union = seed.copy()
    if rest_mask_scene is not None:
        union |= rest_mask_scene

    # late frames belong to the tail-ease zone at runtime and Veo clip
    # endings can diverge wholesale from the before scene — measure
    # motion extents on the pre-tail frames only (the after-state's own
    # extents are already in the seed)
    for i in range(0, min(frame_count, 80), 2):
        path = frames_dir / f"f_{i + 1:04d}.png"
        if not path.exists():
            continue
        frame = np.array(Image.open(path).convert("RGB").resize((w_full, h_full), Image.LANCZOS))
        stabilized, _, _ = stabilize_frame(
            before_img, frame,
            threshold=stabilize_thresh, min_area=50,
            correct_shift=True, feather_px=1,
        )
        stabilized = normalize_to_reference(stabilized, before_img)
        delta = np.abs(stabilized.astype(np.int16) - before_img.astype(np.int16)).sum(-1)
        d = delta > change_thresh
        d = ndimage.binary_opening(d, iterations=2)
        # moving action content may cross sibling draw rects; only baked
        # sibling objects (their silhouettes) are off-limits per frame
        d &= ~(sibling_silhouettes if sibling_silhouettes is not None else sib)
        labels, num = ndimage.label(d)
        for lbl in range(1, num + 1):
            comp = labels == lbl
            if comp.sum() < min_cc_area or not (comp & seed).any():
                continue
            # growing past the old bbox needs strong evidence — residual
            # drift components are mild, real motion content is not
            if float(delta[comp].mean()) < 140:
                comp = comp & seed
            union |= comp

    ys, xs = np.where(union)
    x1 = max(0, int(xs.min()) - pad)
    y1 = max(0, int(ys.min()) - pad)
    x2 = min(w_full, int(xs.max()) + 1 + pad)
    y2 = min(h_full, int(ys.max()) + 1 + pad)
    return {"x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1}


def extract_frames(clip: Path, out_dir: Path, width: int = 1280, height: int = 720) -> int:
    """Extract all frames from a clip at the target resolution."""
    out_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-i", str(clip),
            "-vf", f"scale={width}:{height}",
            str(out_dir / "f_%04d.png"),
        ],
        check=True,
        timeout=60,
    )
    return len(list(out_dir.glob("f_*.png")))


def build_scene_mask(
    before: np.ndarray,
    after: np.ndarray,
    bbox: dict[str, int],
    pad: int = 15,
    keep_all_min: int | None = None,
) -> np.ndarray:
    """Build a boolean mask of the region where before and after scenes differ,
    constrained to the bbox neighborhood."""
    h_full, w_full = before.shape[:2]
    delta = np.abs(before.astype(np.int16) - after.astype(np.int16)).sum(axis=-1)
    mask = delta > 25

    constraint = np.zeros((h_full, w_full), dtype=bool)
    y1 = max(0, bbox["y"] - pad)
    y2 = min(h_full, bbox["y"] + bbox["h"] + pad)
    x1 = max(0, bbox["x"] - pad)
    x2 = min(w_full, bbox["x"] + bbox["w"] + pad)
    constraint[y1:y2, x1:x2] = True
    mask = mask & constraint

    mask = ndimage.binary_closing(mask, iterations=3)
    mask = ndimage.binary_opening(mask, iterations=2)

    labels, num = ndimage.label(mask)
    if num > 0:
        if keep_all_min is not None:
            sizes = ndimage.sum(mask, labels, range(1, num + 1))
            keep = np.zeros_like(mask)
            for lbl in range(1, num + 1):
                if sizes[lbl - 1] >= keep_all_min:
                    keep |= labels == lbl
            mask = keep
        else:
            sizes = ndimage.sum(mask, labels, range(1, num + 1))
            mask = labels == (int(np.argmax(sizes)) + 1)

    mask = ndimage.binary_dilation(mask, iterations=5)
    return mask & constraint


def extract_sprite_sheet(
    clip: Path,
    before_path: Path,
    after_path: Path,
    bbox: dict[str, int],
    out_dir: Path,
    name: str,
    work_dir: Path | None = None,
    cols: int = 7,
    target_fps: int = 12,
    source_fps: int = 24,
    change_thresh: int = 90,
    stabilize_thresh: int = 15,
    min_cc_area: int = 200,
    ease_frames: int = 4,
    normalize: bool = False,
    keep_all_components: bool = False,
    core_filter: bool = True,
    object_mask_scene: np.ndarray | None = None,
    plate_img: np.ndarray | None = None,
    external_alpha_dir: Path | None = None,
) -> dict:
    """Full pipeline: extract, stabilize, matte, pack.

    external_alpha_dir: per-frame object masks (mask_%04d.png, 255=object,
    frame resolution, 0-based to match f_%04d.png 1-based frames) replace
    the plate-difference keying as the alpha source — the SAM3.1 video
    matte path (Exp C). Everything else (stabilization, normalization,
    after-state overlay, tail ease, packing) is unchanged so matte source
    is the only variable.

    Returns a dict with sprite metadata suitable for manifest.json.
    """
    if work_dir is None:
        work_dir = Path("/home/ivanmkc/.claude/jobs/c60063e9/tmp/phase2") / name
    work_dir.mkdir(parents=True, exist_ok=True)
    frames_dir = work_dir / "frames"

    before_img = np.array(
        Image.open(before_path).convert("RGB").resize((1280, 720), Image.LANCZOS)
    )
    after_img = np.array(
        Image.open(after_path).convert("RGB").resize((1280, 720), Image.LANCZOS)
    )

    existing = list(frames_dir.glob("f_*.png")) if frames_dir.exists() else []
    if len(existing) >= 90:
        frame_count = len(existing)
        print(f"[{name}] Reusing {frame_count} existing frames")
    else:
        print(f"[{name}] Extracting frames from {clip.name}...")
        frame_count = extract_frames(clip, frames_dir)
        print(f"[{name}] {frame_count} frames extracted")

    print(f"[{name}] Building scene mask...")
    scene_mask = build_scene_mask(
        before_img, after_img, bbox,
        keep_all_min=150 if keep_all_components else None,
    )

    core_y1 = bbox["y"] + bbox["h"] * 0.25
    core_y2 = bbox["y"] + bbox["h"] * 0.75
    core_x1 = bbox["x"] + bbox["w"] * 0.2
    core_x2 = bbox["x"] + bbox["w"] * 0.8

    print(f"[{name}] Processing {frame_count} frames...")
    overlays: list[np.ndarray] = []
    coverages: list[float] = []
    plate_close_frames: list[np.ndarray] = []

    for i in range(frame_count):
        path = frames_dir / f"f_{i + 1:04d}.png"
        frame = np.array(Image.open(path).convert("RGB").resize((1280, 720), Image.LANCZOS))
        stabilized, _, _ = stabilize_frame(
            before_img, frame,
            threshold=stabilize_thresh, min_area=50,
            correct_shift=True, feather_px=1,
        )
        if normalize:
            stabilized = normalize_to_reference(stabilized, before_img)

        if external_alpha_dir is not None:
            mp = external_alpha_dir / f"mask_{i:04d}.png"
            ext = np.array(Image.open(mp).convert("L")) if mp.exists() else np.zeros((720, 1280), np.uint8)
            if ext.shape != (720, 1280):
                ext = np.array(Image.fromarray(ext).resize((1280, 720), Image.NEAREST))
            change_mask = ext > 127
            if plate_img is not None:
                plate_close_frames.append(
                    np.abs(stabilized.astype(np.int16) - plate_img.astype(np.int16)).sum(axis=-1) < 60)
        elif plate_img is not None:
            # Key against the objectless plate: static object bodies key
            # strongly every frame (diff-vs-before only sees motion, and
            # with drift normalized away the body would vanish). Territory
            # = change region + own silhouette + motion components that
            # touch them, so re-render drift elsewhere stays out.
            diff_plate = np.abs(stabilized.astype(np.int16) - plate_img.astype(np.int16)).sum(axis=-1)
            strong = ndimage.binary_opening(diff_plate > change_thresh, iterations=2)
            mask_plate = ndimage.binary_propagation(strong, mask=diff_plate > 30)

            motion_l1 = np.abs(stabilized.astype(np.int16) - before_img.astype(np.int16)).sum(axis=-1)
            motion = ndimage.binary_opening(motion_l1 > change_thresh, iterations=2)

            t_base = scene_mask.copy()
            if object_mask_scene is not None:
                t_base |= ndimage.binary_dilation(object_mask_scene, iterations=3)
            m_labels, m_num = ndimage.label(motion)
            territory = t_base.copy()
            for lbl in range(1, m_num + 1):
                comp = m_labels == lbl
                if comp.sum() >= min_cc_area and (comp & t_base).any():
                    territory |= comp

            change_mask = mask_plate & territory
        else:
            diff = np.abs(stabilized.astype(np.int16) - before_img.astype(np.int16))
            diff_l1 = diff.sum(axis=-1)
            change_mask = (diff_l1 > change_thresh) & scene_mask

        # morphology + component filters de-noise the diff-key; SAM masks
        # are clean instance masks and thin structures must survive
        if external_alpha_dir is None:
            change_mask = ndimage.binary_opening(change_mask, iterations=2)
            change_mask = ndimage.binary_closing(change_mask, iterations=2)

        labeled, n = ndimage.label(change_mask)
        if external_alpha_dir is not None:
            n = 0
        if n > 0:
            core_labels = set(
                labeled[int(core_y1):int(core_y2), int(core_x1):int(core_x2)].flatten()
            ) - {0}
            sizes = ndimage.sum(change_mask, labeled, range(1, n + 1))
            for lbl in range(1, n + 1):
                if (core_filter and lbl not in core_labels) or sizes[lbl - 1] < min_cc_area:
                    change_mask[labeled == lbl] = False

        overlay = np.zeros((720, 1280, 4), dtype=np.uint8)
        overlay[:, :, :3] = stabilized
        overlay[:, :, 3] = np.where(change_mask, 255, 0).astype(np.uint8)

        alpha_pil = Image.fromarray(overlay[:, :, 3])
        alpha_feathered = np.array(alpha_pil.filter(ImageFilter.GaussianBlur(radius=1)))
        overlay[:, :, 3] = np.maximum(overlay[:, :, 3], alpha_feathered)
        if plate_img is None:
            overlay[:, :, 3][~scene_mask] = 0

        crop = overlay[
            bbox["y"]:bbox["y"] + bbox["h"],
            bbox["x"]:bbox["x"] + bbox["w"],
        ]
        coverage = float(np.sum(crop[:, :, 3] > 0)) / (bbox["w"] * bbox["h"]) * 100
        coverages.append(coverage)
        overlays.append(crop)

        if i % 24 == 0 or i == frame_count - 1:
            print(f"[{name}]   frame {i:3d}: coverage={coverage:.1f}%")

    if external_alpha_dir is not None and plate_close_frames:
        # Temporally-stable, size-gated see-through punch: a covered pixel
        # goes transparent only if it is plate-close (<60 L1) across a
        # 5-frame window (no per-frame threshold flicker) AND part of a
        # >=200px plate-close component (small wood-tone speckles that
        # caused the diff-key's pinholes stay opaque). Restores
        # decomposition purity where SAM covered see-through gaps with
        # clip-toned background — the visible warm wash / bbox seams.
        n = len(plate_close_frames)
        punched_total = 0
        stable = []
        for i in range(n):
            j0, j1 = max(0, i - 2), min(n, i + 3)
            s = plate_close_frames[j0]
            for j in range(j0 + 1, j1):
                s = s & plate_close_frames[j]
            stable.append(s)
        for i in range(n):
            s = stable[i][bbox["y"]:bbox["y"] + bbox["h"],
                          bbox["x"]:bbox["x"] + bbox["w"]]
            lab, nn = ndimage.label(s)
            if nn:
                sizes = ndimage.sum(s, lab, range(1, nn + 1))
                big = np.isin(lab, [k + 1 for k, sz in enumerate(sizes) if sz >= 200])
            else:
                big = np.zeros_like(s)
            sel = big & (overlays[i][:, :, 3] > 0)
            overlays[i][:, :, 3][sel] = 0
            punched_total += int(sel.sum())
        print(f"[{name}] stable see-through punch: {punched_total} px across {n} frames")

    step = source_fps // target_fps
    subsampled = [overlays[i] for i in range(0, frame_count, step)]
    sub_coverages = [coverages[i] for i in range(0, frame_count, step)]
    sub_count = len(subsampled)

    print(f"[{name}] Building after-state overlay for final frame...")
    before_crop = before_img[
        bbox["y"]:bbox["y"] + bbox["h"],
        bbox["x"]:bbox["x"] + bbox["w"],
    ]
    after_crop = after_img[
        bbox["y"]:bbox["y"] + bbox["h"],
        bbox["x"]:bbox["x"] + bbox["w"],
    ]

    after_overlay = np.zeros((bbox["h"], bbox["w"], 4), dtype=np.uint8)
    after_overlay[:, :, :3] = after_crop
    delta_l1 = np.abs(
        after_crop.astype(np.int16) - before_crop.astype(np.int16)
    ).sum(axis=-1)
    _external_after_alpha = None
    if plate_img is not None:
        # After-state alpha keyed against the CLEAN PLATE: the runtime
        # shows the plate wherever this layer is transparent, so the
        # honest coverage is exactly where after differs from plate
        # (object footprint in its after state — including parts SAM
        # undersegments). A delta>0 rect vs beforeScene also captures
        # chain-regeneration noise, and with overlapping bboxes the held
        # stack then paints stale sibling states over neighbors (the
        # all-held hazard). Sibling content picked up here is zeroed by
        # subtract_sibling_masks afterwards.
        plate_crop = plate_img[
            bbox["y"]:bbox["y"] + bbox["h"],
            bbox["x"]:bbox["x"] + bbox["w"],
        ]
        delta_plate = np.abs(
            after_crop.astype(np.int16) - plate_crop.astype(np.int16)
        ).sum(axis=-1)
        strong = ndimage.binary_opening(delta_plate > 90, iterations=1)
        weak = delta_plate > 24
        after_mask = ndimage.binary_propagation(strong, mask=weak)
        # erode thin regen-noise rings regrown by the propagation, then
        # close pose-overlap holes (two renders agreeing by luck)
        after_mask = ndimage.binary_opening(after_mask, iterations=2)
        after_mask = ndimage.binary_fill_holes(after_mask)
        # constrain to own territory: an unconstrained plate key also
        # covers SIBLINGS in their chain state (a moved pillow, an open
        # crate), which then double-draws over the sibling's own layer
        t_crop = scene_mask[
            bbox["y"]:bbox["y"] + bbox["h"],
            bbox["x"]:bbox["x"] + bbox["w"],
        ].copy()
        if object_mask_scene is not None:
            t_crop |= ndimage.binary_dilation(object_mask_scene, iterations=3)[
                bbox["y"]:bbox["y"] + bbox["h"],
                bbox["x"]:bbox["x"] + bbox["w"],
            ]
        after_mask &= ndimage.binary_dilation(t_crop, iterations=4)
        if object_mask_scene is not None:
            after_mask |= object_mask_scene[
                bbox["y"]:bbox["y"] + bbox["h"],
                bbox["x"]:bbox["x"] + bbox["w"],
            ]
        after_mask = ndimage.binary_closing(after_mask, iterations=2)
        after_mask = ndimage.binary_dilation(after_mask, iterations=2)
        if external_alpha_dir is not None and plate_img is not None:
            # thin-structure strand rescue: the after-mask morphology
            # (opening) erodes 2-3px strands (net mesh tails) exactly like
            # it would erode fence pickets on raw frames — re-admit strong
            # drift adjacent to the mask body so thin content survives
            # without letting far-field noise in.
            plate_crop_sr = plate_img[
                bbox["y"]:bbox["y"] + bbox["h"], bbox["x"]:bbox["x"] + bbox["w"]]
            strong_sr = np.abs(after_crop.astype(np.int16)
                               - plate_crop_sr.astype(np.int16)).sum(axis=-1) > 90
            after_mask |= strong_sr & ndimage.binary_dilation(after_mask, iterations=8)
            # held frames draw forever: after-scene drift baked beyond the
            # object hard-cuts at bbox edges (chest rug seam) — but any
            # BINARY cut on smoothly-varying drift creates visible interior
            # boundaries (walk regression: rectangular sand patches, a seam
            # through the puppy). Fractional alpha instead: the SAM end-pose
            # object stays fully opaque; surrounding after-drift FADES with
            # drift magnitude (smoothstep 25..90 L1) — no boundary anywhere.
            plate_crop2 = plate_img[
                bbox["y"]:bbox["y"] + bbox["h"], bbox["x"]:bbox["x"] + bbox["w"]]
            drift = np.abs(after_crop.astype(np.int16)
                           - plate_crop2.astype(np.int16)).sum(axis=-1).astype(np.float32)
            t = np.clip((drift - AFTER_FADE_LO) / (AFTER_FADE_HI - AFTER_FADE_LO), 0.0, 1.0)
            t = t * t * (3 - 2 * t)
            soft = (t * 255.0).astype(np.uint8)
            lp = sorted(external_alpha_dir.glob("mask_*.png"))
            endc = None
            if lp:
                endm = np.array(Image.open(lp[-1]).convert("L"))
                if endm.shape != (720, 1280):
                    endm = np.array(Image.fromarray(endm).resize((1280, 720), Image.NEAREST))
                endc = ndimage.binary_dilation(endm > 127, iterations=3)[
                    bbox["y"]:bbox["y"] + bbox["h"], bbox["x"]:bbox["x"] + bbox["w"]]
            frac_alpha = np.where(after_mask, soft, 0).astype(np.uint8)
            if endc is not None:
                frac_alpha = np.where(endc & after_mask, 255, frac_alpha)
            _external_after_alpha = frac_alpha
        else:
            _external_after_alpha = None
    else:
        after_mask = delta_l1 > 0
    if _external_after_alpha is not None:
        after_overlay[:, :, 3] = _external_after_alpha
    else:
        after_overlay[:, :, 3] = np.where(after_mask, 255, 0).astype(np.uint8)

    alpha_pil = Image.fromarray(after_overlay[:, :, 3])
    alpha_f = np.array(alpha_pil.filter(ImageFilter.GaussianBlur(radius=1)))
    after_overlay[:, :, 3] = np.maximum(after_overlay[:, :, 3], alpha_f)

    actual_ease = min(ease_frames, sub_count)
    print(f"[{name}] Easing tail: last {actual_ease} frames toward after-state (smoothstep)")
    after_f = after_overlay.astype(np.float32)
    for k in range(actual_ease):
        idx = sub_count - actual_ease + k
        if idx < 0:
            continue
        raw_t = k / max(actual_ease - 1, 1)
        t = raw_t * raw_t * (3 - 2 * raw_t)
        subsampled[idx] = (
            subsampled[idx].astype(np.float32) * (1 - t) + after_f * t
        ).clip(0, 255).astype(np.uint8)
        sub_coverages[idx] = float(np.sum(subsampled[idx][:, :, 3] > 0)) / (bbox["w"] * bbox["h"]) * 100
        if k in (0, actual_ease // 2, actual_ease - 1):
            print(f"[{name}]   ease frame {idx}: t={t:.3f}")

    # Full-coverage last frame: extend alpha to cover everywhere the
    # after-scene differs from the clean plate (within the bbox).  The
    # tail ease only covers the territory derived from the before-scene
    # SAM mask; objects that change shape (chest opens, pillow moves)
    # leave gaps.  Fix: merge the plate→after alpha into the last frame
    # so the held composition exactly reconstructs the after-scene.
    if plate_img is not None:
        plate_crop_fc = plate_img[
            bbox["y"]:bbox["y"] + bbox["h"],
            bbox["x"]:bbox["x"] + bbox["w"],
        ]
        delta_fc = np.abs(
            after_crop.astype(np.int16) - plate_crop_fc.astype(np.int16)
        ).sum(axis=-1)
        full_mask = ndimage.binary_closing(delta_fc > 25, iterations=2)
        full_mask = ndimage.binary_fill_holes(full_mask)
        full_alpha = full_mask.astype(np.uint8) * 255
        full_alpha_f = np.array(
            Image.fromarray(full_alpha).filter(ImageFilter.GaussianBlur(radius=1))
        )
        last = subsampled[-1].copy()
        merged_a = np.maximum(last[:, :, 3], full_alpha_f)
        new_px = (merged_a > 0) & (last[:, :, 3] == 0)
        last[:, :, :3][new_px] = after_crop[new_px]
        last[:, :, 3] = merged_a
        old_cov = float(np.sum(subsampled[-1][:, :, 3] > 0)) / (bbox["w"] * bbox["h"]) * 100
        new_cov = float(np.sum(last[:, :, 3] > 0)) / (bbox["w"] * bbox["h"]) * 100
        subsampled[-1] = last
        sub_coverages[-1] = new_cov
        print(f"[{name}] Full-coverage last frame: {old_cov:.1f}% → {new_cov:.1f}%")

    composed = before_crop.copy().astype(np.float32)
    alpha = subsampled[-1][:, :, 3:4].astype(np.float32) / 255.0
    composed = composed * (1 - alpha) + subsampled[-1][:, :, :3].astype(np.float32) * alpha
    composed = np.clip(composed, 0, 255).astype(np.uint8)
    comp_delta = np.abs(composed.astype(np.int16) - after_crop.astype(np.int16))
    mean_d = float(comp_delta.mean())
    frac30 = float(np.sum(comp_delta.sum(axis=-1) > 30)) / comp_delta[:, :, 0].size * 100
    print(f"[{name}] Composed-last vs after-scene: mean={mean_d:.2f}, frac>30={frac30:.3f}%")

    if mean_d > 2 or frac30 > 0.5:
        print(f"[{name}] WARNING: after-state overlay exceeds thresholds!")

    rows_grid = (sub_count + cols - 1) // cols
    sheet = np.zeros((rows_grid * bbox["h"], cols * bbox["w"], 4), dtype=np.uint8)
    for idx, frame in enumerate(subsampled):
        c = idx % cols
        r = idx // cols
        sheet[
            r * bbox["h"]:(r + 1) * bbox["h"],
            c * bbox["w"]:(c + 1) * bbox["w"],
        ] = frame

    sheet_path = out_dir / f"{name}.webp"
    Image.fromarray(sheet).save(str(sheet_path), "webp", lossless=True, method=6)
    sheet_size = sheet_path.stat().st_size / 1024 / 1024

    patch_path = out_dir / f"{name}_patch.png"
    Image.fromarray(before_crop).save(str(patch_path))
    patch_size = patch_path.stat().st_size / 1024

    print(
        f"[{name}] Sheet: {sheet.shape[1]}x{sheet.shape[0]}, "
        f"{sub_count} frames, {sheet_size:.1f}MB"
    )
    print(f"[{name}] Patch: {patch_size:.0f}KB")
    print(
        f"[{name}] Coverage: min={min(sub_coverages):.1f}% "
        f"max={max(sub_coverages):.1f}% mean={np.mean(sub_coverages):.1f}%"
    )

    return {
        "sheet": f"escape-sprites/{name}.webp",
        "patch": f"escape-sprites/{name}_patch.png",
        "cols": cols,
        "frameCount": sub_count,
        "fps": target_fps,
        "bbox": bbox,
    }


def _build_sibling_mask(
    sprite_bbox: dict[str, int],
    sibling_rest_path: Path,
    sibling_rest_bbox: dict[str, int],
) -> np.ndarray:
    """Build a boolean mask in sprite-bbox local coords where a sibling's
    rest layer is opaque (alpha > 128)."""
    sb = sprite_bbox
    rb = sibling_rest_bbox
    mask = np.zeros((sb["h"], sb["w"]), dtype=bool)

    ox0 = max(sb["x"], rb["x"])
    oy0 = max(sb["y"], rb["y"])
    ox1 = min(sb["x"] + sb["w"], rb["x"] + rb["w"])
    oy1 = min(sb["y"] + sb["h"], rb["y"] + rb["h"])
    if ox0 >= ox1 or oy0 >= oy1:
        return mask

    rest = np.array(Image.open(sibling_rest_path).convert("RGBA"))
    rest_h, rest_w = rest.shape[:2]

    sp_x0 = ox0 - sb["x"]
    sp_y0 = oy0 - sb["y"]
    sp_x1 = ox1 - sb["x"]
    sp_y1 = oy1 - sb["y"]

    r_x0 = int((ox0 - rb["x"]) / rb["w"] * rest_w)
    r_y0 = int((oy0 - rb["y"]) / rb["h"] * rest_h)
    r_x1 = int((ox1 - rb["x"]) / rb["w"] * rest_w)
    r_y1 = int((oy1 - rb["y"]) / rb["h"] * rest_h)
    r_x1 = min(r_x1, rest_w)
    r_y1 = min(r_y1, rest_h)

    rest_crop = rest[r_y0:r_y1, r_x0:r_x1, 3]
    if rest_crop.size == 0:
        return mask
    rest_resized = np.array(
        Image.fromarray(rest_crop).resize(
            (sp_x1 - sp_x0, sp_y1 - sp_y0), Image.NEAREST
        )
    )
    mask[sp_y0:sp_y1, sp_x0:sp_x1] = rest_resized > 128
    return mask


def subtract_sibling_masks(
    sheet_path: Path,
    sprite_bbox: dict[str, int],
    room_hotspots: list[dict],
    hotspot_id: str,
    room_id: str,
    cols: int,
    frame_count: int,
    hotspot_object_map: dict[tuple[str, str], str] | None = None,
    sprites_dir: Path = ROOT / "public",
) -> int:
    """Zero alpha on sheet pixels that fall within sibling rest-layer masks.

    Prevents baked sibling content when sprite bboxes overlap neighboring
    objects. Skips siblings that share a HOTSPOT_OBJECT_MAP entry (shared-
    object hotspots like panel/slot keep rocket pixels).

    Returns the total number of pixels zeroed across all frames.
    """
    combined = np.zeros((sprite_bbox["h"], sprite_bbox["w"]), dtype=bool)

    for sib in room_hotspots:
        if sib["id"] == hotspot_id:
            continue
        sib_sp = sib.get("sprite", {})
        if not sib_sp.get("rest") or not sib_sp.get("restBbox"):
            continue
        if hotspot_object_map:
            my_obj = hotspot_object_map.get((room_id, hotspot_id))
            sib_obj = hotspot_object_map.get((room_id, sib["id"]))
            if my_obj and sib_obj and my_obj == sib_obj:
                continue
        mask = _build_sibling_mask(
            sprite_bbox, sprites_dir / sib_sp["rest"], sib_sp["restBbox"]
        )
        combined |= mask

    if not combined.any():
        return 0

    sheet = np.array(Image.open(sheet_path))
    fw = sheet.shape[1] // cols
    rows = (frame_count + cols - 1) // cols
    fh = sheet.shape[0] // rows

    zeroed = 0
    for i in range(frame_count):
        r, c = i // cols, i % cols
        frame_alpha = sheet[r * fh : (r + 1) * fh, c * fw : (c + 1) * fw, 3]
        hit = combined & (frame_alpha > 0)
        frame_alpha[hit] = 0
        zeroed += int(hit.sum())

    if zeroed > 0:
        Image.fromarray(sheet).save(str(sheet_path), "webp", lossless=True, method=6)

    return zeroed


def get_chain() -> list[dict]:
    """Derive the hotspot chain from the manifest, returning entries for all
    animated hotspots with their before/after scenes."""
    import json

    manifest = json.loads((ROOT / "src" / "assets" / "manifest.json").read_text())
    entries = []
    for room in manifest.get("escape", []):
        rid = room["id"]
        current_scene = room["image"]
        for h in room.get("hotspots", []):
            hid = h["id"]
            has_anim = h.get("animVideo") or h.get("sprite")
            if has_anim:
                before = current_scene
                after = h.get("revealScene") or h.get("afterScene") or current_scene
                entries.append({
                    "room": rid,
                    "hotspot": hid,
                    "clip": h.get("animVideo", ""),
                    "before": before,
                    "after": after,
                    "hitbox": h.get("box", {}),
                    "has_sprite": bool(h.get("sprite")),
                })
            if h.get("takenScene"):
                current_scene = h["takenScene"]
            elif h.get("afterScene"):
                current_scene = h["afterScene"]
            elif h.get("revealScene"):
                current_scene = h["revealScene"]
    return entries


def extract_all(
    skip_existing: bool = True,
    only: str | None = None,
) -> list[dict]:
    """Run extraction for all un-migrated hotspots.

    Args:
        skip_existing: Skip hotspots that already have sprite sheets.
        only: If set, only process this room/hotspot (e.g. "toyroom/pillow").

    Returns:
        List of sprite metadata dicts for manifest updates.
    """
    chain = get_chain()
    out_dir = ROOT / "public" / "escape-sprites"
    out_dir.mkdir(parents=True, exist_ok=True)
    results = []

    for entry in chain:
        tag = f"{entry['room']}/{entry['hotspot']}"
        name = f"{entry['room']}_{entry['hotspot']}"

        if only and tag != only:
            continue

        if skip_existing and entry["has_sprite"]:
            print(f"[{name}] Already has sprite, skipping")
            continue

        if not entry["clip"]:
            print(f"[{name}] No clip, skipping")
            continue

        clip = ROOT / "public" / entry["clip"]
        before_path = ROOT / "assets" / "game" / entry["before"]
        after_path = ROOT / "assets" / "game" / entry["after"]

        if not clip.exists():
            print(f"[{name}] MISSING clip: {clip}")
            continue
        if not before_path.exists():
            print(f"[{name}] MISSING before: {before_path}")
            continue
        if not after_path.exists():
            print(f"[{name}] MISSING after: {after_path}")
            continue

        before_img = np.array(
            Image.open(before_path).convert("RGB").resize((1280, 720), Image.LANCZOS)
        )
        after_img = np.array(
            Image.open(after_path).convert("RGB").resize((1280, 720), Image.LANCZOS)
        )
        bbox = compute_scene_bbox(before_img, after_img)

        print(f"\n{'='*60}")
        print(f"[{name}] bbox={bbox} ({bbox['w']*bbox['h']/(1280*720)*100:.1f}% of frame)")
        print(f"{'='*60}")

        result = extract_sprite_sheet(
            clip=clip,
            before_path=before_path,
            after_path=after_path,
            bbox=bbox,
            out_dir=out_dir,
            name=name,
        )
        result["_room"] = entry["room"]
        result["_hotspot"] = entry["hotspot"]
        results.append(result)

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract rotoscoped sprite sheets")
    parser.add_argument("--clip", help="Path to video clip")
    parser.add_argument("--before", help="Path to before-scene PNG")
    parser.add_argument("--after", help="Path to after-scene PNG")
    parser.add_argument("--bbox", help="Bounding box as x,y,w,h (auto-detected if omitted)")
    parser.add_argument("--plate", help="Path to clean plate PNG (objectless background)")
    parser.add_argument("--out-dir", default="public/escape-sprites")
    parser.add_argument("--name", help="Output name prefix")
    parser.add_argument("--all", action="store_true", help="Process all un-migrated hotspots")
    parser.add_argument("--only", help="Process only this room/hotspot (e.g. toyroom/pillow)")
    args = parser.parse_args()

    if args.all or args.only:
        results = extract_all(only=args.only)
        print(f"\n{'='*60}")
        print(f"Processed {len(results)} hotspots")
        for r in results:
            print(f"  {r['_room']}/{r['_hotspot']}: {r['sheet']} ({r['bbox']})")
    elif args.clip and args.before and args.after and args.name:
        before_img = np.array(
            Image.open(args.before).convert("RGB").resize((1280, 720), Image.LANCZOS)
        )
        after_img = np.array(
            Image.open(args.after).convert("RGB").resize((1280, 720), Image.LANCZOS)
        )

        plate_img = None
        if args.plate:
            plate_img = np.array(
                Image.open(args.plate).convert("RGB").resize((1280, 720), Image.LANCZOS)
            )

        if args.bbox:
            x, y, w, h = map(int, args.bbox.split(","))
            bbox = {"x": x, "y": y, "w": w, "h": h}
        else:
            bbox = compute_scene_bbox(before_img, after_img)

        result = extract_sprite_sheet(
            clip=Path(args.clip),
            before_path=Path(args.before),
            after_path=Path(args.after),
            bbox=bbox,
            out_dir=Path(args.out_dir),
            name=args.name,
            plate_img=plate_img,
        )
        print(f"\nResult: {result}")
    else:
        parser.print_help()
        sys.exit(1)
