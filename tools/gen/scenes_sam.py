"""SAM-first scene construction: segment → remove → inpaint.

Every object that matters is part of the ORIGINAL render, so blending is
perfect by construction — there is no pasted-in patch, no crop placement
decision, nothing that can clip an object mid-body.

  Diff:   the base render includes the candidate objects; SAM 3.1 segments
          each; branch A removes two of them, branch B removes two others
          (Imagen inpaint under the dilated silhouette). Hitboxes are the
          SAM bboxes. A removal that leaves any trace is judge-rejected.
  Hidden: the base render includes the targets; SAM segments them; the
          checklist chips are the exact mask cutouts and hitboxes the
          bboxes. Zero image editing.
"""

from __future__ import annotations

import random
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter

from .judge import _png_part, ask_text, ask_yes_no, client as _judge_client, strict_min
from .nbp import EDGE_ERODE_PX, edit as nbp_edit, generate, imagen_remove_mask
from .sam_batch import sam_segment_batch
from .scenes import H, NUM_DIFFS, SCENE_STYLE, W, _crop, _short

# SAM 3.1 proposes masks; Gemini 3.1 refines — picks the true instance from
# labeled proposals and vetoes objects that exist twice in the scene. Gemini
# never produces coordinates; it only chooses from SAM's named masks
# (same division of labor as the pod repo's sam3_detect).
REFINE_MODEL = "gemini-3.1-pro-preview"

MIN_AREA = 1200            # px — smaller reads as noise, not an object
MAX_AREA = 0.035 * W * H   # diff objects: a change this big is scenery ("hotspots not too big")
MAX_AREA_HIDDEN = 0.022 * W * H  # hidden targets must be small enough to hide
EDGE_CLEAR = 12            # object may not touch the scene border
HIT_PAD = 10
OVERLAP_PAD = 16           # hitboxes must not overlap even padded
MASK_DILATE = 14
HIDDEN_POOL_CAP = 8   # verify up to this many targets per scene
HIDDEN_POOL_MIN = 5   # game draws 5-6 per play, pool must meet this           # removal mask growth: covers soft edges + the
                           # composite's 6px erosion with room to spare


def _ask_pro(question: str, images: list) -> bool:
    """YES/NO judged by the refine model — the removal gate needs sharper
    eyes than flash (orphaned footprints and reflection ghosts slid by)."""
    from google.genai import types as _t
    for attempt in range(3):
        try:
            resp = _judge_client().models.generate_content(
                model=REFINE_MODEL,
                contents=[_t.Content(role="user", parts=[*[_png_part(im) for im in images],
                                                         _t.Part(text=question + "\nAnswer with exactly one word: YES or NO.")])],
                config=_t.GenerateContentConfig(temperature=0.0,
                                                http_options=_t.HttpOptions(timeout=120_000)),
            )
            t = (resp.text or "").strip().upper()
            if "YES" in t[:12]:
                return True
            if "NO" in t[:12]:
                return False
        except Exception as e:  # noqa: BLE001
            print(f"  WARN pro-judge attempt {attempt + 1}: {str(e)[:90]}")
    return False  # fail closed


def _prefilter(cands: list[dict], max_area: float = MAX_AREA) -> list[dict]:
    """Cheap deterministic gates before Gemini sees anything: confidence,
    size, border clearance; and merge away part-masks (a mask mostly inside
    a higher-scoring one is the boat's hull, not a second boat)."""
    out: list[dict] = []
    for c in sorted(cands, key=lambda d: -d["score"]):
        if c["score"] < 0.35 or not (MIN_AREA <= c["area"] <= max_area):
            continue
        x0, y0, x1, y1 = c["bbox"]
        if x0 < EDGE_CLEAR or y0 < EDGE_CLEAR or x1 > W - EDGE_CLEAR or y1 > H - EDGE_CLEAR:
            continue
        if any((k["mask"] & c["mask"]).sum() / max(1, c["mask"].sum()) >= 0.6 for k in out):
            continue
        out.append(c)
    return out[:6]


_LABEL_RGB = [(230, 30, 30), (30, 180, 30), (30, 80, 230), (230, 180, 20), (200, 30, 200), (20, 200, 200)]


def _overlay(scene: Image.Image, cands: list[dict]) -> Image.Image:
    """Scene with each candidate mask outlined + numbered for Gemini."""
    vis = np.asarray(scene.convert("RGB")).copy()
    for i, c in enumerate(cands):
        color = _LABEL_RGB[i % len(_LABEL_RGB)]
        m = c["mask"].astype(np.uint8)
        contours, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(vis, contours, -1, color, 3)
        x0, y0, _, _ = c["bbox"]
        cv2.putText(vis, str(i), (max(4, x0), max(28, y0 - 6)),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.1, color, 3)
    return Image.fromarray(vis)


def _refined_seg(scene: Image.Image, label: str, cands: list[dict], tag: str,
                 max_area: float = MAX_AREA) -> dict | None:
    """SAM proposals → Gemini 3.1 pick + uniqueness veto.

    Returns the confirmed mask, or None when Gemini can't name exactly one
    complete instance / sees another one elsewhere in the scene (gameplay-
    ambiguous). Falls back to the top proposal on repeated API failure so a
    Gemini outage degrades to the old heuristic instead of starving themes.
    """
    import json as _json

    from google.genai import types as _t

    pre = _prefilter(cands, max_area)
    if not pre:
        return None
    q = (
        f"The picture shows {len(pre)} outlined region(s), labeled 0-{len(pre) - 1}. "
        f"Which ONE label outlines exactly a single, complete {label} — it must clearly BE "
        f"a {label}, not a similar-looking different thing (not a part of it, "
        f"not it plus other things)? Also: is there any OTHER {label} visible anywhere "
        f"else in the picture, outlined or not — count even small, partial, decorative, "
        f"or background copies (a mini version on a shelf or pattern counts)?\n"
        'Respond ONLY with JSON: {"pick": <label number, or -1 if none fits>, '
        '"another_elsewhere": true or false}'
    )
    for attempt in range(2):
        try:
            resp = _judge_client().models.generate_content(
                model=REFINE_MODEL,
                contents=[_t.Content(role="user", parts=[_png_part(_overlay(scene, pre)),
                                                         _t.Part(text=q)])],
                config=_t.GenerateContentConfig(
                    temperature=0.1, response_mime_type="application/json",
                    http_options=_t.HttpOptions(timeout=120_000)),
            )
            # raw_decode first; the model also decorates INSIDE the object
            # ("false (label 3 is partial)") even with a JSON mime type, so
            # fall back to field extraction before burning the attempt.
            txt = (resp.text or "").strip()
            try:
                d = _json.JSONDecoder().raw_decode(txt)[0]
                pick, another = int(d["pick"]), bool(d["another_elsewhere"])
            except (ValueError, KeyError):
                import re as _re
                mp = _re.search(r'"pick"\s*:\s*(-?\d+)', txt)
                ma = _re.search(r'"another_elsewhere"\s*:\s*(true|false)', txt)
                if not (mp and ma):
                    print(f"  {tag}: refine reply unparseable: {txt[:120]!r}")
                    raise
                pick, another = int(mp.group(1)), ma.group(1) == "true"
            if pick < 0 or pick >= len(pre) or another:
                return None
            return pre[pick]
        except Exception as e:  # noqa: BLE001 — refinement outage ≠ theme starvation
            print(f"  {tag}: gemini refine attempt {attempt + 1} failed ({str(e)[:100]})")
    return pre[0] if pre[0]["score"] >= 0.45 and len(pre) == 1 else None


def _hitbox(seg: dict) -> tuple[int, int, int, int]:
    x0, y0, x1, y1 = seg["bbox"]
    x0 = max(0, x0 - HIT_PAD); y0 = max(0, y0 - HIT_PAD)
    x1 = min(W, x1 + HIT_PAD); y1 = min(H, y1 + HIT_PAD)
    return (x0, y0, x1 - x0, y1 - y0)


def _boxes_clash(a: tuple, b: tuple, pad: int = OVERLAP_PAD) -> bool:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return not (ax + aw + pad <= bx or bx + bw + pad <= ax or
                ay + ah + pad <= by or by + bh + pad <= ay)


def _drop_overlaps(items: list[dict]) -> list[dict]:
    """Greedy keep-by-score so remaining hitboxes never clash."""
    kept: list[dict] = []
    for it in sorted(items, key=lambda d: -d["seg"]["score"]):
        if all(not _boxes_clash(_hitbox(it["seg"]), _hitbox(k["seg"])) for k in kept):
            kept.append(it)
    return kept


def _dilated(mask: np.ndarray, px: int = MASK_DILATE) -> np.ndarray:
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * px + 1, 2 * px + 1))
    return cv2.dilate(mask.astype(np.uint8), k).astype(bool)


def _removal_mask(seg: dict, grow: int) -> np.ndarray:
    """Object mask + downward shadow band, dilated.

    Imagen removes exactly what the mask covers — an object-only mask
    leaves its contact shadow orphaned on the ground (audit: farm tractor,
    construction truck, playground ball). The band extends the silhouette
    down by ~35% of its height before dilation.
    """
    m = seg["mask"]
    _, y0, _, y1 = seg["bbox"]
    drop = max(6, int(0.35 * (y1 - y0)))
    shadow = np.zeros_like(m)
    shadow[drop:] = m[:-drop]
    return _dilated(m | shadow, grow)


def _change_hitbox(before: Image.Image, after: Image.Image, seg: dict,
                   pad: int = 8) -> tuple[int, int, int, int]:
    """Tight bbox of the pixels the removal ACTUALLY altered.

    The tap hotspot must center on the visual change a player sees — which
    includes the vanished shadow, not the object silhouette SAM drew — and
    carry no more padding than needed. Falls back to the object bbox if the
    diff is degenerate."""
    region = _removal_mask(seg, MASK_DILATE * 2 + 8)  # superset of any attempt's mask
    b = np.asarray(before.convert("RGB"), np.int16)
    a = np.asarray(after.convert("RGB"), np.int16)
    ch = ((np.abs(a - b).sum(-1) > 30) & region).astype(np.uint8)
    ch = cv2.morphologyEx(ch, cv2.MORPH_OPEN,
                          cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    ys, xs = np.where(ch > 0)
    if len(xs) < 200:
        return _hitbox(seg)
    x0 = max(0, int(xs.min()) - pad); y0 = max(0, int(ys.min()) - pad)
    x1 = min(W, int(xs.max()) + pad); y1 = min(H, int(ys.max()) + pad)
    return (x0, y0, x1 - x0, y1 - y0)


def _remove_verified(img: Image.Image, item: dict, theme_id: str) -> Image.Image | None:
    """Inpaint one segmented object away; a BEFORE/AFTER pair judge insists
    every trace went with it (shadow, ripples, string, held items) and that
    nothing new was painted in its place. Retry escalates the mask."""
    short = _short(item["obj"])
    rect = _hitbox(item["seg"])
    before_crop = _crop(img, rect, pad=60)
    # accept-back region stays tight regardless of how big the edit mask
    # grows on retry: collateral changes outside it are discarded.
    tight = _removal_mask(item["seg"], 8 + EDGE_ERODE_PX)
    for attempt in range(3):
        mask = _removal_mask(item["seg"], MASK_DILATE * min(attempt + 1, 2))
        if attempt < 2:
            out, _, drift = imagen_remove_mask(img, mask, tight)
        else:
            # Imagen keeps smearing here — let NBP repaint the background
            # under the same accept-back constraint and the same judge.
            print(f"  {theme_id}: '{short}' trying NBP repaint fallback")
            out, _, drift = nbp_edit(
                img, mask,
                f"the {short} has been removed: paint ONLY the natural background "
                "scenery that would continue behind where it stood, matching the "
                "art style exactly. No object, no animal, no shadow, nothing new.",
                composite_mask=tight)
        if drift > 0.10:
            print(f"  {theme_id}: remove '{short}' drifted ({drift:.2f}), retry {attempt + 1}")
            continue
        after_crop = _crop(out, rect, pad=60)
        if _ask_pro(
            f"The first picture shows the original scene with a {short}; the second shows the same spot after it was removed. Judge at the size a child sees the whole 1280px scene: faint tone or texture shifts that would be invisible at game size are ACCEPTABLE. Answer YES only if, in the SECOND picture: the {short} is fully gone with no visible ghost shape, leftover part, orphaned shadow/footprints/ripples/strings, no eye-catching smudge patch, NOTHING new drawn in its place, and no OTHER object changed or redrawn.",
            [before_crop, after_crop],
        ):
            return out
        print(f"  {theme_id}: remove '{short}' left a trace, retry {attempt + 1}")
    return None




_PALETTE = ["red", "blue", "green", "purple", "orange", "pink", "yellow", "teal"]


_ADJACENT_HUES = {
    "red": ["orange", "pink"], "orange": ["red", "yellow"], "yellow": ["orange", "gold"],
    "gold": ["yellow", "orange"], "green": ["teal", "lime"], "teal": ["green", "blue"],
    "blue": ["teal", "purple"], "purple": ["blue", "pink"], "pink": ["purple", "red"],
    "brown": ["orange", "red"], "white": ["cream", "silver"], "gray": ["silver", "blue"],
    "grey": ["silver", "blue"], "black": ["gray", "purple"], "silver": ["gray", "white"],
}


def _recolor_verified(img: Image.Image, item: dict, theme_id: str, adjacent: bool = False) -> tuple[Image.Image, str] | None:
    """Color-change difference: no background inpaint, so no trace is
    possible by construction — the rescue mechanic for backdrops where
    removals can't be invisible (snow, sand, dense decoration)."""
    import random as _r
    short = _short(item["obj"])
    rect = _hitbox(item["seg"])
    before_crop = _crop(img, rect, pad=40)
    cur = ask_text(f"In ONE word, what is the main color of the {short}?", [before_crop]).strip().lower()
    if adjacent:
        # subtle scenes: shift to a NEIGHBORING hue — spottable but not glaring
        choices = [c for c in _ADJACENT_HUES.get(cur, _PALETTE) if c not in cur] or [c for c in _PALETTE if c not in cur]
    else:
        choices = [c for c in _PALETTE if c not in cur]
    for new in _r.sample(choices, min(3, len(choices))):
        mask = _dilated(item["seg"]["mask"], 6)
        out, ch, drift = nbp_edit(
            img, mask,
            f"the exact same {short} in the exact same position with the same shape and "
            f"outline, but colored {new} instead of {cur}. Change ONLY its color; the "
            f"background must stay pixel-identical.",
            # accept back ONLY the object + a hairline: the 12px band let
            # NBP paint glow halos and redraw neighbors (space audit blockers)
            composite_mask=_dilated(item["seg"]["mask"], 3))
        # ring drift is a coarse re-render guard only: the 3px accept-back
        # composite makes halos structurally impossible and the pro-judge
        # crop question arbitrates visual quality — 0.04 (inherited from
        # the old whole-frame gate) rejected every edit in busy scenes.
        if drift > 0.25 or ch < 0.12:
            print(f"  {theme_id}: recolor '{short}' -> {new} weak (ch={ch:.2f} drift={drift:.2f})")
            continue
        after_crop = _crop(out, rect, pad=40)
        # Caption-as-verifier for "did the color take": an adjacent-hue
        # shift is subtle BY DESIGN, so a judge asked for a "clearly
        # changed" color says NO to exactly the edits we want. The caption
        # is objective; the judge below checks only integrity.
        seen = ask_text(f"In ONE word, what is the main color of the {short}?",
                        [after_crop]).strip().lower()
        if seen == cur or (seen in cur or cur in seen):
            print(f"  {theme_id}: recolor '{short}' -> {new} didn't take (still reads {seen})")
            continue
        if _ask_pro(
            f"Two crops of the same spot. Is the {short} the SAME object in the SAME place with the SAME shape and size in both — no artifacts, nothing added or removed, and everything around the {short} unchanged? (Its color is different on purpose; judge everything EXCEPT the color.)",
            [before_crop, after_crop],
        ):
            return out, f"the {short} changed color!"
        print(f"  {theme_id}: recolor '{short}' -> {new} judge rejected")
    return None


# ---------------------------------------------------------------- diff ----

def gen_diff_scene(theme: dict, out_dir: Path, seed: int) -> dict | None:
    """Pooled differences: N independent verified changes from ONE base.

    Each pool entry is a patch (the changed-state crop) the app composites
    over the base at play time — 3-4 drawn at random per playthrough,
    random side each, so a level never plays the same twice. Removals are
    independent (no branch chains): a failure just shrinks the pool, and
    the recolor rescue turns hostile spots into color-change entries.
    """
    rng = random.Random(seed)
    for attempt in range(3):
        objs = rng.sample(theme["adds"], len(theme["adds"]))
        base = generate(
            f"{theme['base']} Also include each of these, drawn exactly once, "
            f"clearly visible, each standing on a PLAIN simply-colored part of "
            f"the ground or a surface (never on patterned rugs, confetti, "
            f"sparkles or busy decoration), not overlapping each other: "
            f"{', '.join(objs)}. {SCENE_STYLE}",
            (W, H),
        )
        prompts = [_short(o) for o in objs]
        try:
            segs = sam_segment_batch(base, prompts, tag=f"diff/{theme['id']}")
        except Exception as e:  # noqa: BLE001 — VM hiccup: next attempt re-renders anyway
            print(f"  {theme['id']}: SAM batch failed ({str(e)[:120]})")
            continue
        subtle = bool(theme.get("subtle"))
        cap = MAX_AREA * 0.5 if subtle else MAX_AREA
        with ThreadPoolExecutor(4) as ex:
            refined = list(ex.map(
                lambda op: (op[0], _refined_seg(base, op[1], segs.get(op[1], []),
                                                f"{theme['id']}/{op[1]}", max_area=cap)),
                zip(objs, prompts)))
        usable = _drop_overlaps([{"obj": o, "seg": s} for o, s in refined if s])
        if len(usable) < NUM_DIFFS:
            print(f"  {theme['id']}: only {len(usable)}/{NUM_DIFFS} segmentable objects, re-render {attempt + 1}")
            continue

        def build_entry(item: dict) -> tuple[dict, Image.Image] | None:
            short = _short(item["obj"])
            if subtle:
                # subtle scenes: adjacent-hue recolor FIRST (a removal on a
                # sparse backdrop is a billboard); removal only as fallback
                r = _recolor_verified(base, item, theme["id"], adjacent=True)
                if r is not None:
                    out, kind = r[0], "recolor"
                else:
                    out = _remove_verified(base, item, theme["id"])
                    kind = "remove"
                    if out is None:
                        return None
            else:
                out = _remove_verified(base, item, theme["id"])
                kind = "remove"
                if out is None:
                    r = _recolor_verified(base, item, theme["id"])
                    if r is None:
                        return None
                    out, kind = r[0], "recolor"
            hx, hy, hw, hh = _change_hitbox(base, out, item["seg"])
            patch = out.crop((hx, hy, hx + hw, hy + hh))
            return ({"x": hx, "y": hy, "w": hw, "h": hh,
                     "name": short, "kind": kind}, patch)

        with ThreadPoolExecutor(3) as ex:
            built = list(ex.map(build_entry, usable))
        pool = []
        for entry, patch in [b for b in built if b]:
            # final hitboxes can grow past the seg-bbox check — keep-first
            if any(_boxes_clash((entry["x"], entry["y"], entry["w"], entry["h"]),
                                (q["x"], q["y"], q["w"], q["h"]), pad=12) for q in pool):
                print(f"  {theme['id']}: pool entry '{entry['name']}' clashes, dropped")
                continue
            slug = entry["name"].replace(" ", "_")[:24]
            fname = f"{theme['id']}_d_{len(pool)}_{slug}.png"
            patch.save(out_dir / fname)
            entry["patch"] = f"diff/{fname}"
            pool.append(entry)
        if len(pool) < NUM_DIFFS:
            print(f"  {theme['id']}: pool {len(pool)}/{NUM_DIFFS}, re-render {attempt + 1}")
            continue

        if ask_yes_no(
            "Look carefully at this children's illustration. Are there any pale/white rectangular patches, erased-looking smears, half-erased ghost objects, or blurry spots that look like editing mistakes? Answer YES if you see ANY such artifact.",
            [base],
        ):
            print(f"  {theme['id']}: base artifact hunt rejected")
            continue

        base.save(out_dir / f"{theme['id']}_base.png")
        print(f"  diff scene OK: {theme['id']} (pool of {len(pool)}: "
              f"{[e['name'] + ('*' if e['kind'] == 'recolor' else '') for e in pool]})")
        return {
            "id": theme["id"], "name": theme["name"],
            "image": f"diff/{theme['id']}_base.png",
            "w": W, "h": H, "pool": pool,
        }
    return None


# -------------------------------------------------------------- hidden ----

def _chip(scene: Image.Image, seg: dict) -> Image.Image:
    """256px RGBA chip = the exact scene pixels under the SAM mask."""
    mask = (seg["mask"] * 255).astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE,
                            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    x0, y0, x1, y1 = seg["bbox"]
    px, py = max(4, (x1 - x0) // 12), max(4, (y1 - y0) // 12)
    x0 = max(0, x0 - px); y0 = max(0, y0 - py)
    x1 = min(W, x1 + px); y1 = min(H, y1 + py)
    rgba = np.dstack([np.asarray(scene.convert("RGB")), mask])[y0:y1, x0:x1]
    ch, cw = rgba.shape[:2]
    side = max(ch, cw)
    canvas = np.zeros((side, side, 4), np.uint8)
    oy, ox = (side - ch) // 2, (side - cw) // 2
    canvas[oy:oy + ch, ox:ox + cw] = rgba
    from gen.chroma import resize_rgba
    img = resize_rgba(canvas, 256)
    # 1px feather so the cutout edge doesn't look razor-cut on the card
    a = img.getchannel("A").filter(ImageFilter.GaussianBlur(1))
    img.putalpha(a)
    return img


def _chip_whole(chip: Image.Image) -> bool:
    """One connected blob, no detached fragments.

    SAM masks only VISIBLE pixels, so a branch across a parrot leaves its
    tail as a floating island (audit: jungle, depot). Occlusion notches on
    a single blob are left to the judge — a hull-solidity gate would
    over-reject naturally spindly objects (the old pipeline's lesson).
    """
    a = (np.asarray(chip)[..., 3] > 32).astype(np.uint8)
    total = int(a.sum())
    if total < 400:
        return False
    n, _, stats, _ = cv2.connectedComponentsWithStats(a)
    if n <= 1:
        return False
    return stats[1:, cv2.CC_STAT_AREA].max() / total >= 0.97


def gen_hidden_scene(theme: dict, out_dir: Path, seed: int) -> dict | None:
    rng = random.Random(seed)
    for attempt in range(3):
        chosen = rng.sample(theme["targets"], min(10, len(theme["targets"])))
        descs = [t[1] for t in chosen]
        base = generate(
            f"{theme['base']} Also include each of these, drawn exactly once, small "
            f"and tucked naturally into the scenery but fully visible (never cut off "
            f"or hidden behind things): {', '.join(descs)}. {SCENE_STYLE}",
            (W, H),
        )
        prompts = [_short(d) for d in descs]
        try:
            segs = sam_segment_batch(base, prompts, tag=f"hidden/{theme['id']}")
        except Exception as e:  # noqa: BLE001
            print(f"  {theme['id']}: SAM batch failed ({str(e)[:120]})")
            continue
        with ThreadPoolExecutor(4) as ex:
            refined = list(ex.map(
                lambda tp: (tp[0][0], tp[0][1],
                            _refined_seg(base, tp[1], segs.get(tp[1], []),
                                         f"{theme['id']}/{tp[1]}", MAX_AREA_HIDDEN)),
                zip(chosen, prompts)))
        usable = _drop_overlaps([
            {"tid": tid, "obj": desc, "seg": s} for tid, desc, s in refined if s
        ])

        targets = []
        for item in usable:
            if len(targets) == HIDDEN_POOL_CAP:
                break
            chip = _chip(base, item["seg"])
            scene_crop = _crop(base, _hitbox(item["seg"]), pad=40)
            if not (_chip_whole(chip) and strict_min(
                f"The first image is a cutout sticker, the second the scene it was cut from. Is the sticker a COMPLETE {item['obj']} exactly as it appears in the scene — no missing bites or notches where something covered it, no background patches stuck to it, no parts cut off?",
                f"Would a young child instantly recognize the sticker as {item['obj']}?",
                [chip, scene_crop],
            )):
                # Occlusion broke the exact cutout. The scene and hitbox are
                # still good — redraw the CHIP as an NBP sticker anchored to
                # the scene crop (fix_thumbs pattern) instead of starving
                # the theme: 5 hidden themes exhausted 8 rounds this way.
                from fix_thumbs import redraw
                sprite = redraw(item["obj"], scene_crop)
                if sprite is None or not strict_min(
                    f"The first image is a sticker, the second a scene crop. Does the sticker show the SAME {item['obj']} as in the scene — same colors, same design, complete and not cut off at the image edges?",
                    f"Would a young child instantly recognize the sticker as {item['obj']}?",
                    [sprite, scene_crop] if sprite is not None else [scene_crop],
                ):
                    print(f"  {theme['id']}: '{item['tid']}' chip unusable + redraw failed match gate, next target")
                    continue
                print(f"  {theme['id']}: '{item['tid']}' chip redrawn from scene reference")
                chip = sprite
            hx, hy, hw, hh = _hitbox(item["seg"])
            chip.save(out_dir / f"{theme['id']}_t_{item['tid']}.png")
            targets.append({
                "id": item["tid"], "label": item["obj"],
                "x": hx, "y": hy, "w": hw, "h": hh,
                "thumb": f"hidden/{theme['id']}_t_{item['tid']}.png",
            })
        if len(targets) < HIDDEN_POOL_MIN:
            print(f"  {theme['id']}: {len(targets)}/{HIDDEN_POOL_MIN} clean targets, re-render {attempt + 1}")
            continue

        if not strict_min(
            "Does this children's seek-and-find scene look coherent and professionally illustrated — busy but natural, with no visible rectangular seams, smudges, or pasted-on patches?",
            "Is the scene completely free of text, letters, words and labels (garbled or otherwise)?",
            [base],
        ):
            print(f"  {theme['id']}: whole-scene judge rejected")
            continue

        base.save(out_dir / f"{theme['id']}.png")
        print(f"  hidden scene OK: {theme['id']} ({len(targets)} targets, zero edits)")
        return {
            "id": theme["id"], "name": theme["name"],
            "image": f"hidden/{theme['id']}.png",
            "w": W, "h": H, "targets": targets,
        }
    return None
