"""Veo action transitions for hotspot story books.

One short clip per in-scene choice: the hero DOES the chosen action,
conditioned on the node's scene as the first frame (veo-3.0-fast; no
last-frame support on this project, the app crossfades to the next
scene). Judged by frame sampling, compressed with ffmpeg, resumable.

Usage: python3 tools/gen_story_videos.py [story_id ...]
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import google.genai as genai
from gen.judge import ask_yes_no
from gen.nbp import PROJECT
from gen.story_specs import LUNA, PIP
from google.genai import types
from PIL import Image

ROOT = Path(__file__).parent.parent
SCENES = ROOT / "assets" / "game" / "story"
OUT = ROOT / "public" / "story-video"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"
MODEL = "veo-3.0-fast-generate-001"
HEROES = {"doors": ("Luna", LUNA), "trail": ("Pip", PIP)}

import threading
_tls = threading.local()
def client():
    # genai.Client is not thread-safe — one per worker thread
    if not hasattr(_tls, "c"):
        _tls.c = genai.Client(vertexai=True, project=PROJECT, location="us-central1")
    return _tls.c


def _judge_clip(mp4: Path, hero: str, action: str) -> bool:
    with tempfile.TemporaryDirectory() as td:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp4),
                        "-vf", "select='eq(n\\,0)+eq(n\\,60)+eq(n\\,115)'", "-vsync", "vfr",
                        f"{td}/f_%d.png"], check=True)
        frames = [Image.open(p) for p in sorted(Path(td).glob("f_*.png"))]
        if not frames:
            return False
        return ask_yes_no(
            f"These are frames from a short animation clip, in time order. Does {hero} move to "
            f"perform this action: \"{action}\"? Judge YES only if the hero is clearly the same "
            f"character throughout, the motion matches the action, and there is no garbled text "
            f"or heavy distortion.", frames)


def gen_clip(sid: str, nid: str, idx: int, label: str, spot: str) -> str | None:
    fname = f"{sid}_{nid}_{idx}.mp4"
    if (OUT / fname).exists():
        print(f"  {fname}: exists")
        return f"story-video/{fname}"
    hero_name, hero_desc = HEROES[sid]
    first = (SCENES / f"{sid}_{nid}.png").read_bytes()
    action = label.rstrip("!.")
    prompt = (f"{hero_desc}. Starting from this exact scene, {hero_name} performs the action: "
              f"{action} — moving toward and interacting with the {spot}. Gentle storybook "
              f"animation, soft cheerful movement, the camera follows the hero. Bright "
              f"children's picture-book style, consistent with the first frame. No text.")
    for attempt in range(2):
        try:
            op = client().models.generate_videos(
                model=MODEL, prompt=prompt,
                image=types.Image(image_bytes=first, mime_type="image/png"),
                config=types.GenerateVideosConfig(
                    number_of_videos=1, duration_seconds=6, aspect_ratio="16:9",
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
            if not _judge_clip(raw, hero_name, action):
                print(f"  {fname}: judge rejected attempt {attempt + 1}")
                if attempt == 0:
                    continue
            # compress + faststart (batch adds ~28 clips to the static site)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw),
                            "-c:v", "libx264", "-crf", "29", "-preset", "medium", "-an",
                            "-movflags", "+faststart", str(OUT / fname)], check=True)
            raw.unlink(missing_ok=True)
            print(f"  {fname}: OK ({(OUT / fname).stat().st_size // 1024}KB, attempt {attempt + 1})")
            return f"story-video/{fname}"
        except Exception as e:  # noqa: BLE001
            print(f"  {fname}: attempt {attempt + 1} failed ({str(e)[:120]})")
            time.sleep(10)
    print(f"  {fname}: FAILED — choice keeps the zoom transition")
    return None


def main() -> None:
    only = set(sys.argv[1:]) or set(HEROES)
    OUT.mkdir(parents=True, exist_ok=True)
    m = json.loads(MANIFEST.read_text())
    jobs = []
    for st in m["stories"]:
        if st["id"] not in only or st["id"] not in HEROES:
            continue
        for nid, n in st["nodes"].items():
            for idx, c in enumerate(n.get("choices", [])):
                if "hot" in c:
                    # spot lives in the spec; label carries the action either way
                    jobs.append((st["id"], nid, idx, c["label"]))
    print(f"{len(jobs)} clips to generate")
    from gen.story_specs import RAINBOW_DOORS, TREASURE_TRAIL
    SPECS = {"doors": RAINBOW_DOORS, "trail": TREASURE_TRAIL}
    def run(j):
        sid, nid, idx, label = j
        spot = SPECS[sid]["nodes"][nid]["choices"][idx].get("spot", "chosen thing")
        return (j, gen_clip(sid, nid, idx, label, spot))
    with ThreadPoolExecutor(2) as ex:
        results = list(ex.map(run, jobs))
    m = json.loads(MANIFEST.read_text())
    wired = 0
    for (sid, nid, idx, _), path in results:
        if not path:
            continue
        st = next(s for s in m["stories"] if s["id"] == sid)
        st["nodes"][nid]["choices"][idx]["video"] = path
        wired += 1
    MANIFEST.write_text(json.dumps(m, indent=2) + "\n")
    print(f"wired {wired}/{len(jobs)} videos into the manifest")


if __name__ == "__main__":
    main()
