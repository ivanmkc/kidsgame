"""Wave-4 storybook specs (12 books, authored 2026-07-10). Same JSON +
loader pattern as wave-2/3. Specs only — generation not yet run."""
from pathlib import Path

import json

from gen.story_specs_wave2 import HERO_DESC


def _load(fname: str) -> dict:
    d = json.loads((Path(__file__).parent / "specs_wave4" / fname).read_text())
    hero = HERO_DESC[d.pop("hero")]
    d["character"] = hero
    for n in d["nodes"].values():
        n["scene"] = n["scene"].replace("{HERO}", hero)
        if "scare" in n and "pop" in n["scare"]:
            n["scare"]["pop"] = n["scare"]["pop"].replace("{HERO}", hero)
    return d


WAVE4 = [_load(p.name) for p in sorted((Path(__file__).parent / "specs_wave4").glob("*.json"))]
WAVE4_BY_ID = {s["id"]: s for s in WAVE4}
