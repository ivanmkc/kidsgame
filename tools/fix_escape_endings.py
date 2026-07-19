"""Append deterministic blend tails to existing escape clips.

For each escape animVideo clip, extracts the final frame, crossfades to
the exact after-scene PNG over 0.4s, then holds the PNG for 0.2s. The
result: the clip's last frames are the literal after-scene, pixel-perfect.

Does NOT regenerate from Veo — operates purely on the existing mp4s.

Usage: python3 tools/fix_escape_endings.py [--force]
  --force: overwrite even if clips already have blend tails
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCENES = ROOT / "assets" / "game"
CLIPS = ROOT / "public"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"
BLEND_DURATION = 0.4
HOLD_DURATION = 0.2


def derive_chain(manifest: dict) -> list[dict]:
    entries = []
    for room in manifest.get("escape", []):
        rid = room["id"]
        current_scene = room["image"]
        for h in room.get("hotspots", []):
            hid = h["id"]
            if h.get("animVideo"):
                before = current_scene
                if h.get("revealScene"):
                    after = h["revealScene"]
                elif h.get("afterScene"):
                    after = h["afterScene"]
                else:
                    after = current_scene
                entries.append({
                    "room": rid, "hotspot": hid,
                    "clip": h["animVideo"],
                    "before": before, "after": after,
                })
            if h.get("takenScene"):
                current_scene = h["takenScene"]
            elif h.get("afterScene"):
                current_scene = h["afterScene"]
            elif h.get("revealScene"):
                current_scene = h["revealScene"]
    return entries


def append_blend_tail(clip_mp4: Path, after_png: Path) -> bool:
    """Render blend+hold frames in NumPy (pixel-exact linear blend), encode
    at CRF 10, then stream-copy concat with the original clip."""
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)

        final_frame = td / "final.png"
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-sseof", "-0.05",
             "-i", str(clip_mp4), "-frames:v", "1", "-update", "1",
             str(final_frame)],
            check=True, timeout=30)
        if not final_frame.exists():
            return False

        fps_str = subprocess.run(
            ["ffprobe", "-v", "quiet", "-select_streams", "v:0",
             "-show_entries", "stream=r_frame_rate",
             "-of", "csv=p=0", str(clip_mp4)],
            capture_output=True, text=True, timeout=20).stdout.strip()
        num, den = fps_str.split("/") if "/" in fps_str else (fps_str, "1")
        fps = round(int(num) / int(den))
        if fps < 10:
            fps = 24

        import numpy as np
        from PIL import Image as PILImage
        final_arr = np.array(PILImage.open(final_frame).convert("RGB").resize((1280, 720)), dtype=np.float32)
        after_arr = np.array(PILImage.open(after_png).convert("RGB").resize((1280, 720)), dtype=np.float32)

        frames_dir = td / "frames"
        frames_dir.mkdir()
        n_blend = max(1, round(BLEND_DURATION * fps))
        n_hold = max(1, round(HOLD_DURATION * fps))

        for i in range(n_blend):
            t = (i + 1) / n_blend
            blended = (final_arr * (1 - t) + after_arr * t).clip(0, 255).astype(np.uint8)
            PILImage.fromarray(blended).save(str(frames_dir / f"f_{i:04d}.png"))
        after_uint8 = after_arr.astype(np.uint8)
        for i in range(n_hold):
            PILImage.fromarray(after_uint8).save(str(frames_dir / f"f_{n_blend + i:04d}.png"))

        tail = td / "tail.mp4"
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error",
             "-framerate", str(fps),
             "-i", str(frames_dir / "f_%04d.png"),
             "-c:v", "libx264", "-crf", "5", "-preset", "medium",
             "-pix_fmt", "yuv420p",
             str(tail)],
            check=True, timeout=60)
        if not tail.exists():
            return False

        concat_list = td / "concat.txt"
        concat_list.write_text(
            f"file '{clip_mp4.resolve()}'\nfile '{tail.resolve()}'\n")

        output = td / "output.mp4"
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error",
             "-f", "concat", "-safe", "0", "-i", str(concat_list),
             "-c", "copy", "-movflags", "+faststart",
             str(output)],
            check=True, timeout=60)
        if not output.exists() or output.stat().st_size < 1000:
            return False

        shutil.move(str(output), str(clip_mp4))
        return True


def main() -> int:
    force = "--force" in sys.argv
    m = json.loads(MANIFEST.read_text())
    chain = derive_chain(m)
    ok, fail = 0, 0

    for entry in chain:
        tag = f"{entry['room']}/{entry['hotspot']}"
        clip_path = CLIPS / entry["clip"]
        after_path = SCENES / entry["after"]

        if not clip_path.exists():
            print(f"  {tag}: SKIP (clip missing)")
            fail += 1
            continue
        if not after_path.exists():
            print(f"  {tag}: SKIP (after scene missing: {entry['after']})")
            fail += 1
            continue

        print(f"  {tag}: appending blend tail -> {entry['after']}")
        if append_blend_tail(clip_path, after_path):
            print(f"  {tag}: OK ({clip_path.stat().st_size // 1024}KB)")
            ok += 1
        else:
            print(f"  {tag}: FAILED")
            fail += 1

    print(f"\n{ok} clips fixed, {fail} failures")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
