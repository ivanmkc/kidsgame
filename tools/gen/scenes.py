"""Scene generation for Find the Difference and Hidden Objects.

Both games need EXACT ground truth (tap hitboxes), so every change to a
scene goes through a mask-constrained edit + composite-within-mask: the
mask rect IS the hitbox, guaranteed, because pixels outside it are copied
from the base image verbatim.
"""

from __future__ import annotations

import random
from pathlib import Path

from PIL import Image

from .judge import ask_yes_no, strict_min
from .nbp import edit_local, generate

W, H = 1024, 768
MIN_CHANGE = 0.025  # fraction of mask px; small objects legitimately change little
MIN_CHANGE_PX = 1500  # absolute floor so noise cannot pass
# Local-patch mode: NBP usually repaints the whole inner rect — that's fine,
# edit()'s composite keeps only the rect and the judges arbitrate quality.
# Drift on the context ring is only a total-nonsense sanity check.
MAX_DRIFT = 0.60

SCENE_STYLE = (
    "Bright, warm children's picture-book illustration, flat colors, soft "
    "shapes, high detail, friendly. Landscape orientation. No text, no "
    "letters, no watermark, no people."
)

DIFF_THEMES = [
    {
        "id": "farm",
        "name": "Farm",
        "base": "A sunny farmyard scene: red barn, wooden fence, a pond, hay bales, rolling green hills, a big tree, scattered farm animals (cow, pig, chicken, sheep).",
        "adds": ["a small white duck", "a bright red tractor toy", "a sunflower", "a little grey rabbit", "a straw hat on the ground", "a wooden bucket"],
    },
    {
        "id": "ocean",
        "name": "Ocean",
        "base": "A cheerful underwater ocean scene: coral reef, seaweed, sandy bottom, a sunken anchor, colorful fish, a sea turtle, light rays from above.",
        "adds": ["a small orange starfish", "a purple octopus", "a treasure chest", "a striped clownfish", "a green seahorse", "a spiral seashell"],
    },
    {
        "id": "party",
        "name": "Party",
        "base": "A joyful birthday party room: a table with a big birthday cake, balloons on the walls, bunting flags, wrapped presents on the floor, confetti.",
        "adds": ["a red toy robot", "a golden trophy", "a sleeping orange cat", "a small rocking horse", "a pinwheel toy", "a toy sailboat"],
    },
    {
        "id": "space",
        "name": "Space",
        "base": "A friendly outer space scene: big smiling planet with rings, stars, a crescent moon, a rocket flying, colorful nebula clouds, small asteroids.",
        "adds": ["a small green alien waving", "a shiny satellite", "a shooting star", "a tiny flying saucer", "a purple planet", "an astronaut floating"],
    },
    {
        "id": "princess",
        "name": "Princess Castle",
        "base": "A fairytale princess castle courtyard: a pink and white castle with tall towers and flags, a rose garden, a stone fountain, a rainbow in the sky, butterflies.",
        "adds": ["a golden crown on a cushion", "a white pony", "a pink heart balloon", "a frog wearing a tiny crown", "a treasure chest full of jewels", "a peacock"],
    },
    {
        "id": "unicorn",
        "name": "Unicorn Meadow",
        "base": "A magical unicorn meadow: a white unicorn with a flowing rainbow mane, a flower meadow, a sparkling stream, a rainbow arch, fluffy pink clouds, little mushroom houses.",
        "adds": ["a baby unicorn", "a pot of gold", "a little bluebird", "a red toadstool mushroom", "a floating star wand", "a pink butterfly"],
    },
]

# targets = candidate pool (ordered by preference); any NEEDED_TARGETS of
# them make a valid scene, so a stubborn object gets swapped, not fatal.
NEEDED_TARGETS = 5

HIDDEN_THEMES = [
    {
        "id": "toybox",
        "name": "Toy Room",
        "base": "A cozy, busy playroom overflowing with toys: shelves with toys, a toy chest, blocks and balls scattered on a rug, stuffed animals, a rocking horse, crayon drawings pinned on the wall.",
        "targets": [
            ("key", "a small golden key"),
            ("duck", "a yellow rubber duck"),
            ("kite", "a small red kite"),
            ("drum", "a little toy drum"),
            ("snail", "a smiling cartoon snail"),
            ("robot", "a small blue toy robot"),
            ("boat", "a little toy sailboat"),
            ("crayon", "a big red crayon"),
        ],
    },
    {
        "id": "jungle",
        "name": "Jungle",
        "base": "A lush, dense jungle scene: big leaves, vines, colorful flowers, a waterfall in the background, a monkey in a tree, butterflies, mossy rocks.",
        "targets": [
            ("parrot", "a red and blue parrot"),
            ("snake", "a friendly green snake coiled on a branch"),
            ("frog", "a tiny orange frog"),
            ("chameleon", "a purple chameleon"),
            ("crown", "a small golden crown"),
            ("toucan", "a toucan with a big orange beak"),
            ("egg", "a spotted egg in a little nest"),
            ("ladybug", "a red ladybug on a leaf"),
        ],
    },
    {
        "id": "kitchen",
        "name": "Kitchen",
        "base": "A warm, busy cartoon kitchen: shelves with jars and pots, a stove with a steaming pot, hanging utensils, a fruit bowl on the counter, a window with curtains, a checkered floor.",
        "targets": [
            ("mouse", "a tiny grey mouse"),
            ("teapot", "a blue teapot"),
            ("pretzel", "a golden pretzel"),
            ("fish", "a goldfish in a small bowl"),
            ("clock", "a small red alarm clock"),
            ("cupcake", "a pink frosted cupcake"),
            ("spoon", "a big wooden spoon"),
            ("jam", "a jar of red jam"),
        ],
    },
    {
        "id": "ballroom",
        "name": "Princess Ballroom",
        "base": "A grand fairytale princess ballroom: sparkling chandelier, shiny marble floor, long pink velvet curtains, a golden royal throne, flower vases, tall arched windows, a sweeping staircase.",
        "targets": [
            ("crown", "a golden crown on a cushion"),
            ("slipper", "a sparkly glass slipper"),
            ("wand", "a star-tipped magic wand"),
            ("rose", "a single red rose"),
            ("kitten", "a white kitten with a pink bow"),
            ("mirror", "a golden hand mirror"),
            ("fan", "a pink folding fan"),
            ("tiara", "a silver tiara with pink gems"),
        ],
    },
    {
        "id": "fairy",
        "name": "Fairy Garden",
        "base": "An enchanted fairy garden: giant colorful flowers, glowing lanterns, little mushroom houses with tiny doors and windows, a small pond with lily pads, sparkles in the air, mossy stones.",
        "targets": [
            ("unicorn", "a tiny white unicorn with a rainbow mane"),
            ("teacup", "a tiny pink teacup"),
            ("key", "a small golden key"),
            ("star", "a glowing golden star"),
            ("gem", "a sparkling pink gem"),
            ("snail", "a little snail with a spiral shell"),
            ("crown", "a tiny golden crown"),
            ("butterfly", "a blue butterfly"),
        ],
    },
]


def _grid_rects(cols: int, rows: int, n: int, rng: random.Random, margin: int = 24) -> list[tuple[int, int, int, int]]:
    """Pick n non-adjacent-ish cells from a cols x rows grid; return pixel rects."""
    cells = [(c, r) for c in range(cols) for r in range(rows)]
    rng.shuffle(cells)
    picked = cells[:n]
    cw, ch = W // cols, H // rows
    rects = []
    for c, r in picked:
        x0 = c * cw + margin
        y0 = r * ch + margin
        rects.append((x0, y0, cw - 2 * margin, ch - 2 * margin))
    return rects




def _crop(img: Image.Image, rect: tuple[int, int, int, int], pad: int = 12) -> Image.Image:
    x, y, w, h = rect
    return img.crop((max(0, x - pad), max(0, y - pad), min(W, x + w + pad), min(H, y + h + pad)))


def gen_diff_scene(theme: dict, out_dir: Path, seed: int) -> dict | None:
    """Returns manifest entry or None on failure."""
    a_path = out_dir / f"{theme['id']}_a.png"
    b_path = out_dir / f"{theme['id']}_b.png"
    rng = random.Random(seed)

    base = generate(f"{theme['base']} {SCENE_STYLE}", (W, H))
    rects = _grid_rects(4, 3, 4, rng)
    pool = rng.sample(theme["adds"], len(theme["adds"]))  # shuffled; draw as needed

    current = base
    diffs = []
    for rect in rects:
        mask_px = rect[2] * rect[3]
        placed = False
        # An object that won't place cleanly gets swapped for the next one in
        # the pool rather than sinking the whole scene.
        while pool and not placed:
            obj = pool.pop(0)
            for attempt in range(3):
                edited, changed, drift = edit_local(
                    current, rect,
                    f"Add {obj} INTO the existing scenery. Keep the marked area's "
                    "current background, colors and objects exactly as they are — "
                    "just draw the new object on top of them, naturally placed "
                    "(standing / resting / floating as fits the scene), bold and "
                    "clearly visible, matching the art style. Do NOT repaint the "
                    "backdrop.",
                )
                if changed > 0.72:
                    print(f"  {theme['id']}: '{obj}' repainted backdrop ({changed:.2f}), retry {attempt + 1}")
                    continue
                if drift > MAX_DRIFT:
                    print(f"  {theme['id']}: '{obj}' incoherent patch (drift {drift:.2f}), retry {attempt + 1}")
                    continue
                if changed < MIN_CHANGE or changed * mask_px < MIN_CHANGE_PX:
                    print(f"  {theme['id']}: '{obj}' change {changed:.2f} too small, retry {attempt + 1}")
                    continue
                if not strict_min(
                    "These two crops come from a spot-the-difference game for young children. Is there a clearly visible difference between them?",
                    "Does the newly added object look naturally drawn into the illustration — no pasted-on box, no white frame, no style clash?",
                    [_crop(base, rect, pad=60), _crop(edited, rect, pad=60)],
                ):
                    print(f"  {theme['id']}: '{obj}' judge rejected, retry {attempt + 1}")
                    continue
                current = edited
                diffs.append({"x": rect[0], "y": rect[1], "w": rect[2], "h": rect[3], "what": obj})
                placed = True
                break
            if not placed:
                print(f"  {theme['id']}: giving up on '{obj}', trying next object")
        if not placed:
            print(f"  FAIL diff {theme['id']}: object pool exhausted")

    if len(diffs) < 4:
        return None
    base.save(a_path)
    current.save(b_path)
    print(f"  diff scene OK: {theme['id']} ({len(diffs)} diffs)")
    return {
        "id": theme["id"], "name": theme["name"],
        "imageA": f"diff/{theme['id']}_a.png", "imageB": f"diff/{theme['id']}_b.png",
        "w": W, "h": H, "diffs": diffs,
    }


def gen_hidden_scene(theme: dict, out_dir: Path, seed: int) -> dict | None:
    img_path = out_dir / f"{theme['id']}.png"
    rng = random.Random(seed)
    target_names = [t[1] for t in theme["targets"]]

    # Base scene must NOT already contain a target we place (else duplicate
    # answers). A pool item spotted in the base is simply dropped from the
    # pool; the base is only regenerated if that leaves fewer than needed.
    base = None
    pool: list[tuple[str, str]] = []
    for attempt in range(3):
        candidate = generate(
            f"{theme['base']} {SCENE_STYLE} Important: do NOT include any of these anywhere: "
            + ", ".join(target_names) + ".",
            (W, H),
        )
        pool = [
            (tid, desc) for tid, desc in theme["targets"]
            if not ask_yes_no(f"Does this image contain {desc}? Look carefully.", [candidate])
        ]
        if len(pool) >= NEEDED_TARGETS:
            base = candidate
            break
        print(f"  {theme['id']}: base leaves only {len(pool)} usable targets, regenerating ({attempt + 1})")
    if base is None:
        print(f"  FAIL hidden {theme['id']}: base kept containing too many targets")
        return None

    rects = _grid_rects(5, 3, NEEDED_TARGETS, rng, margin=30)
    current = base
    targets = []
    for rect in rects:
        mask_px = rect[2] * rect[3]
        placed = False
        while pool and not placed:
            tid, desc = pool.pop(0)
            for attempt in range(3):
                edited, changed, drift = edit_local(
                    current, rect,
                    f"Add {desc} INTO the existing scenery. Keep the marked area's "
                    "current background, colors and objects exactly as they are — "
                    "just draw the new object on top of them, naturally placed, "
                    "medium-sized and clearly drawn, colorful and cute, fully visible, "
                    "matching the art style. Do NOT repaint the backdrop.",
                )
                if changed > 0.72:
                    print(f"  {theme['id']}: '{tid}' repainted backdrop ({changed:.2f}), retry {attempt + 1}")
                    continue
                if drift > MAX_DRIFT:
                    print(f"  {theme['id']}: '{tid}' incoherent patch (drift {drift:.2f}), retry {attempt + 1}")
                    continue
                if changed < 0.025 or changed * mask_px < MIN_CHANGE_PX:
                    print(f"  {theme['id']}: '{tid}' change {changed:.2f} too small, retry {attempt + 1}")
                    continue
                if not strict_min(
                    f"Does this image crop contain {desc}?",
                    f"Does {desc} look naturally drawn into the scene (not pasted on) and recognizable to a young child?",
                    [_crop(edited, rect, pad=60)],
                ):
                    print(f"  {theme['id']}: '{tid}' judge rejected, retry {attempt + 1}")
                    continue
                current = edited
                thumb = _crop(edited, rect, pad=4).resize((200, 200))
                thumb_rel = f"hidden/{theme['id']}_t_{tid}.png"
                thumb.save(out_dir / f"{theme['id']}_t_{tid}.png")
                targets.append({
                    "id": tid, "label": desc,
                    "x": rect[0], "y": rect[1], "w": rect[2], "h": rect[3],
                    "thumb": thumb_rel,
                })
                placed = True
                break
            if not placed:
                print(f"  {theme['id']}: giving up on '{tid}', trying next target")
        if not placed:
            print(f"  FAIL hidden {theme['id']}: target pool exhausted")

    if len(targets) < NEEDED_TARGETS:
        return None
    current.save(img_path)
    print(f"  hidden scene OK: {theme['id']} ({len(targets)} targets)")
    return {
        "id": theme["id"], "name": theme["name"],
        "image": f"hidden/{theme['id']}.png",
        "w": W, "h": H, "targets": targets,
    }
