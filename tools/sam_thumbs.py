"""Upgrade checklist cutouts with SAM 3.1 (pod repo's GPU-VM extractor).

For each hidden target: crop the scene around the known rect, SAM-segment
the object by text prompt, build a tight RGBA cutout (extract_props-style),
judge it, and replace the existing thumb when it wins.

Usage: CLOUDSDK_AUTH_ACCESS_TOKEN=$(gcloud auth application-default \
    print-access-token) python3 tools/sam_thumbs.py [target_id ...]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, "/home/ivanmkc/persistence-of-dreams")

from gen.judge import ask_yes_no  # noqa: E402
from tools.sam3_detect import sam3_detect_object  # noqa: E402  (pod repo)

ROOT = Path(__file__).parent.parent
ASSETS = ROOT / "assets" / "game"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"
WORK = Path.home() / ".claude/jobs/c60063e9/tmp/sam_work"
VM = {"name": "gpu-sam3-a100", "zone": "us-central1-f"}
PAD = 24


def sam_cutout(scene: Image.Image, t: dict) -> Image.Image | None:
    x0 = max(0, t["x"] - PAD)
    y0 = max(0, t["y"] - PAD)
    x1 = min(scene.width, t["x"] + t["w"] + PAD)
    y1 = min(scene.height, t["y"] + t["h"] + PAD)
    crop = scene.crop((x0, y0, x1, y1)).convert("RGB")
    bgr = cv2.cvtColor(np.asarray(crop), cv2.COLOR_RGB2BGR)

    short = t["label"].replace("a ", "").replace("an ", "")
    work = WORK / t["id"]
    work.mkdir(parents=True, exist_ok=True)
    try:
        mask, bbox = sam3_detect_object(
            image=bgr, text_prompt=short, detect_prompt=t["label"],
            gpu_vm_config=VM, work_dir=work,
        )
    except Exception as e:  # noqa: BLE001
        print(f"    SAM failed: {type(e).__name__} {str(e)[:120]}")
        return None
    if mask is None or mask.sum() == 0:
        return None

    bx0, by0, bx1, by1 = bbox
    px = round((bx1 - bx0) * 0.08)
    py = round((by1 - by0) * 0.08)
    bx0 = max(0, bx0 - px); by0 = max(0, by0 - py)
    bx1 = min(bgr.shape[1], bx1 + px); by1 = min(bgr.shape[0], by1 + py)
    rgb = np.asarray(crop)[by0:by1, bx0:bx1]
    a = mask[by0:by1, bx0:bx1]
    if a.mean() < 8:  # nearly empty
        return None
    rgba = np.dstack([rgb, a])
    h, w = rgba.shape[:2]
    side = max(h, w)
    canvas = np.zeros((side, side, 4), np.uint8)
    oy, ox = (side - h) // 2, (side - w) // 2
    canvas[oy:oy + h, ox:ox + w] = rgba
    return Image.fromarray(canvas, "RGBA").resize((256, 256), Image.Resampling.LANCZOS)


def main() -> None:
    only = set(sys.argv[1:])
    m = json.loads(MANIFEST.read_text())
    upgraded = 0
    for scene_entry in m["hidden"]:
        scene = Image.open(ASSETS / scene_entry["image"])
        for t in scene_entry["targets"]:
            key = f"{scene_entry['id']}_{t['id']}"
            if only and t["id"] not in only and key not in only:
                continue
            print(f"SAM: {key} ({t['label']})")
            cut = sam_cutout(scene, t)
            if cut is None:
                print("    no usable mask, keeping current thumb")
                continue
            white = Image.new("RGB", cut.size, (255, 255, 255))
            white.paste(cut, mask=cut.split()[3])
            if not ask_yes_no(
                f"Is this a single clean image of {t['label']} — complete, recognizable, no scenery chunks?",
                [white],
            ):
                print("    judge rejected SAM cutout, keeping current thumb")
                continue
            cut.save(ASSETS / t["thumb"])
            upgraded += 1
            print("    UPGRADED")
    print(f"\n{upgraded} thumbs upgraded via SAM 3.1")


if __name__ == "__main__":
    main()
