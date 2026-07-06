"""Deterministic visibility check for pooled differences.

A pool entry is only a difference if compositing its patch visibly changes
the base: we require enough changed pixels and enough contrast. Catches
invisible entries (patch ~= base) that judges can miss (Ivan hit one live:
unicorn's mushroom read identical in A vs B).

Usage:
  python3 tools/check_pool_pixels.py           # report; exit 1 on any FAIL
  python3 tools/check_pool_pixels.py --prune   # drop failing entries (keeps
                                               # pool >= 4, else scene FAILs)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).parent.parent
ASSETS = ROOT / "assets" / "game"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"

MIN_CHANGED_PX = 900   # pixels with per-channel-sum delta > 30
MIN_STRONG_PX = 120    # pixels with delta > 90 (a visible core, not haze)
MIN_POOL = 4


def entry_metrics(base: Image.Image, e: dict) -> tuple[int, int, str]:
    patch_path = ASSETS / e["patch"]
    if not patch_path.exists():
        return 0, 0, "patch file missing"
    patch = np.asarray(Image.open(patch_path).convert("RGB"), np.int16)
    crop = np.asarray(
        base.crop((e["x"], e["y"], e["x"] + e["w"], e["y"] + e["h"])).convert("RGB"), np.int16)
    if patch.shape != crop.shape:
        # patch renders scaled at runtime; compare at patch scale
        crop_img = base.crop((e["x"], e["y"], e["x"] + e["w"], e["y"] + e["h"]))
        crop = np.asarray(crop_img.resize((patch.shape[1], patch.shape[0])).convert("RGB"), np.int16)
    delta = np.abs(patch - crop).sum(-1)
    return int((delta > 30).sum()), int((delta > 90).sum()), ""


def main() -> int:
    prune = "--prune" in sys.argv
    m = json.loads(MANIFEST.read_text())
    failures = 0
    for scene in m.get("diff", []):
        if "pool" not in scene:
            continue
        base = Image.open(ASSETS / scene["image"])
        keep = []
        for e in scene["pool"]:
            changed, strong, err = entry_metrics(base, e)
            ok = not err and changed >= MIN_CHANGED_PX and strong >= MIN_STRONG_PX
            if ok:
                keep.append(e)
            else:
                msg = err or f"changed={changed} strong={strong}"
                print(f"  FAIL {scene['id']}/{e['name']}: {msg}")
                if prune:
                    p = ASSETS / e["patch"]
                    if p.exists():
                        p.unlink()
                else:
                    failures += 1
        if prune:
            if len(keep) >= MIN_POOL:
                if len(keep) != len(scene["pool"]):
                    print(f"  pruned {scene['id']}: pool {len(scene['pool'])} -> {len(keep)}")
                scene["pool"] = keep
            elif len(keep) != len(scene["pool"]):
                print(f"  FAIL {scene['id']}: prune would leave {len(keep)} < {MIN_POOL} — scene needs regen")
                failures += 1
    if prune:
        MANIFEST.write_text(json.dumps(m, indent=2) + "\n")
    total = sum(len(s.get("pool", [])) for s in m.get("diff", []))
    print(f"pool pixel check: {total} entries, {failures} failures")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
