"""Validation suite for escape_layers.temporal_qa (run manually:
python3 tools/escape_layers/temporal_qa_selftest.py — ~2-3 min, exit 0 on pass) — must pass BEFORE the
metrics touch real sheets.

Synthetic sequences (200x200, 32 frames) with KNOWN stability:
  S1 stable-slow    disk translating 1 px/frame       -> all metrics low
  S2 stable-fast    disk translating 6 px/frame       -> flow metrics must
                                                         NOT punish speed
  S3 jitter-small   S1 + 1-2 px random boundary jitter
  S4 jitter-large   S1 + 3-5 px random boundary jitter -> monotone worse
  S5 hole-flicker   S1 + holes appearing/disappearing
  S6 speck-pop      S1 + random specks popping in/out
  S7 legit-deform   disk growing 1 px/frame (door-opening analog)
                    -> warp/topo must stay low; slow coherent deformation
Adversarial checks:
  A1 the naive XOR-flicker metric (shipped earlier as flicker_pct) is
     PROVEN motion-confounded on S2 while warp_error is not
  A2 flow-direction sanity: inverted warp direction would blow up S2
     (covered by the S2 tolerance assertion)
  A3 edge cases: empty pair, full-frame pair, tiny mask -> defined, finite
Deterministic: seeded RNG, no Date/random ambiguity.
"""
import sys

import numpy as np

sys.path.insert(0, str(__import__('pathlib').Path(__file__).resolve().parent.parent))
from escape_layers.temporal_qa import sequence_metrics, warp_pair, t_deform_pair, topo_pair

H = W = 200
N = 32
rng = np.random.default_rng(7)

# fixed textures: object texture rides WITH the object (translated),
# background texture is static — gives Farneback real signal
BG = rng.integers(60, 120, (H, W, 3), dtype=np.uint8)
OBJ_TEX = rng.integers(140, 230, (H * 3, W * 3, 3), dtype=np.uint8)


def disk_mask(cx, cy, r):
    ys, xs = np.mgrid[:H, :W]
    return (xs - cx) ** 2 + (ys - cy) ** 2 <= r * r


def render(mask, ox, oy):
    """RGB frame: object texture (anchored to object via offset) over BG."""
    out = BG.copy()
    tex = OBJ_TEX[50 + oy:50 + oy + H, 50 + ox:50 + ox + W]
    out[mask] = tex[mask]
    return out


def seq_translate(step, jitter=0, holes=False, specks=False, grow=0):
    masks, rgbs = [], []
    r = 34
    for i in range(N):
        cx, cy = 40 + step * i, 100
        rr = r + grow * i
        m = disk_mask(cx, cy, rr)
        if jitter:
            # random boundary erosion/dilation patches, new each frame
            from scipy import ndimage
            amp = int(rng.integers(1, jitter + 1))
            if rng.random() < 0.5:
                m = ndimage.binary_dilation(m, iterations=amp)
            else:
                m = ndimage.binary_erosion(m, iterations=amp)
            # plus angular nibbles: remove a random wedge of boundary
            ys, xs = np.mgrid[:H, :W]
            ang = np.arctan2(ys - cy, xs - cx)
            a0 = rng.uniform(-np.pi, np.pi)
            wedge = (np.abs(((ang - a0 + np.pi) % (2 * np.pi)) - np.pi) < 0.35)
            ring = m & ~ndimage.binary_erosion(m, iterations=3)
            m = m & ~(wedge & ring)
        if holes and i % 2 == 0:
            hx, hy = int(cx + rng.integers(-15, 15)), int(cy + rng.integers(-15, 15))
            m = m & ~disk_mask(hx, hy, 7)
        if specks and i % 2 == 1:
            # corner region guaranteed clear of the disk (disk y in 66..134,
            # x <= 105) so every speck is a genuine popping component
            sx, sy = int(rng.integers(155, 185)), int(rng.integers(20, 50))
            m = m | disk_mask(sx, sy, 4)
        masks.append(m)
        rgbs.append(render(m, step * i, 0 if not grow else 0))
    return masks, rgbs


def naive_xor_flicker(masks):
    vals = []
    for a, b in zip(masks, masks[1:]):
        denom = max((a.sum() + b.sum()) / 2, 1)
        vals.append((a ^ b).sum() / denom * 100)
    return float(np.mean(vals))


FAILS = []


def check(name, cond, detail):
    status = 'PASS' if cond else 'FAIL'
    print(f'  [{status}] {name}: {detail}')
    if not cond:
        FAILS.append(name)


print('building sequences...')
S1 = seq_translate(1)
S2 = seq_translate(6)
S3 = seq_translate(1, jitter=2)
S4 = seq_translate(1, jitter=5)
S5 = seq_translate(1, holes=True)
S6 = seq_translate(1, specks=True)
S7 = seq_translate(0, grow=1)

M = {k: sequence_metrics(*v) for k, v in
     dict(S1=S1, S2=S2, S3=S3, S4=S4, S5=S5, S6=S6, S7=S7).items()}
for k, m in M.items():
    print(f"{k}: warp={m['warp_error']['mean']:.4f} dtssd={m['dtssd_flow']['mean']:.4f} "
          f"t_deform={m['t_deform']['mean']:.4f} topo={m['topo_flicker']['mean']:.2f}")

print('\n-- motion invariance (the confound test) --')
w1, w2 = M['S1']['warp_error']['mean'], M['S2']['warp_error']['mean']
check('warp_error motion-invariant', w2 <= max(w1 * 1.5, 0.02),
      f'slow={w1:.4f} fast={w2:.4f}')
check('warp_error absolute (stable textured)', w1 < 0.01, f'S1={w1:.4f}')
x1, x2 = naive_xor_flicker(S1[0]), naive_xor_flicker(S2[0])
check('naive XOR IS motion-confounded (expected)', x2 > 3 * x1,
      f'naive slow={x1:.2f}% fast={x2:.2f}% — confirms the old flicker_pct is invalid as a stability metric')
t1, t2 = M['S1']['t_deform']['mean'], M['S2']['t_deform']['mean']
check('t_deform motion-invariant', t2 <= max(t1 * 2.0, 0.05),
      f'slow={t1:.4f} fast={t2:.4f}')

print('\n-- monotone sensitivity to boundary jitter --')
check('warp_error monotone', M['S1']['warp_error']['mean'] < M['S3']['warp_error']['mean'] < M['S4']['warp_error']['mean'],
      f"{M['S1']['warp_error']['mean']:.4f} < {M['S3']['warp_error']['mean']:.4f} < {M['S4']['warp_error']['mean']:.4f}")
check('dtssd_flow monotone', M['S1']['dtssd_flow']['mean'] < M['S3']['dtssd_flow']['mean'] < M['S4']['dtssd_flow']['mean'],
      f"{M['S1']['dtssd_flow']['mean']:.4f} < {M['S3']['dtssd_flow']['mean']:.4f} < {M['S4']['dtssd_flow']['mean']:.4f}")
check('t_deform monotone', M['S1']['t_deform']['mean'] < M['S3']['t_deform']['mean'] < M['S4']['t_deform']['mean'],
      f"{M['S1']['t_deform']['mean']:.4f} < {M['S3']['t_deform']['mean']:.4f} < {M['S4']['t_deform']['mean']:.4f}")

print('\n-- topology churn detects hole/speck flicker --')
check('holes detected', M['S5']['topo_flicker']['mean'] > 0.8,
      f"S5 topo={M['S5']['topo_flicker']['mean']:.2f} vs S1={M['S1']['topo_flicker']['mean']:.2f}")
check('specks detected', M['S6']['topo_flicker']['mean'] > 0.8,
      f"S6 topo={M['S6']['topo_flicker']['mean']:.2f}")
check('stable has ~no churn', M['S1']['topo_flicker']['mean'] < 0.1 and M['S2']['topo_flicker']['mean'] < 0.1,
      f"S1={M['S1']['topo_flicker']['mean']:.2f} S2={M['S2']['topo_flicker']['mean']:.2f}")

print('\n-- legit slow deformation is tolerated --')
check('warp_error tolerant of growth', M['S7']['warp_error']['mean'] < M['S3']['warp_error']['mean'],
      f"grow={M['S7']['warp_error']['mean']:.4f} < jitter-small={M['S3']['warp_error']['mean']:.4f}")
check('topo tolerant of growth', M['S7']['topo_flicker']['mean'] < 0.1,
      f"grow topo={M['S7']['topo_flicker']['mean']:.2f}")

print('\n-- edge cases --')
empty = np.zeros((H, W), bool)
full = np.ones((H, W), bool)
rgbn = BG.copy()
w, d = warp_pair(empty, empty, rgbn, rgbn)
check('empty pair defined', w == 0.0 and np.isfinite(d), f'warp={w} dtssd={d:.4f}')
w, d = warp_pair(full, full, rgbn, rgbn)
check('full pair defined', np.isfinite(w) and w < 0.05, f'warp={w:.4f}')
tiny = disk_mask(100, 100, 3)
td = t_deform_pair(tiny, tiny)
check('tiny mask t_deform defined-or-None', td is None or np.isfinite(td), f'{td}')
check('empty t_deform is None', t_deform_pair(empty, empty) is None, 'undefined, not fake-zero')

print('\n== v2 adversarial section (from metric_attack review) ==')
from scipy import ndimage as ndi

def flat_seq(step, n=24):
    masks, rgbs = [], []
    for i in range(n):
        m = disk_mask(30 + step * i, 100, 30)
        rgb = np.full((H, W, 3), 90, np.uint8)
        rgb[m] = 200
        masks.append(m)
        rgbs.append(rgb)
    return masks, rgbs

print('-- flat-shaded art at application speeds (was CRITICAL false positive) --')
F1 = sequence_metrics(*flat_seq(1))
F20 = sequence_metrics(*flat_seq(6))
F25 = sequence_metrics(*flat_seq(7))  # 7px/frame on 200px canvas ~ 25px on 700px crops
FBIG = sequence_metrics(*flat_seq(20, n=8))
check('flat slow low', F1['warp_error']['mean'] < 0.02, f"{F1['warp_error']['mean']:.4f}")
check('flat fast low (dual compensator)', F25['warp_error']['mean'] < 0.02,
      f"step7={F25['warp_error']['mean']:.4f} (flow-only was 0.13-0.20)")
check('flat very fast low', FBIG['warp_error']['mean'] < 0.03, f"step20={FBIG['warp_error']['mean']:.4f}")
check('flat motion-invariant', F25['warp_error']['mean'] <= max(F1['warp_error']['mean'] * 1.5, 0.02),
      f"slow={F1['warp_error']['mean']:.4f} fast={F25['warp_error']['mean']:.4f}")

print('-- fractional alpha: feather flicker (was invisible to all metrics) --')
core = disk_mask(100, 100, 30)
ring = ndi.binary_dilation(core, iterations=2) & ~core
al_a = core.astype(np.float32) + ring * 0.25
al_b = core.astype(np.float32) + ring * 0.45
rgbs_ff = [render(core, 0, 0)] * 8
alphas_ff = [al_a if i % 2 == 0 else al_b for i in range(8)]
FF = sequence_metrics(alphas_ff, rgbs_ff)
CTRL = sequence_metrics([al_a] * 8, rgbs_ff)
check('dtssd sees feather flicker', FF['dtssd_flow']['mean'] > max(0.01, 4 * CTRL['dtssd_flow']['mean']),
      f"flicker={FF['dtssd_flow']['mean']:.4f} static={CTRL['dtssd_flow']['mean']:.4f}")
check('binary metrics unchanged by sub-threshold feather', FF['warp_error']['mean'] < 0.01 and FF['topo_flicker']['mean'] < 0.1,
      f"warp={FF['warp_error']['mean']:.4f} topo={FF['topo_flicker']['mean']:.2f}")

print('-- rigid rotation is not deformation (t_deform tangent alignment) --')
def c_shape(angle):
    ys, xs = np.mgrid[:H, :W]
    r2 = (xs - 100) ** 2 + (ys - 100) ** 2
    ring_m = (r2 <= 40 * 40) & (r2 >= 22 * 22)
    ang = np.arctan2(ys - 100, xs - 100)
    gap = np.abs(((ang - angle + np.pi) % (2 * np.pi)) - np.pi) < 0.5
    return ring_m & ~gap
rot_masks = [c_shape(np.deg2rad(10 * i)) for i in range(12)]
rot_rgbs = [render(m, 0, 0) for m in rot_masks]
TD_rot = sequence_metrics(rot_masks, rot_rgbs)['t_deform']['mean']
TD_jit_lg = M['S4']['t_deform']['mean']
TD_ident = t_deform_pair(rot_masks[0], rot_masks[0])
# contract: rotation is a bounded second-order residual (sampling-offset
# noise), not a dominant signal — zero on identity, within the jitter
# regime at fast (10 deg/frame) rotation, far below genuine morphs
check('identity is exactly stable', TD_ident == 0.0, f'identity={TD_ident}')
check('rotation bounded by jitter regime', TD_rot < 2 * TD_jit_lg,
      f"rot={TD_rot:.4f} < 2x jitter-large={TD_jit_lg:.4f}")

print('-- secondary component deformation is seen (was blind) --')
big = disk_mask(70, 100, 34)
small_disk = disk_mask(160, 60, 12)
bar = np.zeros((H, W), bool)
bar[54:66, 136:184] = True   # same centroid area, different shape
sec_masks = [big | (small_disk if i % 2 == 0 else bar) for i in range(8)]
sec_rgbs = [render(m, 0, 0) for m in sec_masks]
TD_sec = sequence_metrics(sec_masks, sec_rgbs)['t_deform']['mean']
TD_ctrl = sequence_metrics([big | small_disk] * 8, [render(big | small_disk, 0, 0)] * 8)['t_deform']['mean']
check('secondary deform fires', TD_sec > max(0.02, 3 * max(TD_ctrl, 1e-6)),
      f"morph={TD_sec:.4f} static={TD_ctrl:.4f}")
check('rotation far below morph signal', TD_rot < TD_sec / 5,
      f"rot={TD_rot:.4f} << morph={TD_sec:.4f}")

print('-- threshold-oscillating speck no longer churns (overlap matching) --')
osc_masks = []
for i in range(10):
    m = disk_mask(100, 100, 30) | disk_mask(170, 40, 3 if i % 2 == 0 else 4)  # ~21 vs ~37 px
    osc_masks.append(m)
osc_rgbs = [render(m, 0, 0) for m in osc_masks]
OSC = sequence_metrics(osc_masks, osc_rgbs)
check('marginal speck stable', OSC['topo_flicker']['mean'] < 0.1, f"topo={OSC['topo_flicker']['mean']:.2f}")

print(f"\n{'ALL PASS' if not FAILS else 'FAILURES: ' + ', '.join(FAILS)}")
sys.exit(1 if FAILS else 0)
