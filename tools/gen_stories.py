"""Generate Story Path scenes: branching 7-node picture stories.

Every prompt carries the full character description so the hero stays
consistent across nodes (NBP has no memory between calls). Each scene is
judge-gated. Merge-on-save into manifest['stories'].

Usage: python3 tools/gen_stories.py [story_id ...]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gen.judge import ask_yes_no  # noqa: E402
from gen.nbp import generate  # noqa: E402

ROOT = Path(__file__).parent.parent
OUT = ROOT / "assets" / "game" / "story"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"

STYLE = ("Bright, warm children's picture-book illustration, flat colors, soft "
         "shapes, high detail, friendly. Landscape orientation. No text, no "
         "letters, no watermark.")

LUNA = ("Luna, a small white unicorn foal with a curly rainbow mane and tail, "
        "big friendly eyes and a tiny golden horn")
PIP = ("Pip, a chubby golden puppy with floppy ears, a red collar with a bone "
       "tag, and a happy open-mouth smile")

STORIES = [
    {
        "id": "luna",
        "title": "Luna's Big Day",
        "character": LUNA,
        "nodes": {
            "start": {
                "scene": f"{LUNA} waking up at sunrise in a flower meadow beside a sparkling stream",
                "text": "Luna the unicorn wakes up on a sunny morning. Where should she go today?",
                "choices": [{"label": "To the forest! 🌲", "next": "a"},
                            {"label": "To the beach! 🌊", "next": "b"}],
            },
            "a": {
                "scene": f"{LUNA} walking into a friendly sunlit forest, butterflies around her, a squirrel waving from a branch",
                "text": "In the forest, a little squirrel waves hello. It looks like it needs help!",
                "choices": [{"label": "Help find acorns 🌰", "next": "aa"},
                            {"label": "Play hide and seek 🙈", "next": "ab"}],
            },
            "b": {
                "scene": f"{LUNA} trotting onto a sandy beach with gentle waves, a small sailboat near the shore",
                "text": "At the beach, Luna finds a little sailboat. The sea sparkles!",
                "choices": [{"label": "Sail away! ⛵", "next": "ba"},
                            {"label": "Build a sandcastle 🏰", "next": "bb"}],
            },
            "aa": {
                "scene": f"{LUNA} and a happy squirrel beside a big pile of acorns under an oak tree, both smiling proudly",
                "text": "Together they find a mountain of acorns! The squirrel gives Luna a big hug. The End!",
            },
            "ab": {
                "scene": f"{LUNA} peeking out from behind a big mushroom while forest animals giggle and search for her",
                "text": "Luna is the best hider in the whole forest! Everyone laughs and plays until sunset. The End!",
            },
            "ba": {
                "scene": f"{LUNA} standing proudly on a small sailboat sailing past a friendly whale spouting water",
                "text": "Luna sails the sparkly sea and a friendly whale says hello with a big splash! The End!",
            },
            "bb": {
                "scene": f"{LUNA} beside a huge fancy sandcastle decorated with seashells, a crab wearing a tiny paper crown",
                "text": "Luna builds the grandest sandcastle ever, and a little crab becomes its king! The End!",
            },
        },
    },
    {
        "id": "pip",
        "title": "Pip Finds a Treasure",
        "character": PIP,
        "nodes": {
            "start": {
                "scene": f"{PIP} in a sunny backyard garden holding an old rolled-up treasure map in his mouth",
                "text": "Pip the puppy found a treasure map! Where does the trail begin?",
                "choices": [{"label": "The big garden 🌻", "next": "a"},
                            {"label": "The park 🛝", "next": "b"}],
            },
            "a": {
                "scene": f"{PIP} sniffing between tall sunflowers in a vegetable garden, a trail of paw prints in the dirt",
                "text": "Sniff sniff! The trail leads through the sunflowers. Pip hears a sound...",
                "choices": [{"label": "Dig here! 🕳️", "next": "aa"},
                            {"label": "Follow the sound 👂", "next": "ab"}],
            },
            "b": {
                "scene": f"{PIP} at a colorful playground park, looking at a slide and a big oak tree with a hollow",
                "text": "The map shows the park! Should Pip check the slide or the old oak tree?",
                "choices": [{"label": "The slide! 🛝", "next": "ba"},
                            {"label": "The oak tree 🌳", "next": "bb"}],
            },
            "aa": {
                "scene": f"{PIP} proudly digging up a small wooden chest full of shiny dog biscuits shaped like bones",
                "text": "Pip digs up a chest full of golden biscuits! Best treasure ever! The End!",
            },
            "ab": {
                "scene": f"{PIP} nose to nose with three tiny kittens hiding in a watering can, all very happy",
                "text": "The sound was three tiny kittens! Pip makes three new best friends. The End!",
            },
            "ba": {
                "scene": f"{PIP} sliding down a big red slide with a shiny golden ball waiting at the bottom",
                "text": "Wheee! At the bottom of the slide waits a shiny golden ball. Treasure! The End!",
            },
            "bb": {
                "scene": f"{PIP} looking into a tree hollow glowing with fireflies, eyes wide with wonder",
                "text": "Inside the old oak lives a family of glowing fireflies. A magic treasure! The End!",
            },
        },
    },
]


def gen_story(spec: dict) -> dict | None:
    OUT.mkdir(parents=True, exist_ok=True)
    nodes = {}
    for nid, n in spec["nodes"].items():
        fname = f"{spec['id']}_{nid}.png"
        for attempt in range(3):
            img = generate(f"{n['scene']}. {STYLE}", (1280, 720))
            if ask_yes_no(
                f"Is this a charming, artifact-free children's book illustration clearly showing {spec['character'].split(',')[0]}?",
                [img],
            ):
                img.save(OUT / fname)
                break
            print(f"  {spec['id']}/{nid}: judge rejected, retry {attempt + 1}")
        else:
            print(f"  {spec['id']}/{nid}: FAILED")
            return None
        entry = {"image": f"story/{fname}", "text": n["text"]}
        if "choices" in n:
            entry["choices"] = n["choices"]
        nodes[nid] = entry
        print(f"  story {spec['id']}/{nid} OK")
    return {"id": spec["id"], "title": spec["title"], "nodes": nodes}


def main() -> None:
    only = set(sys.argv[1:])
    m = json.loads(MANIFEST.read_text())
    m.setdefault("stories", [])
    for spec in STORIES:
        if only and spec["id"] not in only:
            continue
        if any(s["id"] == spec["id"] for s in m["stories"]):
            print(f"{spec['id']}: already present, skipping")
            continue
        got = gen_story(spec)
        if got:
            cur = json.loads(MANIFEST.read_text())
            cur.setdefault("stories", [])
            cur["stories"] = [s for s in cur["stories"] if s["id"] != got["id"]] + [got]
            MANIFEST.write_text(json.dumps(cur, indent=2))
            print(f"story {spec['id']} saved ({len(got['nodes'])} nodes)")


if __name__ == "__main__":
    main()
