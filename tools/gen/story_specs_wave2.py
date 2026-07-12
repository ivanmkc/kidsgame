"""Wave-2 storybook specs: 12 books authored by the review→concept→author
workflow (2026-07-08). Stored as JSON in specs_wave2/ (one file per book);
this loader substitutes the {HERO} placeholder with the shared hero
descriptors so identity stays consistent with wave-1 books."""
import json
from pathlib import Path

from gen.story_specs import LUNA, MILO, MO, PIP

# Wave-5 heroes (2026-07-10): filter-safe by construction — two eyes always
# explicit, no protected-design trigrams, battle/spook-ready silhouettes.
NOVA = ("Nova, a small bold orange fox knight with two bright green eyes, a "
        "little wooden toy sword, a dented pot-lid shield on her back and a "
        "patched blue cape")
REX = ("Rex, a tiny round teal baby t-rex with two big amber eyes, stubby "
       "arms, a striped yellow belly and an oversized happy grin")
WILLOW = ("Willow, a small fluffy grey owl witch with two huge round golden "
          "eyes, a crooked purple pointed hat and a tiny twig broom")
PEARL = ("Pearl, a little pearly-pink sea-dragon princess with two kind blue "
         "eyes, small translucent fins, a tiny golden shell crown and a "
         "curly tail")
HERO_DESC = {"LUNA": LUNA, "PIP": PIP, "MILO": MILO, "MO": MO,
             "NOVA": NOVA, "REX": REX, "WILLOW": WILLOW, "PEARL": PEARL}
_DIR = Path(__file__).parent / "specs_wave2"


def _load(fname: str) -> dict:
    d = json.loads((_DIR / fname).read_text())
    hero = HERO_DESC[d.pop("hero")]
    d["character"] = hero
    for n in d["nodes"].values():
        n["scene"] = n["scene"].replace("{HERO}", hero)
        for key in ("scare",):
            if key in n and "pop" in n[key]:
                n[key]["pop"] = n[key]["pop"].replace("{HERO}", hero)
    return d


WAVE2 = [_load(p.name) for p in sorted(_DIR.glob("*.json"))]
WAVE2_BY_ID = {s["id"]: s for s in WAVE2}
