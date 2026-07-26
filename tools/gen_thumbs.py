"""Small JPEG thumbnails for picker cards and menu previews.

Picker cards render at ~190px but were loading full 1280x720 scenes
(~300KB each); a 380px q72 JPEG is ~15-25KB. Idempotent; run before
gen_images_ts (which maps them into SCENE_THUMBS).
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).parent.parent
ASSETS = ROOT / "assets" / "game"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"


def thumb_for(rel: str) -> None:
    src = ASSETS / rel
    dst = src.with_name(src.stem + "_thumb.jpg")
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        return
    img = Image.open(src).convert("RGB")
    img.thumbnail((380, 380))
    img.save(dst, "JPEG", quality=72)


def main() -> None:
    m = json.loads(MANIFEST.read_text())
    n = 0
    for d in m["diff"]:
        thumb_for(d.get("image") or d["imageA"]); n += 1
    for h in m["hidden"]:
        thumb_for(h["image"]); n += 1
    for st in m.get("stories", []):
        thumb_for(st["nodes"]["start"]["image"]); n += 1
    for e in m.get("escape", []):
        thumb_for(e["image"]); n += 1
    print(f"{n} scene thumbnails ensured")


if __name__ == "__main__":
    main()
