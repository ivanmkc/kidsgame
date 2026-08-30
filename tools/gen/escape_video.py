"""Veo escape animation clips — generate, judge-gate, and compress.

Generates a 6-second Veo 3.0 Fast clip for each animated escape hotspot,
conditioned on the before-scene image as the first frame. Clips are
judge-gated (frame sampling) and compressed with ffmpeg.

Usage:
    python3 tools/gen/escape_video.py [room_id ...] [--force]
    python3 tools/gen/escape_video.py dragoncave stove --force
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

import google.genai as genai
from google.genai import types
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent.parent))
from gen.escape_specs import ESCAPE_ROOMS, ESCAPE_STYLE  # noqa: E402
from gen.judge import ask_yes_no  # noqa: E402
from gen.nbp import PROJECT  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent.parent
SCENES = ROOT / "assets" / "game" / "escape"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"
OUT = ROOT / "public" / "escape-video"
MODEL = "veo-3.1-fast-generate-001"

_tls = threading.local()


def client():
    if not hasattr(_tls, "c"):
        _tls.c = genai.Client(vertexai=True, project=PROJECT, location="us-central1")
    return _tls.c


def _before_scene(room_id: str, hotspot_id: str) -> Path:
    """Resolve the before-scene image for a hotspot from the manifest."""
    m = json.loads(MANIFEST.read_text())
    room = next((r for r in m["escape"] if r["id"] == room_id), None)
    if not room:
        return SCENES / f"{room_id}.png"
    h = next((h for h in room["hotspots"] if h["id"] == hotspot_id), None)
    if h and h.get("sprite", {}).get("beforeScene"):
        return ROOT / "assets" / "game" / h["sprite"]["beforeScene"]
    return SCENES / f"{room_id}.png"


def _build_prompt(room_spec: dict, hotspot_spec: dict) -> str:
    """Build the Veo prompt for an escape hotspot animation."""
    anim = hotspot_spec.get("anim", "")
    if not anim:
        return ""
    return (
        f"{ESCAPE_STYLE} Starting from this exact scene, animate: {anim}. "
        f"The animation should be smooth and gentle, suitable for young children. "
        f"Keep the background and all other objects EXACTLY as they appear in the "
        f"first frame — only the interacted object should move. "
        f"CRITICAL: The camera must stay PERFECTLY LOCKED — absolutely no zoom, "
        f"no pan, no dolly, no camera movement of any kind. The framing and field "
        f"of view must be identical in every frame. Objects must not change size "
        f"or deform — only animate their motion. "
        f"No text, no letters. Bright and cheerful."
    )


def _judge_clip(mp4: Path, hotspot_spec: dict) -> bool:
    """Judge an escape clip by sampling 3 frames."""
    anim = hotspot_spec.get("anim", "")
    spot = hotspot_spec.get("spot", "object")
    with tempfile.TemporaryDirectory() as td:
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp4),
             "-vf", "select='eq(n\\,0)+eq(n\\,60)+eq(n\\,115)'", "-vsync", "vfr",
             f"{td}/f_%d.png"],
            check=True, timeout=30,
        )
        frames = [Image.open(p) for p in sorted(Path(td).glob("f_*.png"))]
        if not frames:
            return False
    return ask_yes_no(
        f"These are frames from a short animation of a children's escape room. "
        f"The animation should show: {anim}. The {spot} is the focus. "
        f"Judge YES only if the animation matches the description, the scene "
        f"stays composed (background doesn't warp), objects are recognizable, "
        f"and there is no garbled text or heavy distortion.",
        frames,
    )


def gen_clip(
    room_spec: dict,
    hotspot_spec: dict,
    force: bool = False,
    max_attempts: int = 2,
) -> str | None:
    """Generate a single escape animation clip. Returns relative path or None."""
    room_id = room_spec["id"]
    hotspot_id = hotspot_spec["id"]
    fname = f"{room_id}_{hotspot_id}.mp4"

    if (OUT / fname).exists() and not force:
        print(f"  {fname}: exists, skipping")
        return f"escape-video/{fname}"

    prompt = _build_prompt(room_spec, hotspot_spec)
    if not prompt:
        return None

    before = _before_scene(room_id, hotspot_id)
    if not before.exists():
        print(f"  {fname}: before-scene {before} not found", file=sys.stderr)
        return None

    first_bytes = before.read_bytes()
    mime = "image/png" if before.suffix == ".png" else "image/jpeg"

    for attempt in range(max_attempts):
        try:
            op = client().models.generate_videos(
                model=MODEL, prompt=prompt,
                image=types.Image(image_bytes=first_bytes, mime_type=mime),
                config=types.GenerateVideosConfig(
                    number_of_videos=1, duration_seconds=6, aspect_ratio="16:9",
                    resolution="720p", generate_audio=False,
                    person_generation="allow_all",
                    negative_prompt=(
                        "camera zoom, camera movement, camera pan, camera dolly, "
                        "tracking shot, scale change, perspective change, "
                        "field of view change, object deformation"
                    ),
                ),
            )
            t0 = time.time()
            while not op.done:
                time.sleep(12)
                op = client().operations.get(op)
                if time.time() - t0 > 900:
                    raise TimeoutError("LRO timeout")
            if op.error:
                raise RuntimeError(str(op.error)[:150])
            v = (op.response or op.result).generated_videos[0].video
            data = v.video_bytes
            with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tf:
                tf.write(data)
                raw = Path(tf.name)

            if not _judge_clip(raw, hotspot_spec):
                print(f"  {fname}: judge rejected attempt {attempt + 1}")
                raw.unlink(missing_ok=True)
                if attempt < max_attempts - 1:
                    continue
                print(f"  {fname}: keeping last attempt despite judge rejection")

            OUT.mkdir(parents=True, exist_ok=True)
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw),
                 "-c:v", "libx264", "-crf", "29", "-preset", "medium", "-an",
                 "-movflags", "+faststart", str(OUT / fname)],
                check=True, timeout=60,
            )
            raw.unlink(missing_ok=True)
            size_kb = (OUT / fname).stat().st_size // 1024
            print(f"  {fname}: OK ({size_kb}KB, attempt {attempt + 1})")
            return f"escape-video/{fname}"
        except Exception as e:
            print(f"  {fname}: attempt {attempt + 1} failed ({str(e)[:120]})")
            time.sleep(10)

    print(f"  {fname}: FAILED")
    return None


def gen_room(room_spec: dict, force: bool = False, hotspot_filter: set[str] | None = None) -> dict[str, str]:
    """Generate clips for all animated hotspots in a room. Returns {hotspot_id: relative_path}."""
    room_id = room_spec["id"]
    results: dict[str, str] = {}

    for h in room_spec["hotspots"]:
        if not h.get("anim"):
            continue
        if hotspot_filter and h["id"] not in hotspot_filter:
            continue
        print(f"\n  [{room_id}/{h['id']}]")
        path = gen_clip(room_spec, h, force=force)
        if path:
            results[h["id"]] = path

    return results


def gen_all(
    room_filter: set[str] | None = None,
    hotspot_filter: set[str] | None = None,
    force: bool = False,
) -> dict[str, dict[str, str]]:
    """Generate clips for all rooms. Returns {room_id: {hotspot_id: path}}."""
    OUT.mkdir(parents=True, exist_ok=True)
    results: dict[str, dict[str, str]] = {}

    for spec in ESCAPE_ROOMS:
        if room_filter and spec["id"] not in room_filter:
            continue
        print(f"\n{'=' * 60}")
        print(f"  {spec['id']}")
        print(f"{'=' * 60}")
        room_results = gen_room(spec, force=force, hotspot_filter=hotspot_filter)
        if room_results:
            results[spec["id"]] = room_results

    return results


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Generate Veo escape animation clips")
    parser.add_argument("targets", nargs="*", help="room_id or room_id/hotspot_id")
    parser.add_argument("--force", action="store_true", help="Regenerate existing clips")
    parser.add_argument("--list", action="store_true", help="List hotspots with anim prompts")
    args = parser.parse_args()

    if args.list:
        for spec in ESCAPE_ROOMS:
            for h in spec["hotspots"]:
                anim = h.get("anim", "")
                exists = (OUT / f"{spec['id']}_{h['id']}.mp4").exists()
                status = "EXISTS" if exists else "MISSING"
                if anim:
                    print(f"  [{status}] {spec['id']}/{h['id']}: {anim[:70]}")
        return

    rooms: set[str] = set()
    hotspots: set[str] = set()
    for t in args.targets:
        if "/" in t:
            room, hs = t.split("/", 1)
            rooms.add(room)
            hotspots.add(hs)
        else:
            rooms.add(t)

    results = gen_all(
        room_filter=rooms or None,
        hotspot_filter=hotspots or None,
        force=args.force,
    )

    total = sum(len(v) for v in results.values())
    print(f"\n{total} clips generated across {len(results)} rooms")


if __name__ == "__main__":
    main()
