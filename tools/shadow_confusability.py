#!/usr/bin/env python3
"""Shadow Match confusability gate.

Shadow Match shows the SILHOUETTE of one icon — rotated up to ±70° and
sometimes mirrored — and asks the kid to pick the sprite it belongs to. If
some other option's silhouette is the same shape, the round has two right
answers and nothing in the picture to separate them.

Whether that happens is a question about pixels, so measure it. For every
ordered pair (answer, option): take the answer's alpha mask through every
pose the game can reach for that pair, normalize both masks the way a kid
compares shapes (bounding box fitted to a common canvas, so scale and
position drop out), and keep the best intersection-over-union.

Only poses the game can actually reach count. The tiers that rotate and
mirror (medium/hard) also restrict options to the answer's own category, so
a cross-category pair is only ever seen flat — except for `nature`, whose
four members can't fill a five-choice board and backfill from everywhere.

Pairs already declared in SHADOW_TWINS (src/games/shadow/logic.ts) are
excluded from the board by the round builder, so they are reported but do
not fail the gate. Any OTHER pair over the threshold is a new collision —
usually because the art pipeline regenerated a sprite.

    python3 tools/shadow_confusability.py [--threshold 0.92] [--json out.json]

Exits non-zero if an unencoded pair clears the threshold.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPRITES = ROOT / "assets" / "game" / "spotit"
CATEGORIES_TS = ROOT / "src" / "games" / "iconCategories.ts"
SHADOW_TS = ROOT / "src" / "games" / "shadow" / "logic.ts"

# Mirrors src/games/shadow/logic.ts: rotation is (rng()-0.5)*2*70 rounded,
# mirrored is a coin flip. Sample the arc finely enough that a near-match
# cannot hide between steps.
MAX_ROTATION = 70
ROTATION_STEP = 5
CANVAS = 128

# Categories too small to fill the hard tier's five choices; the round
# builder backfills them from the whole icon set, so their answers can meet
# a rotated cross-category option.
MIN_CATEGORY_FOR_HARD = 5


def parse_block(src: str, name: str) -> dict[str, list[str]]:
    """Pull `name: ['a', 'b'],` entries out of a TS record literal."""
    body = src.split(f"{name}", 1)[1]
    out: dict[str, list[str]] = {}
    for key, items in re.findall(r"(\w+): \[([^\]]*)\]", body):
        out[key] = re.findall(r"'([^']+)'", items)
    return out


def load_categories() -> dict[str, list[str]]:
    return parse_block(CATEGORIES_TS.read_text(), "ICON_CATEGORIES: Record<string, string[]> = {")


def load_twins() -> dict[str, list[str]]:
    src = SHADOW_TS.read_text()
    if "SHADOW_TWINS" not in src:
        return {}
    return parse_block(src, "SHADOW_TWINS: Record<string, string[]> = {")


def mask_of(path: pathlib.Path) -> np.ndarray:
    """Alpha silhouette as a boolean array."""
    return np.array(Image.open(path).convert("RGBA"))[:, :, 3] > 128


def normalize(mask: np.ndarray) -> np.ndarray:
    """Crop to the silhouette's bounding box and fit it into a CANVAS square
    with the aspect ratio preserved — the same 'contain' framing the tiles
    use, and the same scale-independence a kid brings to shape matching."""
    ys, xs = np.nonzero(mask)
    if not len(ys):
        return np.zeros((CANVAS, CANVAS), dtype=bool)
    crop = mask[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]
    h, w = crop.shape
    scale = CANVAS / max(h, w)
    box = Image.fromarray(crop).resize(
        (max(1, round(w * scale)), max(1, round(h * scale))), Image.NEAREST
    )
    out = Image.new("1", (CANVAS, CANVAS), 0)
    out.paste(box, ((CANVAS - box.width) // 2, (CANVAS - box.height) // 2))
    return np.array(out, dtype=bool)


def posed(mask: np.ndarray) -> list[np.ndarray]:
    """Every normalized silhouette the transforming tiers can put on screen."""
    out = []
    for mirrored in (False, True):
        img = Image.fromarray(mask[:, ::-1] if mirrored else mask)
        for deg in range(-MAX_ROTATION, MAX_ROTATION + 1, ROTATION_STEP):
            turned = img.rotate(deg, resample=Image.NEAREST, expand=True)
            out.append(normalize(np.array(turned, dtype=bool)))
    return out


def iou(a: np.ndarray, b: np.ndarray) -> float:
    union = np.logical_or(a, b).sum()
    return float(np.logical_and(a, b).sum() / union) if union else 0.0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--threshold", type=float, default=0.92)
    ap.add_argument("--json", type=pathlib.Path)
    ap.add_argument("--top", type=int, default=15)
    args = ap.parse_args()

    paths = sorted(SPRITES.glob("*_shadow.png"))
    if not paths:
        print(f"no shadow sprites under {SPRITES}")
        return 1
    icons = [p.name.removesuffix("_shadow.png") for p in paths]

    categories = load_categories()
    twins = load_twins()
    category_of = {i: cat for cat, members in categories.items() for i in members}
    backfills = {cat for cat, members in categories.items() if len(members) < MIN_CATEGORY_FOR_HARD}

    print(f"{len(icons)} silhouettes, {len(range(-MAX_ROTATION, MAX_ROTATION + 1, ROTATION_STEP)) * 2} "
          f"poses each; {sum(len(v) for v in twins.values())} pair(s) already declared as twins")

    masks = {i: mask_of(p) for i, p in zip(icons, paths)}
    natural = {i: normalize(m) for i, m in masks.items()}
    turned = {i: posed(m) for i, m in masks.items()}
    flat = {i: normalize(m) for i, m in masks.items()}

    scores: list[tuple[float, str, str, bool, bool]] = []
    for answer in icons:
        cat = category_of.get(answer, "things")
        for option in icons:
            if option == answer:
                continue
            # Transforming tiers keep options in-category; a small category
            # backfills from everywhere, so its answers can meet anything.
            rotatable = category_of.get(option, "things") == cat or cat in backfills
            best = (max(iou(p, natural[option]) for p in turned[answer])
                    if rotatable else iou(flat[answer], natural[option]))
            declared = option in twins.get(answer, [])
            scores.append((best, answer, option, rotatable, declared))
    scores.sort(reverse=True)

    values = np.array([s[0] for s in scores])
    print(f"IoU across {len(scores)} reachable pairs: "
          f"p50={np.percentile(values, 50):.3f} p90={np.percentile(values, 90):.3f} "
          f"p99={np.percentile(values, 99):.3f} max={values.max():.3f}")

    print(f"\nworst {args.top} pairs (shadow of A, in any pose that pair can reach, vs sprite B):")
    for best, a, b, rot, declared in scores[:args.top]:
        note = "  [declared twin]" if declared else ("  <-- NEW COLLISION" if best >= args.threshold else "")
        print(f"  {best:.3f}  {a:>10} -> {b:<11} {'rotatable' if rot else 'flat only'}{note}")

    if args.json:
        args.json.write_text(json.dumps({
            "threshold": args.threshold,
            "pairs": [{"answer": a, "option": b, "iou": round(s, 4),
                       "rotatable": rot, "declaredTwin": d} for s, a, b, rot, d in scores],
        }, indent=1))
        print(f"\nwrote {args.json}")

    new = [(s, a, b) for s, a, b, _, declared in scores if s >= args.threshold and not declared]
    if new:
        print(f"\n{len(new)} pair(s) at or above {args.threshold} not declared in SHADOW_TWINS:")
        for s, a, b in new:
            print(f"  {s:.3f}  {a} <-> {b}")
        return 1
    print(f"\nno undeclared pair reaches {args.threshold}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
