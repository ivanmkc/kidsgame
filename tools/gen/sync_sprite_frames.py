"""Sync sprite sheet last frames to current afterScene images.

When afterScene images are chain-cleaned after sprite extraction, the sprite's
last frame (held state) diverges from the afterScene. This tool patches the
last frame's RGB to match the current afterScene crop (preserving the alpha
mask from extraction).

GEPA finding: sprite composed-vs-after failures were 100% caused by temporal
mismatch (afterScene modified post-extraction), not matte or composition
quality. Patching the last frame RGB eliminates all 7 failures.

Usage:
    python3 tools/gen/sync_sprite_frames.py [--room ROOM] [--dry-run]
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
SPRITES = ROOT / "public"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"

FRAC30_THRESH = 0.005


def sync_all(room_filter: str | None = None, dry_run: bool = False) -> list[dict]:
    manifest = json.loads(MANIFEST.read_text())
    results = []

    for room in manifest.get("escape", []):
        room_id = room["id"]
        if room_filter and room_id != room_filter:
            continue

        for h in room.get("hotspots", []):
            sp = h.get("sprite", {})
            if not sp.get("sheet") or not sp.get("afterScene"):
                continue

            sheet_path = SPRITES / sp["sheet"]
            after_path = ROOT / "assets" / "game" / sp["afterScene"]
            if not sheet_path.exists() or not after_path.exists():
                continue

            hid = h["id"]
            bbox = sp["bbox"]
            x, y, w, bh = bbox["x"], bbox["y"], bbox["w"], bbox["h"]

            sheet = np.array(Image.open(sheet_path))
            after = np.array(Image.open(after_path).convert("RGB"))
            after_crop = after[y : y + bh, x : x + w]

            cols, fc = sp["cols"], sp["frameCount"]
            fw = sheet.shape[1] // cols
            rows = (fc + cols - 1) // cols
            fh = sheet.shape[0] // rows
            lc, lr = (fc - 1) % cols, (fc - 1) // cols
            last_frame = sheet[lr * fh : (lr + 1) * fh, lc * fw : (lc + 1) * fw]

            opaque = last_frame[:, :, 3] >= 250
            if opaque.any():
                delta = np.abs(
                    last_frame[:, :, :3][opaque].astype(np.int16)
                    - after_crop[opaque].astype(np.int16)
                )
                old_frac30 = float((delta.sum(axis=-1) > 30).mean())
            else:
                old_frac30 = 0.0

            last_frame[:, :, :3] = after_crop

            status = "FIXED" if old_frac30 > FRAC30_THRESH else "OK"
            print(f"  {status} {room_id}/{hid}: frac30 {old_frac30:.4f} -> 0.0000")

            if not dry_run:
                Image.fromarray(sheet).save(
                    str(sheet_path), "webp", lossless=True, method=6
                )

            results.append(
                {
                    "name": f"{room_id}_{hid}",
                    "old_frac30": round(old_frac30, 4),
                    "fixed": old_frac30 > FRAC30_THRESH,
                }
            )

    return results


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Sync sprite last frames to current afterScene"
    )
    parser.add_argument("--room", help="Only process this room")
    parser.add_argument("--dry-run", action="store_true", help="Measure without writing")
    args = parser.parse_args()

    print("Syncing sprite last frames to current afterScene images")
    print()

    results = sync_all(room_filter=args.room, dry_run=args.dry_run)

    fixed = sum(1 for r in results if r["fixed"])
    print(f"\n{'=' * 50}")
    print(f"Processed {len(results)} sprite sheets")
    print(f"  {fixed} fixed (were stale), {len(results) - fixed} already in sync")
