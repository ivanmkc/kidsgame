"""Escape chain-continuity gate: every animation hotspot must end on its
after-scene, pixel-matched.

Two paths:
  1. animVideo (legacy clips): extract first/final frames via ffmpeg,
     compare against before/after scenes with yuv420p-corrected L1 metric.
  2. sprite (rotoscoped sheets): composite base + patch + final sheet frame
     at the hotspot bbox, compare against the after-scene ROI.

Derives the before/after mapping programmatically from the manifest chain
(hotspot order determines the linear state progression per room).

Thresholds:
  animVideo first-vs-before : mean < 35, frac30 < 20%
  animVideo final-vs-after  : mean < 3, frac30 < 0.5%
  animVideo pre-blend        : mean < 20
  sprite composed-vs-after  : mean < 2, frac30 < 0.5%

Usage: python3 tools/verify_escape_chain.py
Exit nonzero on any failure (ship.sh gates on this).
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SCENES = ROOT / "assets" / "game"
CLIPS = ROOT / "public"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"

THRESH_FIRST_MEAN = 35
THRESH_FIRST_FRAC = 0.20
THRESH_FINAL_MEAN = 3
THRESH_FINAL_FRAC = 0.005
THRESH_PREBLEND_MEAN = 20
THRESH_SPRITE_MEAN = 2
THRESH_SPRITE_FRAC = 0.005


def extract_frame(mp4: Path, select_expr: str, out_png: Path) -> bool:
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp4),
         "-vf", f"select='{select_expr}',scale=1280:720", "-frames:v", "1",
         "-update", "1", str(out_png)],
        capture_output=True, timeout=30)
    return out_png.exists() and out_png.stat().st_size > 0


def _yuv420p_ref(png_path: Path, cache: dict[str, np.ndarray]) -> np.ndarray:
    """Return the RGB array of a PNG after round-tripping through yuv420p,
    matching what a lossless H.264 encode would produce. Cached per path."""
    key = str(png_path)
    if key not in cache:
        with tempfile.TemporaryDirectory() as td:
            mp4 = Path(td) / "ref.mp4"
            dec = Path(td) / "ref.png"
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error",
                 "-loop", "1", "-framerate", "24", "-t", "0.05",
                 "-i", str(png_path),
                 "-c:v", "libx264", "-crf", "0", "-pix_fmt", "yuv420p",
                 str(mp4)],
                check=True, timeout=20)
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error",
                 "-i", str(mp4), "-frames:v", "1", "-update", "1", str(dec)],
                check=True, timeout=20)
            cache[key] = np.array(Image.open(dec).convert("RGB").resize((1280, 720)), dtype=np.int16)
    return cache[key]


def compare(a_path: Path, b_path: Path, yuv_ref_cache: dict | None = None) -> tuple[float, float]:
    a = np.array(Image.open(a_path).convert("RGB").resize((1280, 720)), dtype=np.int16)
    if yuv_ref_cache is not None:
        b = _yuv420p_ref(b_path, yuv_ref_cache)
    else:
        b = np.array(Image.open(b_path).convert("RGB").resize((1280, 720)), dtype=np.int16)
    delta = np.abs(a - b).sum(axis=-1)
    mean_d = float(delta.mean())
    frac30 = float((delta > 30).mean())
    return mean_d, frac30


def get_duration(mp4: Path) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(mp4)],
        capture_output=True, text=True, timeout=20)
    return float(r.stdout.strip())


def derive_chain(manifest: dict) -> list[dict]:
    entries = []
    for room in manifest.get("escape", []):
        rid = room["id"]
        current_scene = room["image"]
        for h in room.get("hotspots", []):
            hid = h["id"]
            has_anim = h.get("animVideo") or h.get("sprite")
            if has_anim:
                before = current_scene
                if h.get("revealScene"):
                    after = h["revealScene"]
                elif h.get("afterScene"):
                    after = h["afterScene"]
                else:
                    after = current_scene
                entry: dict = {
                    "room": rid, "hotspot": hid,
                    "before": before, "after": after,
                }
                if h.get("sprite"):
                    entry["sprite"] = h["sprite"]
                if h.get("animVideo"):
                    entry["clip"] = h["animVideo"]
                entries.append(entry)
            if h.get("takenScene"):
                current_scene = h["takenScene"]
            elif h.get("afterScene"):
                current_scene = h["afterScene"]
            elif h.get("revealScene"):
                current_scene = h["revealScene"]
    return entries


def verify_sprite(entry: dict) -> tuple[str, float, float]:
    """Verify a sprite hotspot: composite base + patch + final sheet frame
    at the bbox, compare against the after-scene ROI.
    Returns (result_str, mean_delta, frac30)."""
    sp = entry["sprite"]
    before_path = SCENES / entry["before"]
    after_path = SCENES / entry["after"]
    sheet_path = CLIPS / sp["sheet"]
    patch_path = CLIPS / sp["patch"] if sp.get("patch") else None
    bbox = sp["bbox"]

    for p, label in [(before_path, "before"), (after_path, "after"), (sheet_path, "sheet")]:
        if not p.exists():
            return f"MISSING {label}: {p}", 999, 1
    if patch_path and not patch_path.exists():
        return f"MISSING patch: {patch_path}", 999, 1

    base = np.array(Image.open(before_path).convert("RGB").resize((1280, 720)), dtype=np.uint8)
    after = np.array(Image.open(after_path).convert("RGB").resize((1280, 720)), dtype=np.uint8)
    sheet = np.array(Image.open(sheet_path))  # RGBA

    cols = sp["cols"]
    fc = sp["frameCount"]
    frame_w = sheet.shape[1] // cols
    rows = (fc + cols - 1) // cols
    frame_h = sheet.shape[0] // rows
    last_col = (fc - 1) % cols
    last_row = (fc - 1) // cols
    last_frame = sheet[last_row * frame_h:(last_row + 1) * frame_h,
                       last_col * frame_w:(last_col + 1) * frame_w]

    x, y, w, h = bbox["x"], bbox["y"], bbox["w"], bbox["h"]
    roi = base[y:y + h, x:x + w].copy().astype(np.float32)

    if patch_path:
        patch = np.array(Image.open(patch_path).convert("RGB").resize((w, h)), dtype=np.float32)
        roi[:] = patch

    alpha = last_frame[:, :, 3:4].astype(np.float32) / 255.0
    roi = roi * (1 - alpha) + last_frame[:, :, :3].astype(np.float32) * alpha
    roi = np.clip(roi, 0, 255).astype(np.uint8)

    target = after[y:y + h, x:x + w]
    delta = np.abs(roi.astype(np.int16) - target.astype(np.int16))
    mean_d = float(delta.mean())
    frac30 = float((delta.sum(axis=-1) > 30).mean())

    ok = mean_d < THRESH_SPRITE_MEAN and frac30 < THRESH_SPRITE_FRAC
    return "PASS" if ok else "FAIL", mean_d, frac30


def main() -> int:
    m = json.loads(MANIFEST.read_text())
    chain = derive_chain(m)
    if not chain:
        print("No escape entries found in manifest.")
        return 1

    sprite_entries = [e for e in chain if "sprite" in e]
    clip_entries = [e for e in chain if "clip" in e and "sprite" not in e]

    fails = 0

    if sprite_entries:
        print(f"{'sprite':<36} {'mean':>8} {'frac30':>8} {'result':>8}")
        print("-" * 64)
        for entry in sprite_entries:
            tag = f"{entry['room']}/{entry['hotspot']}"
            result, mean_d, frac30 = verify_sprite(entry)
            if result != "PASS":
                fails += 1
                if result == "FAIL":
                    result = f"FAIL m={mean_d:.2f} f={frac30:.4f}"
            print(f"{tag:<36} {mean_d:>8.2f} {frac30:>8.4f} {result}")
        print()

    if clip_entries:
        yuv_cache: dict[str, np.ndarray] = {}
        print(f"{'clip':<36} {'1st_mean':>8} {'1st_f30':>8} {'fin_mean':>8} {'fin_f30':>8} {'pre_mean':>8} {'result':>8}")
        print("-" * 100)

        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            for entry in clip_entries:
                clip_path = CLIPS / entry["clip"]
                before_path = SCENES / entry["before"]
                after_path = SCENES / entry["after"]
                tag = f"{entry['room']}/{entry['hotspot']}"

                if not clip_path.exists():
                    print(f"{tag:<36} {'MISSING CLIP':>56}")
                    fails += 1
                    continue
                if not before_path.exists():
                    print(f"{tag:<36} {'MISSING BEFORE: ' + entry['before']:>56}")
                    fails += 1
                    continue
                if not after_path.exists():
                    print(f"{tag:<36} {'MISSING AFTER: ' + entry['after']:>56}")
                    fails += 1
                    continue

                first_png = td / f"{entry['room']}_{entry['hotspot']}_first.png"
                final_png = td / f"{entry['room']}_{entry['hotspot']}_final.png"
                pre_png = td / f"{entry['room']}_{entry['hotspot']}_pre.png"

                extract_frame(clip_path, "eq(n\\,0)", first_png)
                dur = get_duration(clip_path)
                pre_t = max(0, dur - 0.3)
                extract_frame(clip_path, f"gte(t\\,{dur - 0.05})", final_png)
                extract_frame(clip_path, f"between(t\\,{pre_t}\\,{pre_t + 0.1})", pre_png)

                first_mean, first_frac = compare(first_png, before_path, yuv_cache) if first_png.exists() else (999, 1)
                final_mean, final_frac = compare(final_png, after_path, yuv_cache) if final_png.exists() else (999, 1)
                pre_mean = compare(pre_png, after_path, yuv_cache)[0] if pre_png.exists() else 999

                ok_first = first_mean < THRESH_FIRST_MEAN and first_frac < THRESH_FIRST_FRAC
                ok_final = final_mean < THRESH_FINAL_MEAN and final_frac < THRESH_FINAL_FRAC
                ok_pre = pre_mean < THRESH_PREBLEND_MEAN

                result = "PASS" if (ok_first and ok_final and ok_pre) else "FAIL"
                if result == "FAIL":
                    fails += 1
                    details = []
                    if not ok_first:
                        details.append(f"1st(m={first_mean:.1f},f={first_frac:.3f})")
                    if not ok_final:
                        details.append(f"fin(m={final_mean:.1f},f={final_frac:.3f})")
                    if not ok_pre:
                        details.append(f"pre(m={pre_mean:.1f})")
                    result += " " + "+".join(details)

                print(f"{tag:<36} {first_mean:>8.2f} {first_frac:>8.4f} {final_mean:>8.2f} {final_frac:>8.4f} {pre_mean:>8.2f} {result}")
        print()

    total = len(sprite_entries) + len(clip_entries)
    print(f"{total} entries checked ({len(sprite_entries)} sprite, {len(clip_entries)} clip), {fails} failures")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
