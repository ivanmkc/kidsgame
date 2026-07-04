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
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter

from .judge import _png_part, ask_yes_no, client as _judge_client, strict_min
from .nbp import generate, imagen_remove_mask
from .sam_batch import sam_segment_batch
from .scenes import H, NEEDED_TARGETS, NUM_DIFFS, SCENE_STYLE, W, _crop, _short

# SAM 3.1 proposes masks; Gemini 3.1 refines — picks the true instance from
# labeled proposals and vetoes objects that exist twice in the scene. Gemini
# never produces coordinates; it only chooses from SAM's named masks
# (same division of labor as the pod repo's sam3_detect).
REFINE_MODEL = "gemini-3.1-pro-preview"

MIN_AREA = 1200            # px — smaller reads as noise, not an object
MAX_AREA = 0.05 * W * H    # a "target" this big is scenery, not an object
EDGE_CLEAR = 12            # object may not touch the scene border
HIT_PAD = 10
OVERLAP_PAD = 16           # hitboxes must not overlap even padded
MASK_DILATE = 14           # removal mask growth: covers soft edges + the
                           # composite's 6px erosion with room to spare


def _prefilter(cands: list[dict]) -> list[dict]:
    """Cheap deterministic gates before Gemini sees anything: confidence,
    size, border clearance; and merge away part-masks (a mask mostly inside
    a higher-scoring one is the boat's hull, not a second boat)."""
    out: list[dict] = []
    for c in sorted(cands, key=lambda d: -d["score"]):
        if c["score"] < 0.35 or not (MIN_AREA <= c["area"] <= MAX_AREA):
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


def _refined_seg(scene: Image.Image, label: str, cands: list[dict], tag: str) -> dict | None:
    """SAM proposals → Gemini 3.1 pick + uniqueness veto.

    Returns the confirmed mask, or None when Gemini can't name exactly one
    complete instance / sees another one elsewhere in the scene (gameplay-
    ambiguous). Falls back to the top proposal on repeated API failure so a
    Gemini outage degrades to the old heuristic instead of starving themes.
    """
    import json as _json

    from google.genai import types as _t

    pre = _prefilter(cands)
    if not pre:
        return None
    q = (
        f"The picture shows {len(pre)} outlined region(s), labeled 0-{len(pre) - 1}. "
        f"Which ONE label outlines exactly a single, complete {label} (not a part of it, "
        f"not it plus other things)? Also: is there any OTHER {label} visible anywhere "
        f"else in the picture, outlined or not?\n"
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
            d = _json.loads(resp.text or "")
            pick, another = int(d["pick"]), bool(d["another_elsewhere"])
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


def _remove_verified(img: Image.Image, item: dict, theme_id: str) -> Image.Image | None:
    """Inpaint one segmented object away; judge that NOTHING is left."""
    short = _short(item["obj"])
    mask = _dilated(item["seg"]["mask"])
    rect = _hitbox(item["seg"])
    for attempt in range(2):
        out, _, drift = imagen_remove_mask(img, mask)
        if drift > 0.10:
            print(f"  {theme_id}: remove '{short}' drifted ({drift:.2f}), retry {attempt + 1}")
            continue
        crop = _crop(out, rect, pad=60)
        if strict_min(
            f"Was there ever a {short} here? Answer YES only if the picture shows NO trace, outline, shadow or ghost of a {short} — the spot must look like plain scenery.",
            "Does the scenery here look natural and continuous — no smudge, blur patch, or broken area?",
            [crop],
        ):
            return out
        print(f"  {theme_id}: remove '{short}' left a trace, retry {attempt + 1}")
    return None


# ---------------------------------------------------------------- diff ----

def gen_diff_scene(theme: dict, out_dir: Path, seed: int) -> dict | None:
    rng = random.Random(seed)
    for attempt in range(3):
        objs = rng.sample(theme["adds"], len(theme["adds"]))
        base = generate(
            f"{theme['base']} Also include each of these, drawn exactly once, "
            f"clearly visible, naturally placed on the ground or a surface, not "
            f"overlapping each other: {', '.join(objs)}. {SCENE_STYLE}",
            (W, H),
        )
        prompts = [_short(o) for o in objs]
        try:
            segs = sam_segment_batch(base, prompts, tag=f"diff/{theme['id']}")
        except Exception as e:  # noqa: BLE001 — VM hiccup: next attempt re-renders anyway
            print(f"  {theme['id']}: SAM batch failed ({str(e)[:120]})")
            continue
        usable = _drop_overlaps([
            {"obj": o, "seg": s} for o, p in zip(objs, prompts)
            if (s := _refined_seg(base, p, segs.get(p, []), f"{theme['id']}/{p}"))
        ])
        if len(usable) < NUM_DIFFS:
            print(f"  {theme['id']}: only {len(usable)}/{NUM_DIFFS} segmentable objects, re-render {attempt + 1}")
            continue
        picked = usable[:NUM_DIFFS]
        rng.shuffle(picked)

        # A loses the first two (they exist only in B → "appeared");
        # B loses the other two (exist only in A → "missing").
        img_a: Image.Image | None = base
        img_b: Image.Image | None = base
        diffs = []
        ok = True
        for i, item in enumerate(picked):
            side = "A" if i < 2 else "B"
            src = img_a if side == "A" else img_b
            out = _remove_verified(src, item, theme["id"])
            if out is None:
                ok = False
                break
            if side == "A":
                img_a = out
            else:
                img_b = out
            hx, hy, hw, hh = _hitbox(item["seg"])
            what = (f"a {_short(item['obj'])} appeared" if side == "A"
                    else f"the {_short(item['obj'])} is missing")
            diffs.append({"x": hx, "y": hy, "w": hw, "h": hh, "what": what})
        if not ok:
            continue

        if not strict_min(
            "These are picture A and picture B of a spot-the-difference puzzle for children. Do they show the same scene with a few clear object differences?",
            "Look carefully at both pictures: are they free of broken patches, pasted-on rectangles, smudges, or style clashes?",
            [img_a, img_b],
        ) or ask_yes_no(
            "Look carefully at this children's illustration. Are there any pale/white rectangular patches, erased-looking smears, half-erased ghost objects, or blurry spots that look like editing mistakes? Answer YES if you see ANY such artifact.",
            [img_a],
        ) or ask_yes_no(
            "Look carefully at this children's illustration. Are there any pale/white rectangular patches, erased-looking smears, half-erased ghost objects, or blurry spots that look like editing mistakes? Answer YES if you see ANY such artifact.",
            [img_b],
        ):
            print(f"  {theme['id']}: whole-scene judge rejected the pair")
            continue

        img_a.save(out_dir / f"{theme['id']}_a.png")
        img_b.save(out_dir / f"{theme['id']}_b.png")
        print(f"  diff scene OK: {theme['id']} ({[d['what'] for d in diffs]})")
        return {
            "id": theme["id"], "name": theme["name"],
            "imageA": f"diff/{theme['id']}_a.png", "imageB": f"diff/{theme['id']}_b.png",
            "w": W, "h": H, "diffs": diffs,
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
    img = Image.fromarray(canvas).resize((256, 256), Image.Resampling.LANCZOS)
    # 1px feather so the cutout edge doesn't look razor-cut on the card
    a = img.getchannel("A").filter(ImageFilter.GaussianBlur(1))
    img.putalpha(a)
    return img


def gen_hidden_scene(theme: dict, out_dir: Path, seed: int) -> dict | None:
    rng = random.Random(seed)
    for attempt in range(3):
        chosen = rng.sample(theme["targets"], min(8, len(theme["targets"])))
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
        usable = _drop_overlaps([
            {"tid": tid, "obj": desc, "seg": s}
            for (tid, desc), p in zip(chosen, prompts)
            if (s := _refined_seg(base, p, segs.get(p, []), f"{theme['id']}/{p}"))
        ])

        targets = []
        for item in usable:
            if len(targets) == NEEDED_TARGETS:
                break
            chip = _chip(base, item["seg"])
            if not ask_yes_no(
                f"Is this a single, complete, recognizable image of {item['obj']} that a young child could identify?",
                [chip],
            ):
                print(f"  {theme['id']}: '{item['tid']}' chip rejected, trying next target")
                continue
            hx, hy, hw, hh = _hitbox(item["seg"])
            chip.save(out_dir / f"{theme['id']}_t_{item['tid']}.png")
            targets.append({
                "id": item["tid"], "label": item["obj"],
                "x": hx, "y": hy, "w": hw, "h": hh,
                "thumb": f"hidden/{theme['id']}_t_{item['tid']}.png",
            })
        if len(targets) < NEEDED_TARGETS:
            print(f"  {theme['id']}: {len(targets)}/{NEEDED_TARGETS} clean targets, re-render {attempt + 1}")
            continue

        if not ask_yes_no(
            "Does this children's seek-and-find scene look coherent and professionally illustrated — busy but natural, with no visible rectangular seams, smudges, or pasted-on patches?",
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
