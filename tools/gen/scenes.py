"""Scene generation for Find the Difference and Hidden Objects.

Ground truth is guaranteed by construction: every change goes through a
patch-local masked edit (the model only sees a padded crop) composited back
so pixels outside the edit rect are untouched — the rect IS the tap hitbox.

Difference variety comes from three edit kinds:
  - remove:  a Gemini-detected object is inpainted away (background continues)
  - replace: a detected object is swapped for a different one
  - add:     a new object is painted into a free grid cell

Verification loops at three levels:
  1. pixel gates per edit (min change, backdrop-repaint ceiling, drift sanity)
  2. strict-min two-judge vision check per edit (visible + naturally blended)
  3. a whole-scene judge at the end; a failing scene is regenerated
"""

from __future__ import annotations

import random
from pathlib import Path

import numpy as np
from PIL import Image

from .judge import ask_text, ask_yes_no, strict_min
from .nbp import EDGE_ERODE_PX, edit_local, generate, keep_solid_components

W, H = 1280, 720  # matches NBP's native ~16:9 output (no squash, minimal crop)
MIN_CHANGE = 0.025
MIN_CHANGE_PX = 1500
MAX_CHANGE = 0.72   # an edit that repaints the whole rect replaced the backdrop
MAX_DRIFT = 0.60    # context-ring sanity only; judges are the quality gate
NUM_DIFFS = 4
NEEDED_TARGETS = 5

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

HIDDEN_THEMES = [
    {
        "id": "toybox",
        "name": "Toy Room",
        "base": "A cozy, busy playroom overflowing with toys: shelves with toys, a toy chest, blocks and balls scattered on a rug, stuffed animals, a rocking horse, crayon drawings pinned on the wall.",
        "targets": [
            ("duck", "a yellow rubber duck"),
            ("drum", "a little toy drum"),
            ("robot", "a small blue toy robot"),
            ("ball", "a red and white beach ball"),
            ("bear", "a brown teddy bear"),
            ("boat", "a little toy sailboat"),
            ("dino", "a green toy dinosaur"),
            ("snail", "a smiling cartoon snail"),
        ],
    },
    {
        "id": "jungle",
        "name": "Jungle",
        "base": "A lush, dense jungle scene: big leaves, vines, colorful flowers, a waterfall in the background, a monkey in a tree, butterflies, mossy rocks.",
        "targets": [
            ("parrot", "a red and blue parrot"),
            ("frog", "a plump orange frog"),
            ("chameleon", "a purple chameleon"),
            ("toucan", "a toucan with a big orange beak"),
            ("owl", "a round brown owl"),
            ("egg", "a big spotted egg in a nest"),
            ("pineapple", "a pineapple"),
            ("turtle", "a small green turtle"),
        ],
    },
    {
        "id": "kitchen",
        "name": "Kitchen",
        "base": "A warm, busy cartoon kitchen: shelves with jars and pots, a stove with a steaming pot, hanging utensils, a fruit bowl on the counter, a window with curtains, a checkered floor.",
        "targets": [
            ("mouse", "a plump grey mouse"),
            ("teapot", "a blue teapot"),
            ("fish", "a goldfish in a round bowl"),
            ("clock", "a red alarm clock"),
            ("cupcake", "a pink frosted cupcake"),
            ("donut", "a pink frosted donut"),
            ("jam", "a jar of red jam"),
            ("cheese", "a wedge of yellow cheese"),
        ],
    },
    {
        "id": "ballroom",
        "name": "Princess Ballroom",
        "base": "A grand fairytale princess ballroom: sparkling chandelier, shiny marble floor, long pink velvet curtains, a golden royal throne, flower vases, tall arched windows, a sweeping staircase.",
        "targets": [
            ("crown", "a golden crown on a cushion"),
            ("slipper", "a sparkly glass slipper"),
            ("cake", "a slice of strawberry cake"),
            ("gift", "a wrapped pink gift box"),
            ("mirror", "a golden hand mirror"),
            ("teddy", "a royal teddy bear with a red cape"),
            ("frog", "a green frog wearing a tiny crown"),
            ("pumpkin", "a round orange pumpkin carriage"),
        ],
    },
    {
        "id": "fairy",
        "name": "Fairy Garden",
        "base": "An enchanted fairy garden: giant colorful flowers, glowing lanterns, little mushroom houses with tiny doors and windows, a small pond with lily pads, sparkles in the air, mossy stones.",
        "targets": [
            ("unicorn", "a tiny white unicorn with a rainbow mane"),
            ("teacup", "a pink teacup"),
            ("star", "a glowing golden star"),
            ("gem", "a sparkling pink gem"),
            ("snail", "a little snail with a spiral shell"),
            ("hedgehog", "a small brown hedgehog"),
            ("toadstool", "a red toadstool with white dots"),
            ("bluebird", "a plump little bluebird"),
        ],
    },
]


import os

if os.environ.get("KGB_EXTRA_THEMES") == "1":
    from .scenes_extra import EXTRA_DIFF_THEMES, EXTRA_HIDDEN_THEMES
    DIFF_THEMES = DIFF_THEMES + EXTRA_DIFF_THEMES
    HIDDEN_THEMES = HIDDEN_THEMES + EXTRA_HIDDEN_THEMES


def _grid_rects(cols: int, rows: int, n: int, rng: random.Random,
                margin: int = 24, avoid: list[dict] | None = None,
                img: Image.Image | None = None) -> list[tuple[int, int, int, int]]:
    """Pick n grid cells (skipping cells that overlap `avoid` boxes).

    Row 0 is excluded: a rect in the sky band leaves NBP nothing to place an
    object ON, so grounded adds end up floating (bottle-in-the-sky).

    When `img` is given, cells are ranked quiet-first by gradient energy
    (with jitter so scenes don't all use the same spots): a random cell can
    land half-on-top of existing scenery, and the add then paints over or
    visually truncates the object under it.
    """
    cells = [(c, r) for c in range(cols) for r in range(1, rows)]
    cw, ch = W // cols, H // rows
    if img is not None:
        g = np.asarray(img.convert("L").resize((W // 8, H // 8)), np.float32)
        gy, gx = np.gradient(g)
        gm = np.hypot(gx, gy)
        scw, sch = cw // 8, ch // 8

        def busy(c: int, r: int) -> float:
            return float(gm[r * sch:(r + 1) * sch, c * scw:(c + 1) * scw].mean())

        cells.sort(key=lambda cr: busy(*cr) * rng.uniform(0.75, 1.35))
    else:
        rng.shuffle(cells)
    rects = []
    for c, r in cells:
        if len(rects) == n:
            break
        rect = (c * cw + margin, r * ch + margin, cw - 2 * margin, ch - 2 * margin)
        if avoid and any(_rects_overlap(rect, (a["x"], a["y"], a["w"], a["h"])) for a in avoid):
            continue
        rects.append(rect)
    return rects


def _rects_overlap(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> bool:
    return a[0] < b[0] + b[2] and b[0] < a[0] + a[2] and a[1] < b[1] + b[3] and b[1] < a[1] + a[3]


def _clamp_rect(x: int, y: int, w: int, h: int, pad: int = 16) -> tuple[int, int, int, int]:
    x0, y0 = max(0, x - pad), max(0, y - pad)
    x1, y1 = min(W, x + w + pad), min(H, y + h + pad)
    return (x0, y0, x1 - x0, y1 - y0)


def _crop(img: Image.Image, rect: tuple[int, int, int, int], pad: int = 12) -> Image.Image:
    x, y, w, h = rect
    return img.crop((max(0, x - pad), max(0, y - pad), min(W, x + w + pad), min(H, y + h + pad)))


def _changed_arr(before: Image.Image, after: Image.Image,
                 rect: tuple[int, int, int, int]) -> tuple[np.ndarray, np.ndarray]:
    """(after-crop, changed-pixel mask) inside rect, with the composite's
    eroded border band zeroed — pixels there can only be mask-frame paint."""
    x, y, w, h = rect
    b = np.asarray(before.crop((x, y, x + w, y + h)).convert("RGB"), np.int16)
    a = np.asarray(after.crop((x, y, x + w, y + h)).convert("RGB"), np.int16)
    changed = (np.abs(a - b).sum(-1) > 40).astype(np.uint8) * 255
    e = EDGE_ERODE_PX
    changed[:e, :] = 0; changed[-e:, :] = 0; changed[:, :e] = 0; changed[:, -e:] = 0
    return a, changed


def changed_bbox(before: Image.Image, after: Image.Image,
                 rect: tuple[int, int, int, int], pad: int = 10) -> tuple[int, int, int, int] | None:
    """Tight bbox (scene coords) of the pixels an edit changed inside rect."""
    from PIL import ImageFilter

    x, y = rect[0], rect[1]
    _, changed = _changed_arr(before, after, rect)
    m = Image.fromarray(changed, "L").filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    mask = np.asarray(m) > 127
    if mask.sum() < 400:
        return None
    ys, xs = np.where(mask)
    bx0 = max(0, x + int(xs.min()) - pad)
    by0 = max(0, y + int(ys.min()) - pad)
    bx1 = min(W, x + int(xs.max()) + pad)
    by1 = min(H, y + int(ys.max()) + pad)
    return (bx0, by0, bx1 - bx0, by1 - by0)


def object_cutout(
    before: Image.Image,
    after: Image.Image,
    rect: tuple[int, int, int, int],
    out_size: int = 256,
) -> Image.Image | None:
    """Exact RGBA cutout of the object an edit added inside `rect`.

    Because the composite preserves pixels outside the mask, the object IS
    the changed pixels: alpha = |after - before| > threshold, cleaned up
    morphologically (mask-constrained-inpaint skill, steps 3-4).
    """
    from PIL import ImageFilter

    a, changed = _changed_arr(before, after, rect)

    m = Image.fromarray(changed, "L")
    m = m.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))  # close pinholes
    m = m.filter(ImageFilter.MinFilter(3))  # shave the feathered fringe
    mask = keep_solid_components(np.asarray(m)) > 127
    if mask.sum() < 400:
        return None

    ys, xs = np.where(mask)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.dstack([a.astype(np.uint8), (mask * 255).astype(np.uint8)])[y0:y1, x0:x1]
    ch, cw = rgba.shape[:2]
    side = max(ch, cw)
    canvas = np.zeros((side, side, 4), np.uint8)
    oy, ox = (side - ch) // 2, (side - cw) // 2
    canvas[oy:oy + ch, ox:ox + cw] = rgba
    return Image.fromarray(canvas, "RGBA").resize((out_size, out_size), Image.Resampling.LANCZOS)


def _on_white(rgba: Image.Image) -> Image.Image:
    bg = Image.new("RGB", rgba.size, (255, 255, 255))
    bg.paste(rgba, mask=rgba.split()[3])
    return bg


def _try_edit(theme_id: str, current: Image.Image, rect: tuple[int, int, int, int],
              prompt: str, q1: str, q2: str, base_for_judge: Image.Image,
              attempts: int = 3, tag: str = "", judge_images: str = "pair",
              edit_fn=edit_local, max_change: float = MAX_CHANGE) -> Image.Image | None:
    """One verified edit: pixel gates + strict-min judge, with retries.

    judge_images: "pair" shows the judge before+after crops (diff game);
    "after" shows only the edited crop (hidden game containment checks).
    """
    mask_px = rect[2] * rect[3]
    for attempt in range(attempts):
        edited, changed, drift = edit_fn(current, rect, prompt)
        if drift > MAX_DRIFT:
            print(f"  {theme_id}: {tag} incoherent patch (drift {drift:.2f}), retry {attempt + 1}")
            continue
        if changed > max_change:
            print(f"  {theme_id}: {tag} repainted backdrop ({changed:.2f}), retry {attempt + 1}")
            continue
        if changed < MIN_CHANGE or changed * mask_px < MIN_CHANGE_PX:
            print(f"  {theme_id}: {tag} change {changed:.2f} too small, retry {attempt + 1}")
            continue
        # Clipping gate: an object drawn out to the crop boundary gets sliced
        # mid-body by the composite. The changed blob must clear the rect
        # edges beyond the erosion band, or the edit is rejected outright.
        hit = changed_bbox(current, edited, rect, pad=0)
        clr = EDGE_ERODE_PX + 6
        rx, ry, rw, rh = rect
        if hit is None or hit[0] < rx + clr or hit[1] < ry + clr or \
           hit[0] + hit[2] > rx + rw - clr or hit[1] + hit[3] > ry + rh - clr:
            print(f"  {theme_id}: {tag} object touches crop edge (clipped), retry {attempt + 1}")
            continue
        imgs = ([_crop(base_for_judge, rect, pad=60), _crop(edited, rect, pad=60)]
                if judge_images == "pair" else [_crop(edited, rect, pad=60)])
        if not strict_min(q1, q2, imgs):
            print(f"  {theme_id}: {tag} judge rejected, retry {attempt + 1}")
            continue
        return edited
    return None


def gen_diff_scene(theme: dict, out_dir: Path, seed: int) -> dict | None:
    for scene_attempt in range(2):
        entry = _gen_diff_scene_once(theme, out_dir, seed + scene_attempt * 7919)
        if entry:
            return entry
        print(f"  {theme['id']}: scene attempt {scene_attempt + 1} failed, regenerating from scratch")
    return None


def _gen_diff_scene_once(theme: dict, out_dir: Path, seed: int) -> dict | None:
    """Two-branch add-only construction — correct by construction.

    A and B both grow from the SAME base render: two objects are added only
    to A (the player experiences them as "disappeared" in B) and two only
    to B ("appeared"). Every pixel is either pristine shared base or a
    cleanly composited added object, so removal-fill ghosts (lingering
    horns, smears) are structurally impossible.
    """
    rng = random.Random(seed)
    base = generate(f"{theme['base']} {SCENE_STYLE}", (W, H))

    rects = _grid_rects(4, 3, NUM_DIFFS, rng, img=base)
    all_objs = rng.sample(theme["adds"], len(theme["adds"]))
    # A and B evolve independently from the same base - run both add-chains
    # in parallel (each branch stays sequential internally).
    half = len(all_objs) // 2
    branch_pools = {"A": all_objs[:half], "B": all_objs[half:]}
    branch_rects = {"A": rects[:2], "B": rects[2:]}

    def run_branch(side):
        current = base
        found = []
        pool = branch_pools[side]
        for rect in branch_rects[side]:
            placed = False
            while pool and not placed:
                obj = pool.pop(0)
                edited = _try_edit(
                    theme["id"], current, rect,
                    f"Add {obj} INTO the existing scenery. Keep the marked area's "
                    "current background, colors and objects exactly as they are - "
                    "just draw the new object on top of them, naturally placed ON "
                    "the ground or a surface (never floating in the sky), bold and "
                    "clearly visible, matching the art style. The ENTIRE object "
                    "must sit well inside the marked area with clear space around "
                    "it - it must not touch the area's edges. Do NOT repaint the "
                    "backdrop.",
                    "These two crops are from a spot-the-difference game for young children. Is there a clearly visible new object in the second crop?",
                    "Does the newly added object look naturally drawn into the illustration - no pasted-on box, no white patch behind it, no style clash?",
                    base_for_judge=base, tag=f"add[{side}] '{obj}'",
                )
                if edited is not None:
                    hit = changed_bbox(current, edited, rect) or rect
                    what = f"the {_short(obj)} is missing" if side == "A" else f"a {_short(obj)} appeared"
                    found.append({"x": hit[0], "y": hit[1], "w": hit[2], "h": hit[3], "what": what})
                    current = edited
                    placed = True
            if not placed:
                print(f"  FAIL diff {theme['id']}: branch {side} pool exhausted")
        return current, found

    from concurrent.futures import ThreadPoolExecutor as _TPE
    with _TPE(max_workers=2) as bp:
        fut_a = bp.submit(run_branch, "A")
        fut_b = bp.submit(run_branch, "B")
        img_a, diffs_a = fut_a.result()
        img_b, diffs_b = fut_b.result()
    diffs = diffs_a + diffs_b

    if len(diffs) < NUM_DIFFS:
        return None

    # Whole-scene verification: the pair must read as a clean puzzle, and an
    # inverted artifact hunt runs over BOTH branches.
    if not strict_min(
        "These are picture A and picture B of a spot-the-difference puzzle for children. Do they show the same scene with a few clear object differences?",
        "Look carefully at both pictures: are they free of broken patches, pasted-on rectangles, smudges, or style clashes?",
        [img_a, img_b],
    ) or ask_yes_no(
        "Look carefully at this children's illustration. Are there any pale/white rectangular patches, erased-looking smears, floating half-drawn objects, or blurry spots that look like editing mistakes? Answer YES if you see ANY such artifact.",
        [img_a],
    ) or ask_yes_no(
        "Look carefully at this children's illustration. Are there any pale/white rectangular patches, erased-looking smears, floating half-drawn objects, or blurry spots that look like editing mistakes? Answer YES if you see ANY such artifact.",
        [img_b],
    ):
        print(f"  {theme['id']}: whole-scene judge rejected the pair")
        return None

    img_a.save(out_dir / f"{theme['id']}_a.png")
    img_b.save(out_dir / f"{theme['id']}_b.png")
    print(f"  diff scene OK: {theme['id']} ({[d['what'] for d in diffs]})")
    return {
        "id": theme["id"], "name": theme["name"],
        "imageA": f"diff/{theme['id']}_a.png", "imageB": f"diff/{theme['id']}_b.png",
        "w": W, "h": H, "diffs": diffs,
    }


def _short(obj: str) -> str:
    """'a small white duck' -> 'white duck' (caption-friendly)."""
    words = obj.split()
    while words and words[0] in ("a", "an", "small", "little", "tiny", "big", "bright"):
        words.pop(0)
    return " ".join(words) if words else obj


def gen_hidden_scene(theme: dict, out_dir: Path, seed: int) -> dict | None:
    for scene_attempt in range(2):
        entry = _gen_hidden_scene_once(theme, out_dir, seed + scene_attempt * 104729)
        if entry:
            return entry
        print(f"  {theme['id']}: hidden scene attempt {scene_attempt + 1} failed, regenerating")
    return None


def _gen_hidden_scene_once(theme: dict, out_dir: Path, seed: int) -> dict | None:
    rng = random.Random(seed)
    target_names = [t[1] for t in theme["targets"]]

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
        return None

    rects = _grid_rects(5, 3, NEEDED_TARGETS, rng, margin=30, img=base)
    current = base
    targets = []
    for rect in rects:
        placed = False
        while pool and not placed:
            tid, desc = pool.pop(0)
            for attempt in range(3):
                before = current
                edited = _try_edit(
                    theme["id"], current, rect,
                    f"Add {desc} INTO the existing scenery. Keep the marked area's "
                    "current background, colors and objects exactly as they are — "
                    "just draw the new object on top of them, naturally placed, "
                    "medium-sized and clearly drawn, colorful and cute, fully "
                    "visible and ENTIRELY inside the marked area with clear space "
                    "around it (never touching its edges), matching the art style. Do NOT repaint the backdrop.",
                    f"Does this image crop contain {desc}?",
                    f"Does {desc} look naturally drawn into the scene (not pasted on) and recognizable to a young child?",
                    base_for_judge=current, attempts=1, tag=f"'{tid}'",
                    judge_images="after",
                )
                if edited is None:
                    continue
                cutout = object_cutout(before, edited, rect)
                if cutout is None:
                    # fall back to a plain crop; fix_thumbs redraws it later
                    print(f"  {theme['id']}: '{tid}' cutout weak - chip will be redrawn post-pass")
                    cutout = _crop(edited, rect, pad=4).convert("RGBA").resize((256, 256))
                else:
                    a = np.asarray(cutout)[..., 3] > 32
                    ys, xs = np.where(a)
                    solidity = float(a[ys.min():ys.max() + 1, xs.min():xs.max() + 1].mean()) if len(ys) else 0.0
                    if solidity < 0.30:
                        print(f"  {theme['id']}: '{tid}' chip spindly ({solidity:.2f}) - will be redrawn post-pass")
                hit = changed_bbox(before, edited, rect) or rect
                current = edited
                cutout.save(out_dir / f"{theme['id']}_t_{tid}.png")
                targets.append({
                    "id": tid, "label": desc,
                    "x": hit[0], "y": hit[1], "w": hit[2], "h": hit[3],
                    "thumb": f"hidden/{theme['id']}_t_{tid}.png",
                })
                placed = True
                break
            if not placed:
                print(f"  {theme['id']}: giving up on '{tid}', trying next target")
        if not placed:
            print(f"  FAIL hidden {theme['id']}: target pool exhausted")

    if len(targets) < NEEDED_TARGETS:
        return None

    if not ask_yes_no(
        "Does this children's seek-and-find scene look coherent and professionally illustrated — busy but natural, with no visible rectangular seams, smudges, or pasted-on patches?",
        [current],
    ):
        print(f"  {theme['id']}: whole-scene judge rejected")
        return None

    current.save(out_dir / f"{theme['id']}.png")
    print(f"  hidden scene OK: {theme['id']} ({len(targets)} targets)")
    return {
        "id": theme["id"], "name": theme["name"],
        "image": f"hidden/{theme['id']}.png",
        "w": W, "h": H, "targets": targets,
    }
