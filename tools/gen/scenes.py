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

from .detect import detect_objects, usable_detections
from .judge import ask_yes_no, strict_min
from .nbp import edit_local, generate

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


def _grid_rects(cols: int, rows: int, n: int, rng: random.Random,
                margin: int = 24, avoid: list[dict] | None = None) -> list[tuple[int, int, int, int]]:
    """Pick n grid cells (skipping cells that overlap `avoid` boxes)."""
    cells = [(c, r) for c in range(cols) for r in range(rows)]
    rng.shuffle(cells)
    cw, ch = W // cols, H // rows
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

    x, y, w, h = rect
    b = np.asarray(before.crop((x, y, x + w, y + h)).convert("RGB"), np.int16)
    a = np.asarray(after.crop((x, y, x + w, y + h)).convert("RGB"), np.int16)
    changed = (np.abs(a - b).sum(-1) > 40).astype(np.uint8) * 255

    m = Image.fromarray(changed, "L")
    m = m.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))  # close pinholes
    m = m.filter(ImageFilter.MinFilter(3))  # shave the feathered fringe
    mask = np.asarray(m) > 127
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
              attempts: int = 3, tag: str = "", judge_images: str = "pair") -> Image.Image | None:
    """One verified edit: pixel gates + strict-min judge, with retries.

    judge_images: "pair" shows the judge before+after crops (diff game);
    "after" shows only the edited crop (hidden game containment checks).
    """
    mask_px = rect[2] * rect[3]
    for attempt in range(attempts):
        edited, changed, drift = edit_local(current, rect, prompt)
        if drift > MAX_DRIFT:
            print(f"  {theme_id}: {tag} incoherent patch (drift {drift:.2f}), retry {attempt + 1}")
            continue
        if changed > MAX_CHANGE:
            print(f"  {theme_id}: {tag} repainted backdrop ({changed:.2f}), retry {attempt + 1}")
            continue
        if changed < MIN_CHANGE or changed * mask_px < MIN_CHANGE_PX:
            print(f"  {theme_id}: {tag} change {changed:.2f} too small, retry {attempt + 1}")
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
    rng = random.Random(seed)
    base = generate(f"{theme['base']} {SCENE_STYLE}", (W, H))

    dets = usable_detections(detect_objects(base), W, H)
    rng.shuffle(dets)
    print(f"  {theme['id']}: {len(dets)} usable detections: {[d['label'] for d in dets][:6]}")

    # Edit plan: up to 2 removals + 1 replacement from detections, rest adds.
    plan: list[tuple[str, dict | None]] = []
    for d in dets[:2]:
        plan.append(("remove", d))
    if len(dets) > 2:
        plan.append(("replace", dets[2]))
    while len(plan) < NUM_DIFFS:
        plan.append(("add", None))
    rng.shuffle(plan)

    add_pool = rng.sample(theme["adds"], len(theme["adds"]))
    used_rects = [dict(x=d["x"], y=d["y"], w=d["w"], h=d["h"]) for _, d in plan if d]
    free_rects = _grid_rects(4, 3, NUM_DIFFS, rng, avoid=used_rects)

    current = base
    diffs = []
    for kind, det in plan:
        placed = False
        if kind in ("remove", "replace") and det is not None:
            rect = _clamp_rect(det["x"], det["y"], det["w"], det["h"])
            if kind == "remove":
                edited = _try_edit(
                    theme["id"], current, rect,
                    f"Remove the {det['label']} completely. Seamlessly continue the "
                    "background and scenery behind it as if it was never there. Do "
                    "not add anything new.",
                    "These two crops are from a spot-the-difference game for young children. Did an object clearly disappear between the first and second crop?",
                    "In the second crop, does the area look clean and natural — no smudge, blur patch, or leftover outline where the object was?",
                    base_for_judge=base, tag=f"remove '{det['label']}'",
                )
                if edited is not None:
                    current = edited
                    diffs.append({"x": rect[0], "y": rect[1], "w": rect[2], "h": rect[3],
                                  "what": f"the {det['label']} disappeared"})
                    placed = True
            else:
                while add_pool and not placed:
                    alt = add_pool.pop(0)
                    edited = _try_edit(
                        theme["id"], current, rect,
                        f"Replace the {det['label']} with {alt}, in the same spot and "
                        "at a similar size, matching the scene's art style. Keep the "
                        "background around it exactly as it is.",
                        "These two crops are from a spot-the-difference game for young children. Did one object clearly turn into a different object?",
                        "Does the new object look naturally drawn into the illustration — no pasted-on box, no white frame, no style clash?",
                        base_for_judge=base, tag=f"replace '{det['label']}'->'{alt}'",
                    )
                    if edited is not None:
                        current = edited
                        diffs.append({"x": rect[0], "y": rect[1], "w": rect[2], "h": rect[3],
                                      "what": f"the {det['label']} became {alt}"})
                        placed = True
        else:
            while add_pool and free_rects and not placed:
                obj = add_pool.pop(0)
                rect = free_rects[0]
                edited = _try_edit(
                    theme["id"], current, rect,
                    f"Add {obj} INTO the existing scenery. Keep the marked area's "
                    "current background, colors and objects exactly as they are — "
                    "just draw the new object on top of them, naturally placed, bold "
                    "and clearly visible, matching the art style. Do NOT repaint the "
                    "backdrop.",
                    "These two crops are from a spot-the-difference game for young children. Is there a clearly visible new object in the second crop?",
                    "Does the newly added object look naturally drawn into the illustration — no pasted-on box, no white frame, no style clash?",
                    base_for_judge=base, tag=f"add '{obj}'",
                )
                if edited is not None:
                    free_rects.pop(0)
                    current = edited
                    diffs.append({"x": rect[0], "y": rect[1], "w": rect[2], "h": rect[3],
                                  "what": f"{obj} appeared"})
                    placed = True
        if not placed:
            print(f"  {theme['id']}: could not complete a '{kind}' edit")

    if len(diffs) < NUM_DIFFS:
        return None

    # Whole-scene verification: the pair must read as a clean puzzle.
    if not strict_min(
        "These are picture A and picture B of a spot-the-difference puzzle for children. Does picture B look like a clean, professional variant of A — same scene, several clear differences?",
        "Look carefully at picture B: is it free of broken patches, pasted-on rectangles, smudges, or style clashes?",
        [base, current],
    ):
        print(f"  {theme['id']}: whole-scene judge rejected the pair")
        return None

    base.save(out_dir / f"{theme['id']}_a.png")
    current.save(out_dir / f"{theme['id']}_b.png")
    print(f"  diff scene OK: {theme['id']} ({len(diffs)} diffs: {[d['what'] for d in diffs]})")
    return {
        "id": theme["id"], "name": theme["name"],
        "imageA": f"diff/{theme['id']}_a.png", "imageB": f"diff/{theme['id']}_b.png",
        "w": W, "h": H, "diffs": diffs,
    }


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

    rects = _grid_rects(5, 3, NEEDED_TARGETS, rng, margin=30)
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
                    "visible, matching the art style. Do NOT repaint the backdrop.",
                    f"Does this image crop contain {desc}?",
                    f"Does {desc} look naturally drawn into the scene (not pasted on) and recognizable to a young child?",
                    base_for_judge=current, attempts=1, tag=f"'{tid}'",
                    judge_images="after",
                )
                if edited is None:
                    continue
                cutout = object_cutout(before, edited, rect)
                if cutout is None:
                    print(f"  {theme['id']}: '{tid}' cutout empty, retry {attempt + 1}")
                    continue
                if not ask_yes_no(
                    f"This is a checklist icon for a children's seek-and-find game. Does it show {desc}, cleanly isolated (no big chunks of scenery around it)?",
                    [_on_white(cutout)],
                ):
                    print(f"  {theme['id']}: '{tid}' cutout judge rejected, retry {attempt + 1}")
                    continue
                current = edited
                cutout.save(out_dir / f"{theme['id']}_t_{tid}.png")
                targets.append({
                    "id": tid, "label": desc,
                    "x": rect[0], "y": rect[1], "w": rect[2], "h": rect[3],
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
