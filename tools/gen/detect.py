"""Gemini object detection — finds real objects in a base scene so diff
edits can REMOVE or REPLACE them (true spot-the-difference variety), not
just add new ones. Boxes come from Gemini's detection JSON; following the
pod repo's rule, a vision model picks WHAT, and downstream code treats the
box only as an edit region (never as gospel geometry).
"""

from __future__ import annotations

import io
import json
import sys

from PIL import Image
from google.genai import types

from .nbp import client

_DETECT_MODEL = "gemini-2.5-flash"

_PROMPT = (
    "Detect distinct, self-contained objects in this children's-book "
    "illustration that could be removed or swapped in a spot-the-difference "
    "game (an animal, a toy, a plant, a prop — NOT background regions like "
    "sky, grass, floor, walls, water, hills, large buildings, big trees). "
    "Return up to 12 objects as a JSON array where each item has exactly "
    "these fields: {\"label\": str, \"xmin\": int, \"ymin\": int, "
    "\"xmax\": int, \"ymax\": int} with all coordinates normalized to "
    "0-1000 (xmin/xmax are horizontal, ymin/ymax vertical)."
)


def detect_objects(img: Image.Image) -> list[dict]:
    """Returns [{label, x, y, w, h}] in pixel coords, loosely filtered."""
    buf = io.BytesIO()
    img.save(buf, "PNG")
    W, H = img.size
    try:
        resp = client().models.generate_content(
            model=_DETECT_MODEL,
            contents=[types.Content(role="user", parts=[
                types.Part(inline_data=types.Blob(mime_type="image/png", data=buf.getvalue())),
                types.Part(text=_PROMPT),
            ])],
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        items = json.loads(resp.text or "[]")
    except Exception as e:  # noqa: BLE001
        print(f"  WARN detect_objects: {type(e).__name__} {str(e)[:100]}", file=sys.stderr)
        return []

    out = []
    for it in items if isinstance(items, list) else []:
        label = str(it.get("label", "")).strip()
        try:
            x0 = max(0, min(1000, int(it["xmin"])))
            y0 = max(0, min(1000, int(it["ymin"])))
            x1 = max(0, min(1000, int(it["xmax"])))
            y1 = max(0, min(1000, int(it["ymax"])))
        except (KeyError, TypeError, ValueError):
            continue
        if not label or x1 <= x0 or y1 <= y0:
            continue
        out.append({
            "label": label,
            "x": int(x0 / 1000 * W), "y": int(y0 / 1000 * H),
            "w": int((x1 - x0) / 1000 * W), "h": int((y1 - y0) / 1000 * H),
        })
    return out


def usable_detections(dets: list[dict], W: int, H: int) -> list[dict]:
    """Filter to well-sized, in-frame, mutually non-overlapping objects."""
    good = []
    for d in dets:
        area = d["w"] * d["h"]
        if not (2500 <= area <= 0.10 * W * H):
            continue
        if d["x"] < 8 or d["y"] < 8 or d["x"] + d["w"] > W - 8 or d["y"] + d["h"] > H - 8:
            continue
        good.append(d)

    def overlaps(a, b):
        return (a["x"] < b["x"] + b["w"] and b["x"] < a["x"] + a["w"]
                and a["y"] < b["y"] + b["h"] and b["y"] < a["y"] + a["h"])

    picked: list[dict] = []
    for d in sorted(good, key=lambda d: d["w"] * d["h"], reverse=True):
        if not any(overlaps(d, p) for p in picked):
            picked.append(d)
    return picked
