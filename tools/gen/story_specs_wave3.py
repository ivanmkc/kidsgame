"""Wave-3 storybook specs (12 books, authored 2026-07-09). Same JSON +
loader pattern as wave-2."""
from pathlib import Path

from gen.story_specs_wave2 import HERO_DESC, _load as _load_w2  # noqa: F401
import json


def _load(fname: str) -> dict:
    d = json.loads((Path(__file__).parent / "specs_wave3" / fname).read_text())
    hero = HERO_DESC[d.pop("hero")]
    d["character"] = hero
    for n in d["nodes"].values():
        n["scene"] = n["scene"].replace("{HERO}", hero)
        if "scare" in n and "pop" in n["scare"]:
            n["scare"]["pop"] = n["scare"]["pop"].replace("{HERO}", hero)
    return d


WAVE3 = [_load(p.name) for p in sorted((Path(__file__).parent / "specs_wave3").glob("*.json"))]
WAVE3_BY_ID = {s["id"]: s for s in WAVE3}
