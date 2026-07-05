"""Re-derive every diff hitbox from the ACTUAL A/B pixel difference.

The hotspot a player taps must be centered on the visual change and no
bigger than it. Changed-pixel components are assigned to the NEAREST
declared diff (independent grown regions used to double-count shared
pixels and produce overlapping boxes — the non-overlap game rule is a
unit test). If any pair still overlaps after tightening, that scene keeps
its original boxes: generation already verified those collision-free.
Idempotent; run any time after generation.
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
NEAR = 64  # a component further than this from every diff center is noise


def _overlap(a: dict, b: dict, pad: int = 0) -> bool:
    return not (a["x"] + a["w"] + pad <= b["x"] or b["x"] + b["w"] + pad <= a["x"] or
                a["y"] + a["h"] + pad <= b["y"] or b["y"] + b["h"] + pad <= a["y"])


def tighten(entry: dict) -> int:
    a = np.asarray(Image.open(ROOT / "assets" / "game" / entry["imageA"]).convert("RGB"), np.int16)
    b = np.asarray(Image.open(ROOT / "assets" / "game" / entry["imageB"]).convert("RGB"), np.int16)
    H, W = a.shape[:2]
    changed = (np.abs(a - b).sum(-1) > 30).astype(np.uint8)
    changed = cv2.morphologyEx(changed, cv2.MORPH_OPEN,
                               cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    n, labels, stats, cents = cv2.connectedComponentsWithStats(changed)

    diffs = entry["diffs"]
    centers = [(d["x"] + d["w"] / 2, d["y"] + d["h"] / 2) for d in diffs]
    buckets: list[list[int]] = [[] for _ in diffs]
    for ci in range(1, n):
        if stats[ci, cv2.CC_STAT_AREA] < 60:
            continue
        cx, cy = cents[ci]
        dists = [max(abs(cx - mx) - d["w"] / 2, 0) + max(abs(cy - my) - d["h"] / 2, 0)
                 for (mx, my), d in zip(centers, diffs)]
        best = int(np.argmin(dists))
        if dists[best] <= NEAR:
            buckets[best].append(ci)

    proposed = []
    for d, comps in zip(diffs, buckets):
        if not comps:
            proposed.append(dict(d))
            continue
        xs0 = int(min(stats[c, cv2.CC_STAT_LEFT] for c in comps))
        ys0 = int(min(stats[c, cv2.CC_STAT_TOP] for c in comps))
        xs1 = int(max(stats[c, cv2.CC_STAT_LEFT] + stats[c, cv2.CC_STAT_WIDTH] for c in comps))
        ys1 = int(max(stats[c, cv2.CC_STAT_TOP] + stats[c, cv2.CC_STAT_HEIGHT] for c in comps))
        proposed.append({**d, "x": max(0, xs0 - PAD), "y": max(0, ys0 - PAD),
                         "w": min(W, xs1 + PAD) - max(0, xs0 - PAD),
                         "h": min(H, ys1 + PAD) - max(0, ys0 - PAD)})

    # Two changes close together can produce touching boxes; split the
    # shared band at its midline so each hotspot stays on its own change.
    for i in range(len(proposed)):
        for j in range(i + 1, len(proposed)):
            pi, pj = proposed[i], proposed[j]
            ix0 = max(pi["x"], pj["x"]); ix1 = min(pi["x"] + pi["w"], pj["x"] + pj["w"])
            iy0 = max(pi["y"], pj["y"]); iy1 = min(pi["y"] + pi["h"], pj["y"] + pj["h"])
            if ix1 <= ix0 or iy1 <= iy0:
                continue
            if (ix1 - ix0) <= (iy1 - iy0):  # cut vertically
                mid = (ix0 + ix1) // 2
                left, right = (pi, pj) if pi["x"] <= pj["x"] else (pj, pi)
                left["w"] = max(24, mid - 2 - left["x"])
                nx = mid + 2
                right["w"] = max(24, right["x"] + right["w"] - nx)
                right["x"] = nx
            else:  # cut horizontally
                mid = (iy0 + iy1) // 2
                top, bot = (pi, pj) if pi["y"] <= pj["y"] else (pj, pi)
                top["h"] = max(24, mid - 2 - top["y"])
                ny = mid + 2
                bot["h"] = max(24, bot["y"] + bot["h"] - ny)
                bot["y"] = ny

    if any(_overlap(p, q) for i, p in enumerate(proposed) for q in proposed[i + 1:]):
        return 0  # irreconcilable (nested changes) — keep originals
    moved = sum(1 for d, p in zip(diffs, proposed)
                if (d["x"], d["y"], d["w"], d["h"]) != (p["x"], p["y"], p["w"], p["h"]))
    entry["diffs"] = proposed
    return moved


def main() -> None:
    m = json.loads(MANIFEST.read_text())
    total = 0
    for entry in m["diff"]:
        if "pool" in entry:
            print(f"  {entry['id']}: pooled (hitboxes derived at generation)")
            continue
        k = tighten(entry)
        total += k
        print(f"  {entry['id']}: {k} hitbox(es) tightened")
    MANIFEST.write_text(json.dumps(m, indent=2))
    print(f"{total} hitboxes re-derived from pixel diffs")


if __name__ == "__main__":
    main()
