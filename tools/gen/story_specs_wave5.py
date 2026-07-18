"""Wave-5 storybook specs (12 books, authored 2026-07-11). Same JSON +
loader pattern as wave-2/3/4. New heroes NOVA/REX/WILLOW/PEARL + legacy."""
from pathlib import Path

import json

from gen.story_specs_wave2 import HERO_DESC


def _load(fname: str) -> dict:
    d = json.loads((Path(__file__).parent / "specs_wave5" / fname).read_text())
    hero = HERO_DESC[d.pop("hero")]
    d["character"] = hero
    for n in d["nodes"].values():
        n["scene"] = n["scene"].replace("{HERO}", hero)
        if "scare" in n and "pop" in n["scare"]:
            n["scare"]["pop"] = n["scare"]["pop"].replace("{HERO}", hero)
    return d


WAVE5 = [_load(p.name) for p in sorted((Path(__file__).parent / "specs_wave5").glob("*.json"))]
WAVE5_BY_ID = {s["id"]: s for s in WAVE5}
