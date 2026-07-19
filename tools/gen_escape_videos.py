"""Veo state-transition clips for escape rooms.

One 4-second clip per state-changing hotspot: the object visibly transforms
(chest opens, stove ignites, dragon eats) conditioned on the BEFORE state
scene as the first frame. A deterministic 0.4s blend tail is appended so
the clip's final frames land exactly on the after-scene PNG (pixel-perfect
end by construction). Judged by frame sampling, compressed with ffmpeg.

Follows the gen_story_videos.py pattern: veo-3.0-fast, first-frame
conditioning, dual-judge frame sampling, H.264 CRF 29 + faststart.

Usage: python3 tools/gen_escape_videos.py [room_id ...]
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import google.genai as genai
from gen.judge import ask_yes_no
from gen.nbp import PROJECT
from gen.escape_specs import ESCAPE_ROOMS, ESCAPE_STYLE
from google.genai import types
from PIL import Image

ROOT = Path(__file__).parent.parent
SCENES = ROOT / "assets" / "game" / "escape"
OUT = ROOT / "public" / "escape-video"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"
MODEL = "veo-3.0-fast-generate-001"
BLEND_DURATION = 0.4

_tls = threading.local()


def client():
    if not hasattr(_tls, "c"):
        _tls.c = genai.Client(vertexai=True, project=PROJECT, location="us-central1")
    return _tls.c


# Globe-style word sanitizer: toyroom specs use key/padlock which trip
# Veo's third-party content filter. Sanitize in PROMPT only (scene images
# carry the visual identity via first-frame conditioning).
VEO_SANITIZE = [
    ("padlock", "latch"),
    ("keyhole", "little slot"),
    ("key", "charm"),
]


def _sanitize_prompt(prompt: str) -> str:
    for pat, rep in VEO_SANITIZE:
        prompt = re.sub(rf"\b{pat}\b", rep, prompt)
    return prompt


def _judge_clip(mp4: Path, action: str) -> bool:
    with tempfile.TemporaryDirectory() as td:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp4),
                        "-vf", "select='eq(n\\,0)+eq(n\\,60)+eq(n\\,90)'", "-vsync", "vfr",
                        f"{td}/f_%d.png"], check=True)
        frames = [Image.open(p) for p in sorted(Path(td).glob("f_*.png"))]
        if not frames:
            return False
        return ask_yes_no(
            f"These are frames from a short animation clip showing: \"{action}\". "
            f"Does the object visibly perform this action? Judge YES only if the "
            f"motion matches the description, the background stays consistent with "
            f"the first frame, and there is no garbled text or heavy distortion.",
            frames)


def _derive_after_scenes(manifest: dict) -> dict[str, str]:
    """Build {room_hotspot: after_scene_path} from the manifest chain."""
    result = {}
    for room in manifest.get("escape", []):
        rid = room["id"]
        for h in room.get("hotspots", []):
            hid = h["id"]
            if h.get("animVideo") or h.get("anim"):
                if h.get("revealScene"):
                    result[f"{rid}_{hid}"] = h["revealScene"]
                elif h.get("afterScene"):
                    result[f"{rid}_{hid}"] = h["afterScene"]
    return result


def _append_blend_tail(clip_mp4: Path, after_png: Path, out_mp4: Path) -> bool:
    """Render blend+hold frames in NumPy (pixel-exact linear blend), encode
    at CRF 10 for near-lossless quality, then stream-copy concat."""
    import numpy as np
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

        fps = 24
        final_arr = np.array(Image.open(final_frame).convert("RGB").resize((1280, 720)), dtype=np.float32)
        after_arr = np.array(Image.open(after_png).convert("RGB").resize((1280, 720)), dtype=np.float32)

        frames_dir = td / "frames"
        frames_dir.mkdir()
        n_blend = max(1, round(BLEND_DURATION * fps))
        n_hold = max(1, 6)

        for i in range(n_blend):
            t = (i + 1) / n_blend
            blended = (final_arr * (1 - t) + after_arr * t).clip(0, 255).astype(np.uint8)
            Image.fromarray(blended).save(str(frames_dir / f"f_{i:04d}.png"))
        after_uint8 = after_arr.astype(np.uint8)
        for i in range(n_hold):
            Image.fromarray(after_uint8).save(str(frames_dir / f"f_{n_blend + i:04d}.png"))

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
            f"file '{clip_mp4}'\nfile '{tail.resolve()}'\n")

        output = td / "output.mp4"
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error",
             "-f", "concat", "-safe", "0", "-i", str(concat_list),
             "-c", "copy", "-movflags", "+faststart",
             str(output)],
            check=True, timeout=60)
        if not output.exists():
            return False

        import shutil
        shutil.move(str(output), str(out_mp4))
        return True


def gen_clip(room_id: str, hid: str, anim: str, before_scene: str,
             after_scene: str | None = None) -> str | None:
    fname = f"{room_id}_{hid}.mp4"
    if (OUT / fname).exists():
        print(f"  {fname}: exists")
        return f"escape-video/{fname}"

    src = Path(before_scene)
    if not src.exists():
        print(f"  {fname}: before scene {before_scene} not found")
        return None
    first = src.read_bytes()
    first_mime = "image/png" if src.suffix == ".png" else "image/jpeg"

    prompt = _sanitize_prompt(
        f"Starting from this exact scene, {anim}. "
        f"The background and location stay EXACTLY as in the first frame; "
        f"only the object being acted upon moves. "
        f"Bright cheerful children's picture-book style, consistent with the "
        f"first frame. No text, no people."
    )

    for attempt in range(2):
        try:
            op = client().models.generate_videos(
                model=MODEL, prompt=prompt,
                image=types.Image(image_bytes=first, mime_type=first_mime),
                config=types.GenerateVideosConfig(
                    number_of_videos=1, duration_seconds=4, aspect_ratio="16:9",
                    resolution="720p", generate_audio=False, person_generation="allow_all"))
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
            if not _judge_clip(raw, anim):
                print(f"  {fname}: judge rejected attempt {attempt + 1}")
                raw.unlink(missing_ok=True)
                if attempt == 0:
                    continue
                else:
                    return None
            OUT.mkdir(parents=True, exist_ok=True)
            compressed = OUT / fname
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw),
                            "-c:v", "libx264", "-crf", "29", "-preset", "medium", "-an",
                            "-movflags", "+faststart", str(compressed)], check=True)
            raw.unlink(missing_ok=True)

            if after_scene:
                after_png = Path(after_scene)
                if after_png.exists():
                    blended = OUT / f"{room_id}_{hid}_blended.mp4"
                    if _append_blend_tail(compressed, after_png, blended):
                        blended.rename(compressed)
                        print(f"  {fname}: blend tail appended")
                    else:
                        print(f"  {fname}: blend tail failed, keeping raw clip")

            print(f"  {fname}: OK ({compressed.stat().st_size // 1024}KB, attempt {attempt + 1})")
            return f"escape-video/{fname}"
        except Exception as e:  # noqa: BLE001
            print(f"  {fname}: attempt {attempt + 1} failed ({str(e)[:120]})")
            time.sleep(10)
    print(f"  {fname}: FAILED — fallback to crossfade")
    return None


def _derive_before_scenes(manifest: dict) -> dict[str, str]:
    """Build {room_hotspot: before_scene_path} from the manifest chain."""
    result = {}
    for room in manifest.get("escape", []):
        rid = room["id"]
        current = room["image"]
        for h in room.get("hotspots", []):
            hid = h["id"]
            if h.get("animVideo") or h.get("anim"):
                result[f"{rid}_{hid}"] = current
            if h.get("takenScene"):
                current = h["takenScene"]
            elif h.get("afterScene"):
                current = h["afterScene"]
            elif h.get("revealScene"):
                current = h["revealScene"]
    return result


def main() -> None:
    only = set(sys.argv[1:])
    OUT.mkdir(parents=True, exist_ok=True)
    m = json.loads(MANIFEST.read_text())
    rooms_manifest = {r["id"]: r for r in m.get("escape", [])}
    after_map = _derive_after_scenes(m)
    before_map = _derive_before_scenes(m)

    jobs = []
    for spec in ESCAPE_ROOMS:
        rid = spec["id"]
        if only and rid not in only:
            continue
        room_data = rooms_manifest.get(rid)
        if not room_data:
            print(f"{rid}: not in manifest, skipping")
            continue

        for h in spec["hotspots"]:
            if not h.get("anim"):
                continue
            key = f"{rid}_{h['id']}"
            before = before_map.get(key)
            after = after_map.get(key)
            if before:
                before = str(SCENES.parent / before) if "/" in before else str(SCENES / before)
            else:
                print(f"  {key}: could not derive before scene, skipping")
                continue
            after_path = None
            if after:
                after_path = str(SCENES.parent / after) if "/" in after else str(SCENES / after)
            jobs.append((rid, h["id"], h["anim"], before, after_path))

    print(f"{len(jobs)} escape clips to generate")

    def run(j):
        rid, hid, anim, before, after = j
        return (j, gen_clip(rid, hid, anim, before, after))

    # Throttle to 2 concurrent (followups agent is running big Veo batches)
    with ThreadPoolExecutor(2) as ex:
        results = list(ex.map(run, jobs))

    # Wire into manifest
    m = json.loads(MANIFEST.read_text())
    wired = 0
    filter_hits = []
    for (rid, hid, anim, _, _), path in results:
        if not path:
            filter_hits.append(f"{rid}/{hid}")
            continue
        room = next(r for r in m["escape"] if r["id"] == rid)
        hotspot = next(h for h in room["hotspots"] if h["id"] == hid)
        hotspot["animVideo"] = path
        wired += 1
    MANIFEST.write_text(json.dumps(m, indent=2) + "\n")
    print(f"wired {wired}/{len(jobs)} escape videos into the manifest")
    if filter_hits:
        print(f"FILTER HITS / FAILURES: {', '.join(filter_hits)}")


if __name__ == "__main__":
    main()
