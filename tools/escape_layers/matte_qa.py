"""Deterministic matte/rotoscoping QA over the escape sprite sheets.

Per sheet, per sampled raw-motion frame:
  pinholes    — enclosed transparent holes inside the object silhouette
  specks      — tiny disconnected alpha components (matte noise)
  contamination — opaque pixels whose RGB ~= the clean plate at the same
                spot (background carried as object), strict L1 < 20
  ragged      — isoperimetric complexity of the union silhouette
                (perimeter^2 / 4*pi*area; circle=1, higher=raggeder)
  ring_tint   — how plate-colored the feather band is vs the opaque core
                (ratio < 1 means the ring is closer to the plate = halo)
  edge_cut    — opaque pixels on the frame border (hard bbox cuts)
  flicker     — alpha XOR between ADJACENT frames / mean opaque area
                (adjacent-frame motion is small at 12fps; spikes = matte
                instability)

Output: JSON + ranked table on stdout.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path('/home/ivanmkc/kidsgame')
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/tmp/matte_qa')
OUT.mkdir(exist_ok=True)
FRAMES = [4, 12, 20, 28, 36, 42]          # raw-motion window (V3 ease = 44..47)
PAIRS = [(12, 13), (28, 29), (36, 37)]     # adjacent pairs for flicker
FROZEN = {('rocketpad', 'toolbox'), ('dragoncave', 'dragon')}

m = json.loads((ROOT / 'src/assets/manifest.json').read_text())
results = []

for room in m['escape']:
    rid = room['id']
    plate = np.array(Image.open(ROOT / f'assets/game/escape/{rid}_clean.png').convert('RGB')).astype(np.int16)
    for h in room['hotspots']:
        sp = h.get('sprite', {})
        if not sp.get('sheet'):
            continue
        name = f"{rid}_{h['id']}"
        sheet = np.array(Image.open(ROOT / 'public' / sp['sheet']))
        cols, fc = sp['cols'], sp['frameCount']
        rows = (fc + cols - 1) // cols
        fh, fw = sheet.shape[0] // rows, sheet.shape[1] // cols
        bb = sp['bbox']
        pl = plate[bb['y']:bb['y'] + bb['h'], bb['x']:bb['x'] + bb['w']]

        def frame(i):
            return sheet[(i // cols) * fh:(i // cols + 1) * fh,
                         (i % cols) * fw:(i % cols + 1) * fw]

        per_frame = []
        for i in FRAMES:
            fr = frame(i)
            a = fr[:, :, 3]
            solid = a > 128
            area = int(solid.sum())
            if area < 500:
                continue
            filled = ndimage.binary_fill_holes(solid)
            holes_mask = filled & ~solid
            hl, hn = ndimage.label(holes_mask)
            hole_sizes = ndimage.sum(holes_mask, hl, range(1, hn + 1)) if hn else []
            big_holes = [int(s) for s in hole_sizes if s >= 30]
            cl, cn = ndimage.label(solid)
            csizes = ndimage.sum(solid, cl, range(1, cn + 1)) if cn else []
            specks = sum(1 for s in csizes if s < 100)
            # contamination: opaque and plate-identical
            d_plate = np.abs(fr[:, :, :3].astype(np.int16) - pl).sum(-1)
            contam = float(((a == 255) & (d_plate < 20)).sum()) / max((a == 255).sum(), 1) * 100
            # boundary raggedness of the union silhouette
            er = ndimage.binary_erosion(filled)
            perim = int((filled & ~er).sum())
            ragged = perim * perim / (4 * np.pi * max(filled.sum(), 1))
            # feather-ring tint: is the ring plate-colored relative to core?
            ring = (a > 20) & (a < 235)
            core = a == 255
            if ring.sum() > 50 and core.sum() > 50:
                ring_d = float(d_plate[ring].mean())
                core_d = float(d_plate[core].mean())
                ring_tint = ring_d / max(core_d, 1e-6)
            else:
                ring_tint = 1.0
            # hard cuts at frame borders
            edge_cut = int(solid[0, :].sum() + solid[-1, :].sum() + solid[:, 0].sum() + solid[:, -1].sum())
            per_frame.append({
                'frame': i, 'area': area,
                'hole_px': int(holes_mask.sum()), 'holes_ge30': len(big_holes),
                'specks': specks, 'contam_pct': round(contam, 2),
                'ragged': round(float(ragged), 1),
                'ring_tint': round(ring_tint, 3),
                'edge_cut_px': edge_cut,
            })
        flick = []
        for i, j in PAIRS:
            if j >= fc:
                continue
            xa = (frame(i)[:, :, 3] > 128)
            xb = (frame(j)[:, :, 3] > 128)
            denom = max((xa.sum() + xb.sum()) / 2, 1)
            flick.append(float((xa ^ xb).sum()) / denom * 100)
        results.append({
            'sheet': name,
            'frozen': (rid, h['id']) in FROZEN,
            'frames': per_frame,
            'flicker_pct': [round(f, 2) for f in flick],
            'worst': {
                'hole_px': max((f['hole_px'] for f in per_frame), default=0),
                'holes_ge30': max((f['holes_ge30'] for f in per_frame), default=0),
                'specks': max((f['specks'] for f in per_frame), default=0),
                'contam_pct': max((f['contam_pct'] for f in per_frame), default=0),
                'ragged': max((f['ragged'] for f in per_frame), default=0),
                'ring_tint': min((f['ring_tint'] for f in per_frame), default=1),
                'edge_cut_px': max((f['edge_cut_px'] for f in per_frame), default=0),
                'flicker_pct': max(flick, default=0),
            },
        })

(OUT / 'metrics.json').write_text(json.dumps(results, indent=2))

# ranked table: composite badness = normalized rank sum over the worst dims
dims = ['hole_px', 'holes_ge30', 'specks', 'contam_pct', 'ragged', 'edge_cut_px', 'flicker_pct']
score = {}
for d in dims:
    order = sorted(results, key=lambda r: r['worst'][d])
    for rank, r in enumerate(order):
        score[r['sheet']] = score.get(r['sheet'], 0) + rank
print(f"{'sheet':<24} {'holes':>6} {'#h30':>5} {'spk':>4} {'contam%':>8} {'ragged':>7} {'ring':>6} {'edge':>6} {'flick%':>7}  badness")
for r in sorted(results, key=lambda r: -score[r['sheet']]):
    w = r['worst']
    tag = ' [frozen]' if r['frozen'] else ''
    print(f"{r['sheet']:<24} {w['hole_px']:>6} {w['holes_ge30']:>5} {w['specks']:>4} "
          f"{w['contam_pct']:>8.2f} {w['ragged']:>7.1f} {w['ring_tint']:>6.3f} {w['edge_cut_px']:>6} "
          f"{w['flicker_pct']:>7.2f}  {score[r['sheet']]}{tag}")
print('\nJSON ->', OUT / 'metrics.json')
