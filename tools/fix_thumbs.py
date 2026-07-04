"""Audit hidden-object checklist cutouts; redraw broken ones with NBP.

A good cutout: alpha covers 12-95% of the canvas and the largest connected
component holds >=60% of the alpha (no confetti fragments). Broken ones get
redrawn by NBP as a sticker using the actual scene crop as the style/content
reference, then chroma-keyed (SAM VM route is unavailable from this host —
auth scopes — so this is the research plan's fallback chain).
"""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))

from google.genai import types  # noqa: E402

from gen.chroma import key_out_magenta  # noqa: E402
from gen.judge import ask_yes_no  # noqa: E402
from gen.nbp import _call  # noqa: E402

ROOT = Path(__file__).parent.parent
ASSETS = ROOT / "assets" / "game"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"


def cutout_ok(path: Path) -> tuple[bool, str]:
    img = np.asarray(Image.open(path).convert("RGBA"))
    alpha = img[..., 3] > 32
    frac = float(alpha.mean())
    if not (0.12 <= frac <= 0.95):
        return False, f"coverage {frac:.2f}"
    n, labels = cv2.connectedComponents(alpha.astype(np.uint8))
    if n <= 1:
        return False, "empty"
    sizes = [(labels == i).sum() for i in range(1, n)]
    if max(sizes) / alpha.sum() < 0.60:
        return False, f"fragmented ({n - 1} pieces)"
    return True, f"ok ({frac:.2f})"


def redraw(desc: str, ref_crop: Image.Image) -> Image.Image | None:
    buf = io.BytesIO()
    ref_crop.save(buf, "PNG")
    for attempt in range(3):
        parts = [
            types.Part(text="Reference crop from a children's book illustration:"),
            types.Part(inline_data=types.Blob(mime_type="image/png", data=buf.getvalue())),
            types.Part(text=(
                f"Draw {desc} EXACTLY as it appears in the reference crop — same colors, "
                "same design, same art style — as a single centered object filling most "
                "of the frame, on a plain solid bright magenta background (#FF00FF). "
                "Nothing else in the image. No text."
            )),
        ]
        data = _call([types.Content(role="user", parts=parts)])
        sprite, coverage = key_out_magenta(Image.open(io.BytesIO(data)).convert("RGB"), out_size=256)
        if not (0.15 <= coverage <= 0.98):
            print(f"    redraw coverage {coverage:.2f}, retry {attempt + 1}")
            continue
        if not ask_yes_no(
            f"Is this a single clean image of {desc} on a transparent/plain background — complete, not fragmented, no scenery?",
            [sprite],
        ):
            print(f"    redraw judge rejected, retry {attempt + 1}")
            continue
        return sprite
    return None


def main() -> int:
    m = json.loads(MANIFEST.read_text())
    bad = 0
    fixed = 0
    for scene in m["hidden"]:
        scene_img = Image.open(ASSETS / scene["image"])
        for t in scene["targets"]:
            path = ASSETS / t["thumb"]
            ok, why = cutout_ok(path)
            state = "OK " if ok else "BAD"
            print(f"{state} {t['thumb']}: {why}")
            if ok:
                # belt & braces: judge it too
                sprite = Image.open(path).convert("RGBA")
                white = Image.new("RGB", sprite.size, (255, 255, 255))
                white.paste(sprite, mask=sprite.split()[3])
                if ask_yes_no(
                    f"Is this a single recognizable image of {t['label']} — complete, not fragmented?",
                    [white],
                ):
                    continue
                print(f"    judge overruled: {t['thumb']}")
            bad += 1
            crop = scene_img.crop((t["x"], t["y"], t["x"] + t["w"], t["y"] + t["h"]))
            sprite = redraw(t["label"], crop)
            if sprite is not None:
                sprite.save(path)
                fixed += 1
                print(f"    REDRAWN {t['thumb']}")
            else:
                print(f"    FAILED to redraw {t['thumb']}")
    print(f"\n{bad} bad thumbs, {fixed} fixed")
    return 0 if fixed == bad else 1


if __name__ == "__main__":
    raise SystemExit(main())
