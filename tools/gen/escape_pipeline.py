"""End-to-end escape pipeline: Veo → rotoscope → rest layers → verify.

Reproducible pipeline that:
  1. Generates Veo animation clips (or reuses existing)
  2. Cleans chain scenes (removes Gemini regeneration noise)
  3. Extracts rotoscoped sprite sheets from clips
  4. Generates rest layers (SAM-mask-based RGBA cutouts)
  5. Syncs sprite last frames to current afterScene images
  6. Runs sibling subtraction
  7. Updates manifest
  8. Runs verification

Usage:
    python3 tools/gen/escape_pipeline.py [room_id ...] [--step STEP]
    python3 tools/gen/escape_pipeline.py dragoncave --step extract
    python3 tools/gen/escape_pipeline.py --step verify
    python3 tools/gen/escape_pipeline.py --step all  # full pipeline
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import (
    binary_dilation,
    binary_fill_holes,
    binary_opening,
    binary_propagation,
    distance_transform_edt,
)

sys.path.insert(0, str(Path(__file__).parent.parent))
from escape_layers.extract_sprites import (  # noqa: E402
    compute_content_bbox,
    extract_frames,
    extract_sprite_sheet,
    subtract_sibling_masks,
)
from gen.escape_specs import ESCAPE_ROOMS  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent.parent
SCENES = ROOT / "assets" / "game" / "escape"
SAM_DIR = SCENES / "sam_masks"
SPRITES_DIR = ROOT / "public" / "escape-sprites"
CLIPS_DIR = ROOT / "public" / "escape-video"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"

SAM_FOR_HOTSPOT = {
    ("rocketpad", "panel"): "rocketpad_slot",
    ("rocketpad", "slot"): "rocketpad_slot",
}
HOTSPOT_OBJECT_MAP = {
    ("rocketpad", "panel"): "rocket",
    ("rocketpad", "slot"): "rocket",
}
SKIP_HOTSPOTS: set[tuple[str, str]] = set()


def _load_manifest() -> dict:
    return json.loads(MANIFEST.read_text())


def _save_manifest(m: dict) -> None:
    MANIFEST.write_text(json.dumps(m, indent=2) + "\n")


def step_veo(room_filter: set[str] | None = None, force: bool = False) -> None:
    """Step 1: Generate Veo animation clips."""
    from gen.escape_video import gen_all  # noqa: E402
    print("\n" + "=" * 60)
    print("  STEP 1: Veo clip generation")
    print("=" * 60)
    results = gen_all(room_filter=room_filter, force=force)
    total = sum(len(v) for v in results.values())
    print(f"\n  {total} clips generated/verified")


def step_plate_restore(room_id: str) -> np.ndarray:
    """Restore plate pixels outside SAM masks (kills inpaint sprawl)."""
    orig = np.array(Image.open(SCENES / f"{room_id}.png").convert("RGB")).astype(np.float32)
    clean_path = SCENES / f"{room_id}_clean.png"
    clean = np.array(Image.open(clean_path).convert("RGB")).astype(np.float32)

    keep = np.zeros(orig.shape[:2], dtype=bool)
    for mp in sorted(SAM_DIR.glob(f"{room_id}_*.png")):
        keep |= binary_dilation(np.array(Image.open(mp).convert("L")) > 0, iterations=5)

    w = np.clip(distance_transform_edt(~keep) / 10.0, 0, 1)
    before_diff = np.abs(clean - orig).mean(-1)[~keep].mean()
    clean_new = np.clip(clean * (1 - w[..., None]) + orig * w[..., None], 0, 255).astype(np.uint8)
    after_diff = np.abs(clean_new.astype(np.float32) - orig).mean(-1)[~keep].mean()
    Image.fromarray(clean_new).save(clean_path)
    print(f"  [{room_id}] plate restored: outside-mask diff {before_diff:.2f} → {after_diff:.2f}")
    return clean_new


def _hotspot_reach(room_id: str, h: dict) -> np.ndarray:
    """Where a hotspot's action can legitimately change the scene."""
    reach = np.zeros((720, 1280), dtype=bool)
    sp = h.get("sprite", {})
    for key, pad in (("bbox", 60), ("restBbox", 20)):
        bbv = sp.get(key)
        if bbv:
            y0, x0 = max(0, bbv["y"] - pad), max(0, bbv["x"] - pad)
            reach[y0:bbv["y"] + bbv["h"] + pad, x0:bbv["x"] + bbv["w"] + pad] = True
    sam_name = SAM_FOR_HOTSPOT.get((room_id, h["id"]), f"{room_id}_{h['id']}")
    sp_mask = SAM_DIR / f"{sam_name}.png"
    if sp_mask.exists():
        reach |= binary_dilation(np.array(Image.open(sp_mask).convert("L")) > 0, iterations=20)
    return reach


def _actor_zone(room_id: str, h: dict) -> np.ndarray:
    zone = np.zeros((720, 1280), dtype=bool)
    sam_name = SAM_FOR_HOTSPOT.get((room_id, h["id"]), f"{room_id}_{h['id']}")
    sp_mask = SAM_DIR / f"{sam_name}.png"
    if sp_mask.exists():
        zone |= binary_dilation(np.array(Image.open(sp_mask).convert("L")) > 0, iterations=10)
    rbv = h.get("sprite", {}).get("restBbox")
    if rbv:
        zone[rbv["y"]:rbv["y"] + rbv["h"], rbv["x"]:rbv["x"] + rbv["w"]] = True
    return zone


def step_chain_clean(room_id: str, room: dict, plate_arr: np.ndarray) -> None:
    """Step 2: Clean chain scenes — remove Gemini regeneration noise."""
    print(f"\n  [{room_id}] Chain-cleaning scenes...")
    zero = np.zeros((720, 1280), dtype=bool)
    actor_changed: dict[str, np.ndarray] = {}
    prev = np.array(Image.open(SCENES / f"{room_id}.png").convert("RGB").resize((1280, 720), Image.LANCZOS))
    seen: set[str] = set()
    prev_h = None

    for h in room["hotspots"]:
        sp = h.get("sprite", {})
        if not sp.get("sheet"):
            continue
        bpath = ROOT / "assets" / "game" / sp["beforeScene"]
        apath = ROOT / "assets" / "game" / sp["afterScene"]

        if str(bpath) not in seen and bpath.name != f"{room_id}.png":
            ah = prev_h if prev_h else h
            az = _actor_zone(room_id, ah) | actor_changed.get(ah["id"], zero)
            chg = _clean_one_scene(prev, bpath, _hotspot_reach(room_id, ah), az, plate_arr)
            actor_changed[ah["id"]] = actor_changed.get(ah["id"], zero)
            seen.add(str(bpath))
            print(f"    chain-clean {bpath.name}: noise {chg:.2f}")

        prev = np.array(Image.open(bpath).convert("RGB").resize((1280, 720), Image.LANCZOS))

        if str(apath) not in seen and (room_id, h["id"]) not in SKIP_HOTSPOTS:
            az = _actor_zone(room_id, h) | actor_changed.get(h["id"], zero)
            chg = _clean_one_scene(prev, apath, _hotspot_reach(room_id, h), az, plate_arr)
            actor_changed[h["id"]] = actor_changed.get(h["id"], zero)
            seen.add(str(apath))
            print(f"    chain-clean {apath.name}: noise {chg:.2f}")

        prev = np.array(Image.open(apath).convert("RGB").resize((1280, 720), Image.LANCZOS))
        prev_h = h


def _clean_one_scene(
    before_arr: np.ndarray,
    after_path: Path,
    reach: np.ndarray,
    actor_zone: np.ndarray,
    plate_arr: np.ndarray,
) -> float:
    after = np.array(Image.open(after_path).convert("RGB").resize((1280, 720), Image.LANCZOS))
    d = np.abs(after.astype(np.int16) - before_arr.astype(np.int16)).sum(-1)
    strong = binary_opening(d > 90, iterations=2)
    mask = binary_propagation(strong, mask=d > 24)
    mask = binary_opening(mask, iterations=2)
    mask = binary_fill_holes(mask)
    mask &= reach

    dfp = np.abs(before_arr.astype(np.int16) - plate_arr.astype(np.int16)).sum(-1)
    fp = binary_propagation(binary_opening(dfp > 90, iterations=2), mask=dfp > 24)
    mask &= ~(fp & ~actor_zone)
    mask = binary_dilation(mask, iterations=2)

    w_soft = np.array(
        Image.fromarray((mask * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(1.5))
    ).astype(np.float32) / 255.0
    out = before_arr.astype(np.float32) * (1 - w_soft[..., None]) + after.astype(np.float32) * w_soft[..., None]
    out = np.clip(out, 0, 255).astype(np.uint8)
    changed = float(np.abs(out.astype(np.float32) - after.astype(np.float32)).mean())
    Image.fromarray(out).save(after_path)
    return changed


def step_extract(room_id: str, room: dict, plate_img: np.ndarray, work_base: Path | None = None) -> None:
    """Step 3: Extract sprite sheets from video clips."""
    print(f"\n  [{room_id}] Extracting sprite sheets...")

    for h in room["hotspots"]:
        sp = h.get("sprite", {})
        if not sp.get("sheet"):
            continue
        hid = h["id"]
        name = f"{room_id}_{hid}"
        if (room_id, hid) in SKIP_HOTSPOTS:
            print(f"    [{name}] SKIP")
            continue

        clip = CLIPS_DIR / f"{name}.mp4"
        if not clip.exists():
            print(f"    [{name}] no clip, skipping")
            continue

        before_p = ROOT / "assets" / "game" / sp["beforeScene"]
        after_p = ROOT / "assets" / "game" / sp["afterScene"]
        before_img = np.array(Image.open(before_p).convert("RGB").resize((1280, 720), Image.LANCZOS))
        after_img = np.array(Image.open(after_p).convert("RGB").resize((1280, 720), Image.LANCZOS))

        work_dir = (work_base or Path("/tmp/escape_pipeline")) / name
        frames_dir = work_dir / "frames"
        if not frames_dir.exists() or len(list(frames_dir.glob("f_*.png"))) < 90:
            n = extract_frames(clip, frames_dir)
            print(f"    [{name}] {n} frames extracted")

        sam_name = SAM_FOR_HOTSPOT.get((room_id, hid), name)
        sam_p = SAM_DIR / f"{sam_name}.png"
        rest_mask = (np.array(Image.open(sam_p).convert("L")) > 0) if sam_p.exists() else None

        sib_excl = np.zeros((720, 1280), dtype=bool)
        sib_sil = np.zeros((720, 1280), dtype=bool)
        my_obj = HOTSPOT_OBJECT_MAP.get((room_id, hid))
        for other in room["hotspots"]:
            if other["id"] == hid:
                continue
            if my_obj and HOTSPOT_OBJECT_MAP.get((room_id, other["id"])) == my_obj:
                continue
            osp = other.get("sprite", {})
            ob = osp.get("bbox")
            if ob:
                sib_excl[ob["y"]:ob["y"] + ob["h"], ob["x"]:ob["x"] + ob["w"]] = True
            osam = SAM_FOR_HOTSPOT.get((room_id, other["id"]), f"{room_id}_{other['id']}")
            op = SAM_DIR / f"{osam}.png"
            if op.exists():
                sm = np.array(Image.open(op).convert("L")) > 0
                sib_excl |= sm
                sib_sil |= sm

        old_bb = sp["bbox"]
        new_bb = compute_content_bbox(
            frames_dir, before_img, after_img, old_bb, 96,
            rest_mask_scene=rest_mask, sibling_exclude=sib_excl,
            sibling_silhouettes=sib_sil,
        )
        print(f"    [{name}] bbox {old_bb} → {new_bb}")

        meta = extract_sprite_sheet(
            clip, before_p, after_p, new_bb,
            out_dir=SPRITES_DIR, name=name,
            work_dir=work_dir,
            normalize=True, keep_all_components=True, core_filter=False,
            min_cc_area=250, object_mask_scene=rest_mask, plate_img=plate_img,
        )
        sp["bbox"] = meta["bbox"]
        sp["cols"] = meta["cols"]
        sp["frameCount"] = meta["frameCount"]

    _save_manifest(_load_manifest() | {"escape": _load_manifest()["escape"]})


def step_rest_layers(room_filter: set[str] | None = None) -> None:
    """Step 4: Generate rest layers."""
    from gen.rest_layers import generate_all  # noqa: E402
    print("\n" + "=" * 60)
    print("  STEP 4: Rest layer generation")
    print("=" * 60)
    generate_all(room_filter=room_filter)


def step_sync_sprites(room_filter: set[str] | None = None) -> None:
    """Step 5: Sync sprite last frames to current afterScene images."""
    from gen.sync_sprite_frames import sync_all  # noqa: E402
    print("\n" + "=" * 60)
    print("  STEP 5: Sprite last-frame sync")
    print("=" * 60)
    sync_all(room_filter=room_filter)


def step_sibling_subtraction(room_id: str, room: dict) -> None:
    """Step 6: Subtract sibling rest layer masks from sprite sheets."""
    print(f"\n  [{room_id}] Sibling subtraction...")
    for h in room["hotspots"]:
        sp = h.get("sprite", {})
        if not sp.get("sheet"):
            continue
        z = subtract_sibling_masks(
            ROOT / "public" / sp["sheet"], sp["bbox"], room["hotspots"], h["id"],
            room_id, sp["cols"], sp["frameCount"], HOTSPOT_OBJECT_MAP,
        )
        print(f"    [{room_id}/{h['id']}] subtraction: {z} px")


def step_verify(room_filter: set[str] | None = None) -> int:
    """Step 7: Run verification. Returns failure count."""
    import subprocess
    print("\n" + "=" * 60)
    print("  STEP 7: Verification")
    print("=" * 60)
    cmd = [sys.executable, str(ROOT / "tools" / "verify_escape_chain.py")]
    if room_filter:
        cmd.extend(sorted(room_filter))
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    lines = result.stdout.strip().split("\n")
    for line in reversed(lines):
        if "failure" in line.lower():
            parts = line.split()
            for p in parts:
                if p.isdigit():
                    return int(p)
    return 0


def run_pipeline(
    room_filter: set[str] | None = None,
    steps: set[str] | None = None,
    work_base: Path | None = None,
    force_veo: bool = False,
) -> None:
    """Run the full escape pipeline (or selected steps)."""
    all_steps = {"veo", "plate", "chain", "extract", "rest", "sync", "subtract", "verify"}
    if steps is None:
        steps = all_steps

    m = _load_manifest()
    rooms = [r for r in m["escape"] if not room_filter or r["id"] in room_filter]

    t0 = time.time()

    if "veo" in steps:
        step_veo(room_filter=room_filter, force=force_veo)

    for room in rooms:
        rid = room["id"]
        print(f"\n{'=' * 60}")
        print(f"  Processing room: {rid}")
        print(f"{'=' * 60}")

        plate_img = None
        if "plate" in steps or "extract" in steps or "chain" in steps:
            plate_img = step_plate_restore(rid)

        if "chain" in steps and plate_img is not None:
            step_chain_clean(rid, room, plate_img.astype(np.int16))

        if "extract" in steps and plate_img is not None:
            step_extract(rid, room, plate_img, work_base=work_base)

        if "subtract" in steps:
            m = _load_manifest()
            room = next(r for r in m["escape"] if r["id"] == rid)
            step_sibling_subtraction(rid, room)

    if "rest" in steps:
        step_rest_layers(room_filter=room_filter)

    if "sync" in steps:
        step_sync_sprites(room_filter=room_filter)

    if "verify" in steps:
        failures = step_verify(room_filter=room_filter)
        elapsed = time.time() - t0
        print(f"\n{'=' * 60}")
        print(f"  Pipeline complete in {elapsed:.0f}s — {failures} verification failures")
        print(f"{'=' * 60}")


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="End-to-end escape pipeline")
    parser.add_argument("rooms", nargs="*", help="Room IDs (all if omitted)")
    parser.add_argument("--step", default="all",
                        help="Pipeline step(s): veo,plate,chain,extract,rest,sync,subtract,verify,all")
    parser.add_argument("--force-veo", action="store_true", help="Force Veo clip regeneration")
    parser.add_argument("--work-dir", help="Working directory for frame extraction")
    args = parser.parse_args()

    room_filter = set(args.rooms) if args.rooms else None
    steps = None if args.step == "all" else set(args.step.split(","))
    work_base = Path(args.work_dir) if args.work_dir else None

    run_pipeline(
        room_filter=room_filter,
        steps=steps,
        work_base=work_base,
        force_veo=args.force_veo,
    )


if __name__ == "__main__":
    main()
