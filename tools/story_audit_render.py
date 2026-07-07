"""Render storybook audit composites: every node scene with its choice
hotspots outlined (teal = choice 1, gold = choice 2) + labels, ready for
the adversarial audit fleet (or a human eyeball).

Usage: python3 tools/story_audit_render.py <story_id ...> [--out DIR]
Default out: tools/audit_out/story/<story_id>/
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).parent.parent
MANIFEST = ROOT / "src" / "assets" / "manifest.json"


def render(story_id: str, out_root: Path) -> int:
    m = json.loads(MANIFEST.read_text())
    st = next((s for s in m.get("stories", []) if s["id"] == story_id), None)
    if not st:
        print(f"{story_id}: not in manifest")
        return 0
    d = out_root / story_id
    d.mkdir(parents=True, exist_ok=True)
    for nid, n in st["nodes"].items():
        img = Image.open(ROOT / "assets" / "game" / n["image"]).convert("RGB")
        dr = ImageDraw.Draw(img)
        for i, c in enumerate(n.get("choices", [])):
            if "hot" not in c:
                continue
            h = c["hot"]
            col = (0, 200, 200) if i == 0 else (255, 190, 0)
            dr.rectangle([h["x"], h["y"], h["x"] + h["w"], h["y"] + h["h"]], outline=col, width=6)
            dr.text((h["x"] + 6, min(700, h["y"] + h["h"] + 4)), c["label"][:40], fill=col)
        if n.get("bad"):
            dr.text((10, 10), "OOPSIE ENDING", fill=(220, 60, 60))
        img.save(d / f"{nid}.png")
    print(f"{story_id}: rendered {len(st['nodes'])} nodes -> {d}")
    return len(st["nodes"])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("stories", nargs="+")
    ap.add_argument("--out", default=str(ROOT / "tools" / "audit_out" / "story"))
    a = ap.parse_args()
    for sid in a.stories:
        render(sid, Path(a.out))


if __name__ == "__main__":
    main()
