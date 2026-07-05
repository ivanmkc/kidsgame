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
from gen.nbp import generate, generate_with_ref  # noqa: E402

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
                "choices": [{"label": "Trot to the forest! 🌲", "next": "a"},
                            {"label": "Gallop to the beach! 🌊", "next": "b"}],
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
                "text": "Together they find a mountain of acorns! The squirrel is so thankful. What now?",
                "choices": [{"label": "Throw an acorn party! 🎉", "next": "end_party"},
                            {"label": "Ride the rainbow home 🌈", "next": "end_rainbow"}],
            },
            "ab": {
                "scene": f"{LUNA} peeking out from behind a big mushroom while forest animals giggle and search for her",
                "text": "Luna is the best hider in the forest! All the animals want more fun.",
                "choices": [{"label": "Crown the champion 👑", "next": "end_crown"},
                            {"label": "Ride the rainbow home 🌈", "next": "end_rainbow"}],
            },
            "ba": {
                "scene": f"{LUNA} standing proudly on a small sailboat sailing past a friendly whale spouting water",
                "text": "A friendly whale swims beside the boat and winks at Luna!",
                "choices": [{"label": "Dive with the whale 🐋", "next": "end_pearl"},
                            {"label": "Dance at the bonfire 🔥", "next": "end_bonfire"}],
            },
            "bb": {
                "scene": f"{LUNA} beside a huge fancy sandcastle decorated with seashells, a crab wearing a tiny paper crown",
                "text": "The sandcastle is magnificent, and a little crab wants to be its king!",
                "choices": [{"label": "Crown the crab king 🦀", "next": "end_crab"},
                            {"label": "Dance at the bonfire 🔥", "next": "end_bonfire"}],
            },
            "end_party": {
                "scene": f"{LUNA} and many forest animals having a picnic party with acorn treats under paper lanterns",
                "text": "The whole forest comes to Luna's acorn party! What a wonderful day. The End!",
            },
            "end_rainbow": {
                "scene": f"{LUNA} sliding down a giant glowing rainbow toward her meadow home at sunset",
                "text": "Luna slides all the way home on a rainbow. Sweet dreams, Luna! The End!",
            },
            "end_crown": {
                "scene": f"{LUNA} wearing a crown of daisies while forest animals cheer around her",
                "text": "The animals crown Luna the Hide-and-Seek Champion of the forest! The End!",
            },
            "end_pearl": {
                "scene": f"{LUNA} underwater in a magic air bubble beside the smiling whale, holding a glowing pearl",
                "text": "The whale shows Luna a glowing pearl — a gift for her bravery! The End!",
            },
            "end_crab": {
                "scene": f"{LUNA} bowing to a proud little crab sitting on a sandcastle throne with a seaweed cape",
                "text": "King Crab rules the grandest sandcastle on the beach. Long live the king! The End!",
            },
            "end_bonfire": {
                "scene": f"{LUNA} dancing with seagulls and crabs around a cozy beach bonfire under the stars",
                "text": "Everyone dances around the bonfire until the stars come out. The End!",
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
                "choices": [{"label": "Search the garden 🌻", "next": "a"},
                            {"label": "Run to the park 🛝", "next": "b"}],
            },
            "a": {
                "scene": f"{PIP} sniffing between tall sunflowers in a vegetable garden, a trail of paw prints in the dirt",
                "text": "Sniff sniff! The trail leads through the sunflowers. Pip hears a sound...",
                "choices": [{"label": "Dig here! 🕳️", "next": "aa"},
                            {"label": "Follow the sound 👂", "next": "ab"}],
            },
            "b": {
                "scene": f"{PIP} at a colorful playground park, looking at a slide and a big oak tree with a hollow",
                "text": "The map shows the park! Where should Pip look first?",
                "choices": [{"label": "Zoom down the slide! 🛝", "next": "ba"},
                            {"label": "Sniff the oak tree 🌳", "next": "bb"}],
            },
            "aa": {
                "scene": f"{PIP} proudly digging up a small wooden chest with the lid still closed, dirt flying",
                "text": "Pip digs up a mysterious little chest! It rattles. Should he...",
                "choices": [{"label": "Open it now! 🔓", "next": "end_biscuits"},
                            {"label": "Share it with friends 🐾", "next": "end_share"}],
            },
            "ab": {
                "scene": f"{PIP} nose to nose with three tiny kittens hiding in a watering can, all very happy",
                "text": "The sound was three tiny kittens! They look hungry and a little lost.",
                "choices": [{"label": "Lead them home 🏡", "next": "end_kittens"},
                            {"label": "Share it with friends 🐾", "next": "end_share"}],
            },
            "ba": {
                "scene": f"{PIP} sliding down a big red slide with ears flying, a shiny golden ball waiting at the bottom",
                "text": "Wheee! At the bottom waits a shiny golden ball. It starts to roll away!",
                "choices": [{"label": "Chase the ball! 🎾", "next": "end_ball"},
                            {"label": "Invite friends to play ⚽", "next": "end_game"}],
            },
            "bb": {
                "scene": f"{PIP} looking into a tree hollow glowing with fireflies, eyes wide with wonder",
                "text": "Inside the old oak lives a family of glowing fireflies! They swirl around Pip.",
                "choices": [{"label": "Follow the fireflies ✨", "next": "end_fireflies"},
                            {"label": "Invite friends to play ⚽", "next": "end_game"}],
            },
            "end_biscuits": {
                "scene": f"{PIP} with an open wooden chest overflowing with bone-shaped golden dog biscuits",
                "text": "The chest is full of golden biscuits! Best treasure a puppy ever found. The End!",
            },
            "end_share": {
                "scene": f"{PIP} sharing biscuits from a small chest with kittens and a bunny at a garden picnic",
                "text": "Pip shares his treasure with all his friends. Sharing is the best treasure! The End!",
            },
            "end_kittens": {
                "scene": f"{PIP} proudly leading three tiny kittens to a cozy basket by a farmhouse door at dusk",
                "text": "Pip leads the kittens safely home. Their mama purrs a big thank-you! The End!",
            },
            "end_ball": {
                "scene": f"{PIP} leaping joyfully to catch a shiny golden ball in mid-air over the playground",
                "text": "Pip catches the golden ball with a super jump! Champion Pip! The End!",
            },
            "end_game": {
                "scene": f"{PIP} playing ball with two other puppies and a kitten on the sunny playground lawn",
                "text": "Pip and his friends play until sunset. A treasure of a day! The End!",
            },
            "end_fireflies": {
                "scene": f"{PIP} following a sparkling trail of fireflies to a hidden garden lit like fairyland",
                "text": "The fireflies lead Pip to a secret glowing garden. Magic! The End!",
            },
        },
    },
]


def gen_story(spec: dict) -> dict | None:
    OUT.mkdir(parents=True, exist_ok=True)
    nodes = {}
    for nid, n in spec["nodes"].items():
        fname = f"{spec['id']}_{nid}.png"
        if (OUT / fname).exists():
            print(f"  {spec['id']}/{nid}: exists, reusing")
        else:
            # the start scene anchors the character; every other node is
            # conditioned on it so the hero stays visually consistent
            ref = OUT / f"{spec['id']}_start.png"
            best = None
            for attempt in range(3):
                if nid != "start" and ref.exists():
                    img = generate_with_ref(
                        f"{n['scene']}. The main character must look IDENTICAL to the "
                        f"character in the reference image — same face, colors, markings "
                        f"and proportions. {STYLE}",
                        ref, (1280, 720))
                else:
                    img = generate(f"{n['scene']}. {STYLE}", (1280, 720))
                best = img
                if ask_yes_no(
                    f"Is this a charming, artifact-free children's book illustration clearly showing {spec['character'].split(',')[0]}?",
                    [img],
                ):
                    break
                print(f"  {spec['id']}/{nid}: judge rejected, retry {attempt + 1}")
            else:
                # a decent-but-imperfect scene beats losing the whole story
                print(f"  {spec['id']}/{nid}: accepting best attempt despite judge")
            best.save(OUT / fname)
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
