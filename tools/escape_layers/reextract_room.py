"""Fix 3 driver: per-room plate restore + normalized re-extraction.

Usage: python3 fix3_room.py <room_id>

1. Plate: restore original pixels outside dilate(union of SAM masks, 5)
   with a 10px ramp (kills inpaint sprawl seams/patches).
2. Sheets: re-extract every animated hotspot from its source clip with
   tonal normalization, full-scene content-derived bbox, multi-component
   scene mask, and no core filter (keeps out-of-bbox motion: flying
   pancake, escaping puppy, opening lid).
3. Manifest bboxes updated; sibling subtraction re-run.

Alignment guard: sheet frame 12 must match raw frame 24 within mean
diff 8 on opaque pixels at the OLD bbox, else the hotspot is skipped.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, distance_transform_edt

ROOT = Path('/home/ivanmkc/kidsgame')
sys.path.insert(0, str(ROOT / 'tools'))
from escape_layers.extract_sprites import (  # noqa: E402
    extract_sprite_sheet, compute_content_bbox, extract_frames,
    subtract_sibling_masks,
)

TMP = Path('/home/ivanmkc/.claude/jobs/c60063e9/tmp')
CLIPS = TMP / 'kgb-www/kidsgame/escape-video'
CLIP_OVERRIDES = {('rocketpad', 'toolbox'): TMP / 'rocketpad_toolbox_raw_0.mp4'}
# toolbox: its afterScene is a wholesale re-render doctored to the OLD
# plate (ac5ebeb); re-extraction against the restored plate needs an
# afterScene rebuild first. No sev3 findings of its own — keep sheet.
SKIP_HOTSPOTS = {('rocketpad', 'toolbox')}
# pen: current sheet's take has no surviving source AND is the judged
# broken-fence mess; the deployed/phase2 take is clean — take change OK
ALLOW_TAKE_CHANGE = {('toyroom', 'pen')}
SAM_FOR_HOTSPOT = {
    ('rocketpad', 'panel'): 'rocketpad_slot',
    ('rocketpad', 'slot'): 'rocketpad_slot',
}
HOTSPOT_OBJECT_MAP = {("rocketpad", "panel"): "rocket", ("rocketpad", "slot"): "rocket"}

room_id = sys.argv[1]
manifest_path = ROOT / 'src/assets/manifest.json'
m = json.loads(manifest_path.read_text())
room = next(r for r in m['escape'] if r['id'] == room_id)

# ---- 1. plate restore ----
scenes = ROOT / 'assets/game/escape'
orig = np.array(Image.open(scenes / f'{room_id}.png').convert('RGB')).astype(np.float32)
clean_path = scenes / f'{room_id}_clean.png'
clean = np.array(Image.open(clean_path).convert('RGB')).astype(np.float32)

keep = np.zeros(orig.shape[:2], dtype=bool)
for mp in sorted((scenes / 'sam_masks').glob(f'{room_id}_*.png')):
    keep |= binary_dilation(np.array(Image.open(mp).convert('L')) > 0, iterations=5)
w = np.clip(distance_transform_edt(~keep) / 10.0, 0, 1)
before_diff = np.abs(clean - orig).mean(-1)[~keep].mean()
clean_new = np.clip(clean * (1 - w[..., None]) + orig * w[..., None], 0, 255).astype(np.uint8)
after_diff = np.abs(clean_new.astype(np.float32) - orig).mean(-1)[~keep].mean()
Image.fromarray(clean_new).save(clean_path)
print(f'[{room_id}] plate restored: outside-silhouette diff {before_diff:.2f} -> {after_diff:.2f}', flush=True)

# ---- 1b. chain-scene cleaning ----
# Each afterScene is a Veo/NBP regeneration that drifts everywhere, not
# just where the action changed things. Rebuild every chain scene as its
# (cleaned) predecessor plus only the strong intended change, so state
# files are honest edits of the chain and held-vs-after keying is clean.
from scipy.ndimage import binary_propagation, binary_opening, binary_dilation as _bd, binary_fill_holes
from PIL import ImageFilter

def hotspot_reach(h):
    """Where this hotspot's action can legitimately change the scene:
    its draw bbox + margin, its silhouette, its rest rect."""
    reach = np.zeros((720, 1280), dtype=bool)
    sp = h.get('sprite', {})
    for key, pad in (('bbox', 60), ('restBbox', 20)):
        bbv = sp.get(key)
        if bbv:
            y0 = max(0, bbv['y'] - pad); x0 = max(0, bbv['x'] - pad)
            reach[y0:bbv['y']+bbv['h']+pad, x0:bbv['x']+bbv['w']+pad] = True
    sam_name = SAM_FOR_HOTSPOT.get((room_id, h['id']), f"{room_id}_{h['id']}")
    sp_mask = scenes / 'sam_masks' / f'{sam_name}.png'
    if sp_mask.exists():
        reach |= _bd(np.array(Image.open(sp_mask).convert('L')) > 0, iterations=20)
    return reach

def clean_chain_scene(before_arr, after_path, reach, actor_zone):
    after = np.array(Image.open(after_path).convert('RGB').resize((1280, 720), Image.LANCZOS))
    d = np.abs(after.astype(np.int16) - before_arr.astype(np.int16)).sum(-1)
    strong = binary_opening(d > 90, iterations=2)
    mask = binary_propagation(strong, mask=d > 24)
    # propagation regrows thin regen-noise rings (sibling outlines that
    # rendered a pixel off) from tiny strong seeds — erode them back out
    mask = binary_opening(mask, iterations=2)
    # where two poses of the same object overlap, interior pixels can
    # agree by luck and punch holes that mix both renders (ghost stripes)
    mask = binary_fill_holes(mask)
    # an action only changes the scene within the acting hotspot's reach;
    # everything else is regeneration drift, no matter how strong
    mask &= reach
    # the before scene already shows every sibling in its current state
    # (a moved pillow is NOT at its SAM position) — its plate-keyed
    # footprint minus the actor's own zone is sibling territory, and the
    # action cannot repaint siblings even inside its reach rect
    dfp = np.abs(before_arr.astype(np.int16) - plate_arr.astype(np.int16)).sum(-1)
    fp = binary_propagation(binary_opening(dfp > 90, iterations=2), mask=dfp > 24)
    mask &= ~(fp & ~actor_zone)
    mask = _bd(mask, iterations=2)
    w_soft = np.array(Image.fromarray((mask * 255).astype(np.uint8), 'L')
                      .filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32) / 255.0
    out = before_arr.astype(np.float32) * (1 - w_soft[..., None]) + after.astype(np.float32) * w_soft[..., None]
    out = np.clip(out, 0, 255).astype(np.uint8)
    changed = float(np.abs(out.astype(np.float32) - after.astype(np.float32)).mean())
    Image.fromarray(out).save(after_path)
    return changed, mask

def actor_zone_of(h):
    zone = np.zeros((720, 1280), dtype=bool)
    sam_name = SAM_FOR_HOTSPOT.get((room_id, h['id']), f"{room_id}_{h['id']}")
    sp_mask = scenes / 'sam_masks' / f'{sam_name}.png'
    if sp_mask.exists():
        zone |= _bd(np.array(Image.open(sp_mask).convert('L')) > 0, iterations=10)
    rbv = h.get('sprite', {}).get('restBbox')
    if rbv:
        zone[rbv['y']:rbv['y']+rbv['h'], rbv['x']:rbv['x']+rbv['w']] = True
    return zone

plate_arr = clean_new.astype(np.int16)
ZERO = np.zeros((720, 1280), dtype=bool)
actor_changed = {}
prev = np.array(Image.open(scenes / f'{room_id}.png').convert('RGB').resize((1280, 720), Image.LANCZOS))
seen = set()
prev_h = None
for h in room['hotspots']:
    sp = h.get('sprite', {})
    if not sp.get('sheet'):
        continue
    bpath = ROOT / 'assets/game' / sp['beforeScene']
    apath = ROOT / 'assets/game' / sp['afterScene']
    if str(bpath) not in seen and bpath.name != f'{room_id}.png':
        # the before scene is the previous hotspot's post-collect state
        ah = prev_h if prev_h else h
        az = actor_zone_of(ah) | actor_changed.get(ah['id'], ZERO)
        chg, msk = clean_chain_scene(prev, bpath, hotspot_reach(ah), az)
        actor_changed[ah['id']] = actor_changed.get(ah['id'], ZERO) | msk
        seen.add(str(bpath))
        print(f'[{room_id}] chain-clean {bpath.name}: noise removed mean {chg:.2f}', flush=True)
    prev = np.array(Image.open(bpath).convert('RGB').resize((1280, 720), Image.LANCZOS))
    if str(apath) not in seen:
        az = actor_zone_of(h) | actor_changed.get(h['id'], ZERO)
        chg, msk = clean_chain_scene(prev, apath, hotspot_reach(h), az)
        actor_changed[h['id']] = actor_changed.get(h['id'], ZERO) | msk
        seen.add(str(apath))
        print(f'[{room_id}] chain-clean {apath.name}: noise removed mean {chg:.2f}', flush=True)
    prev = np.array(Image.open(apath).convert('RGB').resize((1280, 720), Image.LANCZOS))
    prev_h = h

# ---- 2. re-extract sheets ----
for h in room['hotspots']:
    sp = h.get('sprite', {})
    if not sp.get('sheet'):
        continue
    hid = h['id']
    name = f'{room_id}_{hid}'
    if (room_id, hid) in SKIP_HOTSPOTS:
        print(f'[{name}] SKIP: on skip list', flush=True)
        continue
    clip = CLIP_OVERRIDES.get((room_id, hid), CLIPS / f'{name}.mp4')
    if not clip.exists():
        print(f'[{name}] SKIP: no clip', flush=True)
        continue

    before_p = ROOT / 'assets/game' / sp['beforeScene']
    after_p = ROOT / 'assets/game' / sp['afterScene']
    before_img = np.array(Image.open(before_p).convert('RGB').resize((1280, 720), Image.LANCZOS))
    after_img = np.array(Image.open(after_p).convert('RGB').resize((1280, 720), Image.LANCZOS))

    work_dir = TMP / 'fix3' / name
    frames_dir = work_dir / 'frames'
    if len(list(frames_dir.glob('f_*.png'))) < 90 if frames_dir.exists() else True:
        n = extract_frames(clip, frames_dir)
        print(f'[{name}] {n} frames extracted', flush=True)

    # alignment guard at OLD bbox
    old_bb = sp['bbox']
    sheet = np.array(Image.open(ROOT / 'public' / sp['sheet']))
    cols = sp['cols']; rows = (sp['frameCount'] + cols - 1) // cols
    fh, fw = sheet.shape[0] // rows, sheet.shape[1] // cols
    sf = sheet[fh:(2 * fh), 5 * fw:6 * fw]  # frame 12 (r=1,c=5) for cols=7
    raw = np.array(Image.open(frames_dir / 'f_0025.png').convert('RGB').resize((1280, 720), Image.LANCZOS))
    rawc = raw[old_bb['y']:old_bb['y'] + old_bb['h'], old_bb['x']:old_bb['x'] + old_bb['w']]
    if sf.shape[:2] == rawc.shape[:2]:
        op = sf[:, :, 3] > 200
        md = float(np.abs(sf[:, :, :3].astype(np.float32) - rawc.astype(np.float32)).mean(-1)[op].mean()) if op.sum() > 500 else 0.0
        if md > 8 and (room_id, hid) not in ALLOW_TAKE_CHANGE:
            print(f'[{name}] SKIP: alignment diff {md:.1f} > 8 — wrong take?', flush=True)
            continue
        print(f'[{name}] alignment diff {md:.2f}' + (' (take change allowed)' if md > 8 else ' OK'), flush=True)

    sam_name = SAM_FOR_HOTSPOT.get((room_id, hid), name)
    sam_p = scenes / 'sam_masks' / f'{sam_name}.png'
    rest_mask = (np.array(Image.open(sam_p).convert('L')) > 0) if sam_p.exists() else None

    my_obj = HOTSPOT_OBJECT_MAP.get((room_id, hid))
    sib_excl = np.zeros((720, 1280), dtype=bool)
    sib_sil = np.zeros((720, 1280), dtype=bool)
    for other in room['hotspots']:
        if other['id'] == hid:
            continue
        if my_obj and HOTSPOT_OBJECT_MAP.get((room_id, other['id'])) == my_obj:
            continue
        osp = other.get('sprite', {})
        ob = osp.get('bbox')
        if ob:
            sib_excl[ob['y']:ob['y']+ob['h'], ob['x']:ob['x']+ob['w']] = True
        osam = SAM_FOR_HOTSPOT.get((room_id, other['id']), f"{room_id}_{other['id']}")
        op = scenes / 'sam_masks' / f'{osam}.png'
        if op.exists():
            sm = np.array(Image.open(op).convert('L')) > 0
            sib_excl |= sm
            sib_sil |= sm

    new_bb = compute_content_bbox(
        frames_dir, before_img, after_img, old_bb, 96,
        rest_mask_scene=rest_mask, sibling_exclude=sib_excl,
        sibling_silhouettes=sib_sil,
    )
    print(f'[{name}] bbox {old_bb} -> {new_bb}', flush=True)

    meta = extract_sprite_sheet(
        clip, before_p, after_p, new_bb,
        out_dir=ROOT / 'public/escape-sprites', name=name,
        work_dir=work_dir,
        normalize=True, keep_all_components=True, core_filter=False,
        min_cc_area=250, object_mask_scene=rest_mask, plate_img=clean_new,
    )
    sp['bbox'] = meta['bbox']
    sp['cols'] = meta['cols']
    sp['frameCount'] = meta['frameCount']

manifest_path.write_text(json.dumps(m, indent=2) + '\n')
print(f'[{room_id}] manifest updated', flush=True)

# ---- 3. sibling subtraction ----
for h in room['hotspots']:
    sp = h.get('sprite', {})
    if not sp.get('sheet'):
        continue
    z = subtract_sibling_masks(
        ROOT / 'public' / sp['sheet'], sp['bbox'], room['hotspots'], h['id'],
        room_id, sp['cols'], sp['frameCount'], HOTSPOT_OBJECT_MAP,
    )
    print(f"[{room_id}/{h['id']}] subtraction: {z} px", flush=True)
print(f'[{room_id}] DONE', flush=True)
