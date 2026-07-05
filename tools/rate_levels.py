"""Rate every diff/hidden scene easy/medium/hard from its geometry.

Smaller things are harder to spot, so the median hotspot (diff) or target
(hidden) area drives the rating. Thresholds are fixed (chosen from the
2026-07 content distribution) so a scene's label doesn't drift as other
scenes come and go. Idempotent; run alongside tighten_hitboxes.
"""

from __future__ import annotations

import json
import statistics
from pathlib import Path

ROOT = Path(__file__).parent.parent
MANIFEST = ROOT / "src" / "assets" / "manifest.json"
SCENE_PX = 1280 * 720

# median area as % of the scene → level
DIFF_EASY = 2.4    # big obvious changes
DIFF_HARD = 1.6    # small fiddly changes
HIDDEN_EASY = 1.7
HIDDEN_HARD = 1.2


def rate(median_pct: float, easy_at: float, hard_at: float) -> str:
    if median_pct >= easy_at:
        return "easy"
    if median_pct < hard_at:
        return "hard"
    return "medium"


def main() -> None:
    m = json.loads(MANIFEST.read_text())
    for e in m["diff"]:
        pct = statistics.median(d["w"] * d["h"] for d in e["diffs"]) / SCENE_PX * 100
        e["level"] = rate(pct, DIFF_EASY, DIFF_HARD)
    for e in m["hidden"]:
        pct = statistics.median(t["w"] * t["h"] for t in e["targets"]) / SCENE_PX * 100
        e["level"] = rate(pct, HIDDEN_EASY, HIDDEN_HARD)
    MANIFEST.write_text(json.dumps(m, indent=2))
    for coll in ("diff", "hidden"):
        counts = {"easy": 0, "medium": 0, "hard": 0}
        for e in m[coll]:
            counts[e["level"]] += 1
        print(coll, counts)


if __name__ == "__main__":
    main()
