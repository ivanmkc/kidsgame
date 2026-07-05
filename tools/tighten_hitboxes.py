"""Re-derive every diff hitbox from the ACTUAL A/B pixel difference.

The hotspot a player taps must be centered on the visual change and no
bigger than it: |A-B| changed pixels near the stored hitbox, morphologically
opened, tight bbox + 8px pad. Idempotent; run any time after generation.
"""

from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).parent.parent
MANIFEST = ROOT / "src" / "assets" / "manifest.json"
PAD = 8
SEARCH_GROW = 48  # look this far beyond the stored box for the change


def tighten(entry: dict) -> int:
    a = np.asarray(Image.open(ROOT / "assets" / "game" / entry["imageA"]).convert("RGB"), np.int16)
    b = np.asarray(Image.open(ROOT / "assets" / "game" / entry["imageB"]).convert("RGB"), np.int16)
    H, W = a.shape[:2]
    changed = (np.abs(a - b).sum(-1) > 30).astype(np.uint8)
    changed = cv2.morphologyEx(changed, cv2.MORPH_OPEN,
                               cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    n = 0
    for d in entry["diffs"]:
        x0 = max(0, d["x"] - SEARCH_GROW); y0 = max(0, d["y"] - SEARCH_GROW)
        x1 = min(W, d["x"] + d["w"] + SEARCH_GROW); y1 = min(H, d["y"] + d["h"] + SEARCH_GROW)
        sub = changed[y0:y1, x0:x1]
        ys, xs = np.where(sub > 0)
        if len(xs) < 200:
            continue  # degenerate — keep the stored box
        nx = max(0, x0 + int(xs.min()) - PAD); ny = max(0, y0 + int(ys.min()) - PAD)
        nx1 = min(W, x0 + int(xs.max()) + PAD); ny1 = min(H, y0 + int(ys.max()) + PAD)
        new = {"x": nx, "y": ny, "w": nx1 - nx, "h": ny1 - ny}
        if (new["x"], new["y"], new["w"], new["h"]) != (d["x"], d["y"], d["w"], d["h"]):
            d.update(new)
            n += 1
    return n


def main() -> None:
    m = json.loads(MANIFEST.read_text())
    total = 0
    for entry in m["diff"]:
        k = tighten(entry)
        total += k
        print(f"  {entry['id']}: {k} hitbox(es) tightened")
    MANIFEST.write_text(json.dumps(m, indent=2))
    print(f"{total} hitboxes re-derived from pixel diffs")


if __name__ == "__main__":
    main()
