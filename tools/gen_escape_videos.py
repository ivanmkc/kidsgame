"""Veo state-transition clips for escape rooms.

One 4-second clip per state-changing hotspot: the object visibly transforms
(chest opens, stove ignites, dragon eats) conditioned on the BEFORE state
scene as the first frame. Judged by frame sampling, compressed with ffmpeg.

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


def gen_clip(room_id: str, hid: str, anim: str, before_scene: str) -> str | None:
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
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw),
                            "-c:v", "libx264", "-crf", "29", "-preset", "medium", "-an",
                            "-movflags", "+faststart", str(OUT / fname)], check=True)
            raw.unlink(missing_ok=True)
            print(f"  {fname}: OK ({(OUT / fname).stat().st_size // 1024}KB, attempt {attempt + 1})")
            return f"escape-video/{fname}"
        except Exception as e:  # noqa: BLE001
            print(f"  {fname}: attempt {attempt + 1} failed ({str(e)[:120]})")
            time.sleep(10)
    print(f"  {fname}: FAILED — fallback to crossfade")
    return None


def main() -> None:
    only = set(sys.argv[1:])
    OUT.mkdir(parents=True, exist_ok=True)
    m = json.loads(MANIFEST.read_text())
    rooms_manifest = {r["id"]: r for r in m.get("escape", [])}

    jobs = []
    for spec in ESCAPE_ROOMS:
        rid = spec["id"]
        if only and rid not in only:
            continue
        room_data = rooms_manifest.get(rid)
        if not room_data:
            print(f"{rid}: not in manifest, skipping")
            continue

        state_idx = 0
        for h in spec["hotspots"]:
            if not h.get("anim"):
                continue
            state_idx += 1
            # Before scene: state_idx-1 (0 = base scene, 1+ = previous state scene)
            if state_idx == 1:
                before = str(SCENES / f"{rid}.png")
            else:
                before = str(SCENES / f"{rid}_s{state_idx - 1}.png")
            jobs.append((rid, h["id"], h["anim"], before))

    print(f"{len(jobs)} escape clips to generate")

    def run(j):
        rid, hid, anim, before = j
        return (j, gen_clip(rid, hid, anim, before))

    # Throttle to 2 concurrent (followups agent is running big Veo batches)
    with ThreadPoolExecutor(2) as ex:
        results = list(ex.map(run, jobs))

    # Wire into manifest
    m = json.loads(MANIFEST.read_text())
    wired = 0
    filter_hits = []
    for (rid, hid, anim, _), path in results:
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
