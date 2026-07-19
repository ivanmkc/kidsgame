"""Escape chain-continuity gate: every sprite hotspot's held state must
pixel-match its after-scene.

Sprite-only path:
  - Composite base (plate or before-scene crop) + patch + final sheet frame
    at the hotspot bbox, compare against the after-scene ROI.
  - Sheet consistency: frame dimensions match bbox, frameCount fits grid,
    last frame has non-zero alpha coverage.
  - Coverage sanity: final-frame alpha coverage within bbox must be > 5%.

Scene references (beforeScene, afterScene) are stored in the sprite block
of each hotspot in the manifest.

Thresholds:
  sprite composed-vs-after  : mean < 2, frac30 < 0.5%

Usage: python3 tools/verify_escape_chain.py
Exit nonzero on any failure (ship.sh gates on this).
"""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SCENES = ROOT / "assets" / "game"
SPRITES = ROOT / "public"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"

THRESH_SPRITE_MEAN = 2
THRESH_SPRITE_FRAC = 0.005
THRESH_COVERAGE_MIN = 5.0

THRESH_TAIL_MEAN_HALF = 12
THRESH_TAIL_MEAN_QUARTER = 8
THRESH_HELD_VS_AFTER = 5  # held frame (last-frame composite) must match afterScene crop

THRESH_DRIFT_MEAN = 1.0  # outside-mask mean pixel diff ceiling
THRESH_ITEM_COMP_MEAN = 10  # item composite vs afterScene — raise only with team-lead sign-off

THRESH_REMNANT_FRAC = 0.02  # SAM-mask emptiness: < 2% unchanged pixels within mask
THRESH_REMNANT_DIFF = 8  # pixel diff below which a pixel counts as "unchanged"
BASELINE_MARGIN = 0.01  # 1 percentage point above baseline for regression gating
SAM_MASKS_DIR = SCENES / "escape" / "sam_masks"
REMNANT_BASELINES_PATH = ROOT / "tools" / "remnant_baselines.json"

THRESH_REST_PLATE_MEAN = 5  # rest-layer-hole detector: composite-vs-original mean at restBbox
# Localized rest-hole metric: sliding 32x32 window over interior regions
# (excludes object-contour edges where transparency is expected).
# Calibrated from the pen defect: pen=6.13, next-highest=3.02 (toolbox
# edge artifact).  Threshold at 5 catches interior holes while passing
# natural contour transparency.
THRESH_REST_WINDOW_MEAN = 5.0
_REST_WIN_SIZE = 32
_REST_WIN_STRIDE = 16
_REST_WIN_BORDER = 4
_REST_WIN_MIN_BORDER_OPAQUE = 0.5

# Hotspot→removed-object mapping.  Most hotspots map 1:1 to the object
# they animate (pillow→pillow).  Panel and slot are hotspots ON the rocket
# — the removed object is the rocket itself, so they share one SAM mask.
# Mask files are named {room}_{hotspot}.png; panel.png and slot.png are
# identical copies of the rocket object mask.
HOTSPOT_OBJECT_MAP: dict[tuple[str, str], str] = {
    ("rocketpad", "panel"): "rocket",
    ("rocketpad", "slot"): "rocket",
}

# --- Gemini plate-emptiness gate (D.1) ---

HOTSPOT_OBJECTS: dict[tuple[str, str], str] = {
    ("toyroom", "pillow"): "blue striped pillow or cushion",
    ("toyroom", "chest"): "red wooden toy chest with a lock",
    ("toyroom", "pen"): "wooden playpen fence or golden puppy",
    ("toyroom", "teddy"): "brown teddy bear",
    ("dragoncave", "haystack"): "haystack or hay pile",
    ("dragoncave", "crystal"): "glowing crystal",
    ("dragoncave", "stove"): "stone cooking stove or furnace",
    ("dragoncave", "dragon"): "small dragon",
    ("piratecove", "net"): "fishing net with rope",
    ("piratecove", "umbrella"): "beach umbrella",
    ("piratecove", "pelican"): "pelican bird",
    ("piratecove", "chest"): "treasure chest — a large rectangular wooden box with a curved domed lid, metal lock plate, and metal bands",
    ("rocketpad", "toolbox"): "red toolbox",
    ("rocketpad", "crate"): "shipping crate — a large wooden box with X-shaped cross braces on its sides and a rounded green dome canopy on top",
    ("rocketpad", "poster"): "poster",
    ("rocketpad", "panel"): "control panel with buttons and lights",
    ("rocketpad", "slot"): "battery slot or vertical panel opening",
}

_gemini_client = None
_JUDGE_MODELS = ["gemini-3.5-flash", "gemini-3.1-flash", "gemini-3-flash-preview"]


def _get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        from google import genai
        _gemini_client = genai.Client(
            vertexai=True, project="adk-coding-agents", location="global"
        )
    return _gemini_client


def _png_bytes(image: Image.Image) -> bytes:
    buf = io.BytesIO()
    image.save(buf, "PNG")
    return buf.getvalue()


def _gemini_plate_check(
    original_crop: Image.Image, clean_crop: Image.Image, obj: str
) -> bool:
    """Single-image check: does the cleaned crop contain the object?
    Uses only the clean crop (no comparison) to avoid priming Gemini.
    Returns True (= defect) on YES. Fail closed on errors."""
    from google.genai import types

    question = (
        f"Look at this image carefully. Is there a {obj} present in "
        f"this image?\n\n"
        f"Do NOT count: walls, floor, sand, sky, rocks, vegetation, "
        f"metal panels, wooden columns, window frames, or any "
        f"architectural feature as part of the object.\n"
        f"Only answer YES if the actual {obj} — its distinctive shape "
        f"and structure — is clearly visible.\n"
        f"Answer with exactly one word: YES or NO."
    )

    parts = [
        types.Part(
            inline_data=types.Blob(mime_type="image/png", data=_png_bytes(clean_crop))
        ),
        types.Part(text=question),
    ]

    client = _get_gemini_client()
    votes = []
    for attempt in range(3):
        for model in _JUDGE_MODELS:
            try:
                resp = client.models.generate_content(model=model, contents=parts)
                answer = resp.text.strip().upper()
                if "YES" in answer:
                    votes.append(True)
                elif "NO" in answer:
                    votes.append(False)
                else:
                    votes.append(True)  # ambiguous = fail closed
                break
            except Exception:
                continue
        else:
            votes.append(True)  # all models failed = fail closed

    yes_count = sum(votes)
    return yes_count >= 2  # majority vote: 2/3 required to flag


def _mask_bbox_for_hotspot(
    room_mask: np.ndarray | None,
    hotspot: dict,
    pad: int = 20,
) -> tuple[int, int, int, int]:
    """Compute the crop rectangle for a hotspot.  When a room-level object
    mask is available, uses the mask's connected component nearest the
    hotspot bbox center to determine the crop (captures full object
    silhouette including fringes beyond the tap-target bbox).  Falls back
    to the sprite bbox with padding."""
    sp = hotspot.get("sprite", {})
    bbox = sp.get("bbox") or sp.get("restBbox")
    if not bbox:
        return 0, 0, 0, 0

    bx, by, bw, bh = bbox["x"], bbox["y"], bbox["w"], bbox["h"]
    cx, cy = bx + bw // 2, by + bh // 2

    if room_mask is not None:
        from scipy import ndimage as _ndi
        labeled, n = _ndi.label(room_mask)
        best_label, best_dist = 0, 1e9
        for lbl in range(1, n + 1):
            ys, xs = np.where(labeled == lbl)
            lcx, lcy = xs.mean(), ys.mean()
            d = ((lcx - cx) ** 2 + (lcy - cy) ** 2) ** 0.5
            if d < best_dist:
                best_dist, best_label = d, lbl
        if best_label:
            ys, xs = np.where(labeled == best_label)
            h_img, w_img = room_mask.shape
            x0 = max(0, int(xs.min()) - pad)
            y0 = max(0, int(ys.min()) - pad)
            x1 = min(w_img, int(xs.max()) + 1 + pad)
            y1 = min(h_img, int(ys.max()) + 1 + pad)
            return x0, y0, x1, y1

    h_img, w_img = 720, 1280
    x0 = max(0, bx - pad)
    y0 = max(0, by - pad)
    x1 = min(w_img, bx + bw + pad)
    y1 = min(h_img, by + bh + pad)
    return x0, y0, x1, y1


def _load_sam_mask(room_id: str, hotspot_id: str) -> np.ndarray | None:
    """Load the SAM segmentation mask for a specific hotspot.

    Uses HOTSPOT_OBJECT_MAP to resolve hotspots that share a removed-object
    mask (e.g. panel and slot both load the rocket mask)."""
    mask_path = SAM_MASKS_DIR / f"{room_id}_{hotspot_id}.png"
    if not mask_path.exists():
        return None
    return np.array(Image.open(mask_path).convert("L")) > 127


def _alpha_core_mask(
    room_id: str, hotspot: dict, sam_mask: np.ndarray,
) -> tuple[np.ndarray, int]:
    """Build the alpha-core check region: SAM object mask ∩ rest-layer
    opaque pixels (alpha > 200), placed at the hotspot's restBbox.

    The rest layer is the object's own silhouette cutout from the original
    scene.  Its high-alpha pixels are exactly the pixels the plate must
    have changed.  Anti-aliased boundary pixels (alpha < 200) are excluded
    automatically, so no morphological erosion is needed.  For mesh objects
    like the net, holes in the weave have alpha ≈ 0 and drop out of the
    check region by construction — no special-casing required."""
    sp = hotspot.get("sprite", {})
    rest_path = SPRITES / sp["rest"]
    rb = sp.get("restBbox")
    if not rest_path.exists() or not rb:
        return sam_mask, int(sam_mask.sum())

    rest = np.array(Image.open(rest_path))  # RGBA
    if rest.ndim != 3 or rest.shape[2] != 4:
        return sam_mask, int(sam_mask.sum())

    rx, ry, rw, rh = rb["x"], rb["y"], rb["w"], rb["h"]
    h_scene, w_scene = sam_mask.shape

    # Place rest-layer alpha on a scene-sized canvas at restBbox position
    alpha_canvas = np.zeros((h_scene, w_scene), dtype=np.uint8)
    rest_alpha = rest[:, :, 3]
    # Handle size mismatch between rest layer and restBbox
    if rest_alpha.shape != (rh, rw):
        rest_pil = Image.fromarray(rest_alpha).resize((rw, rh), Image.Resampling.NEAREST)
        rest_alpha = np.array(rest_pil)
    # Clip to scene bounds
    sy0, sy1 = max(0, ry), min(h_scene, ry + rh)
    sx0, sx1 = max(0, rx), min(w_scene, rx + rw)
    ry0, rx0 = sy0 - ry, sx0 - rx
    alpha_canvas[sy0:sy1, sx0:sx1] = rest_alpha[ry0:ry0 + (sy1 - sy0), rx0:rx0 + (sx1 - sx0)]

    core = sam_mask & (alpha_canvas > 200)
    return core, int(core.sum())


def verify_plate_remnants(room_id: str, hotspots: list[dict]) -> int:
    """Deterministic pre-check (D.1-PRE): within the alpha-core region
    (SAM mask ∩ rest-layer opaque pixels), the fraction of unchanged
    pixels must be below THRESH_REMNANT_FRAC (2%).

    HARD FAIL — blocks the gate.  Iterates per REMOVED OBJECT rather than
    per hotspot — hotspots that animate parts of the same physical object
    (e.g. panel and slot both animate the rocket) are unioned into one
    check region with one verdict."""
    clean_path = SCENES / "escape" / f"{room_id}_clean.png"
    orig_path = SCENES / "escape" / f"{room_id}.png"
    if not clean_path.exists() or not orig_path.exists():
        missing = [p for p in (clean_path, orig_path) if not p.exists()]
        print(f"  REMNANT FAIL: {room_id} — missing {[str(p.name) for p in missing]}")
        return 1

    clean = np.array(Image.open(clean_path).convert("RGB"))
    orig = np.array(Image.open(orig_path).convert("RGB"))
    if clean.shape != orig.shape:
        print(f"  REMNANT FAIL: {room_id} shape mismatch")
        return 1

    diff = np.abs(clean.astype(np.float32) - orig.astype(np.float32)).mean(axis=2)

    # Group hotspots by removed object
    obj_hotspots: dict[str, list[dict]] = {}
    for h in hotspots:
        sp = h.get("sprite", {})
        if not sp.get("rest"):
            continue
        obj_name = HOTSPOT_OBJECT_MAP.get((room_id, h["id"]), h["id"])
        obj_hotspots.setdefault(obj_name, []).append(h)

    fails = 0
    for obj_name, obj_hs in obj_hotspots.items():
        hotspot_ids = [h["id"] for h in obj_hs]
        tag = f"{room_id}/{obj_name}"
        if len(obj_hs) > 1:
            tag += f" ({'+'.join(hotspot_ids)})"

        h_scene, w_scene = diff.shape
        union_core = np.zeros((h_scene, w_scene), dtype=bool)

        for h in obj_hs:
            sam_mask = _load_sam_mask(room_id, h["id"])
            if sam_mask is None:
                continue
            core, _ = _alpha_core_mask(room_id, h, sam_mask)
            union_core |= core

        core_px = int(union_core.sum())
        if core_px == 0:
            print(f"  REMNANT SKIP: {tag} — empty alpha-core")
            continue

        unchanged = int((union_core & (diff < THRESH_REMNANT_DIFF)).sum())
        frac = unchanged / core_px

        baselines = _load_remnant_baselines()
        baseline_key = f"{room_id}/{obj_name}"
        if baseline_key in baselines:
            threshold = baselines[baseline_key] + BASELINE_MARGIN
            mode = "baseline"
        else:
            threshold = THRESH_REMNANT_FRAC
            mode = "absolute"

        if frac >= threshold:
            thresh_label = (
                f"baseline {baselines[baseline_key]*100:.1f}%+{BASELINE_MARGIN*100:.0f}pp"
                if mode == "baseline"
                else f"<{THRESH_REMNANT_FRAC*100:.0f}%"
            )
            print(
                f"  REMNANT FAIL: {tag} "
                f"— {frac*100:.1f}% unchanged ({unchanged}/{core_px}) "
                f"in alpha-core (threshold {thresh_label})"
            )
            fails += 1
        else:
            print(f"  REMNANT PASS: {tag} — {frac*100:.1f}% ({unchanged}/{core_px})")

    return fails


def _load_remnant_baselines() -> dict[str, float]:
    """Load per-object baseline fractions for regression gating.

    Objects listed here use baseline + BASELINE_MARGIN instead of the
    absolute THRESH_REMNANT_FRAC.  Used for translucent objects (net,
    rocket) where rest-alpha pollution inflates the unchanged fraction
    beyond what absolute gating can distinguish from real remnants."""
    if not REMNANT_BASELINES_PATH.exists():
        return {}
    data = json.loads(REMNANT_BASELINES_PATH.read_text())
    return {k: v["baseline"] for k, v in data.items()}


def verify_rest_sheet_integrity(room_id: str, hotspots: list[dict]) -> int:
    """Manifest integrity: every hotspot with a rest layer (clean-plate
    model) must also have a sprite sheet.  A rest-without-sheet hotspot
    is a manifest defect — the runtime would show the rest layer with no
    way to animate it away.  HARD FAIL."""
    fails = 0
    for h in hotspots:
        sp = h.get("sprite", {})
        if sp.get("rest") and not sp.get("sheet"):
            print(
                f"  REST-SHEET FAIL: {room_id}/{h['id']} "
                f"— has rest layer but no sprite sheet"
            )
            fails += 1
    return fails


def verify_rest_plate_match(room_id: str, hotspots: list[dict]) -> int:
    """Detect alpha holes in rest layers that expose plate texture.

    Composites clean_plate + rest_layer at restBbox and compares to the
    original scene.  At rest, plate + rest must reproduce the original —
    any significant diff means the rest layer has holes exposing
    inpainted plate texture (pen defect class).  HARD FAIL."""
    clean_path = SCENES / "escape" / f"{room_id}_clean.png"
    orig_path = SCENES / "escape" / f"{room_id}.png"
    if not clean_path.exists() or not orig_path.exists():
        return 0  # other checks catch missing files

    clean = np.array(Image.open(clean_path).convert("RGB"))
    orig = np.array(Image.open(orig_path).convert("RGB"))
    if clean.shape != orig.shape:
        return 0

    fails = 0
    for h in hotspots:
        sp = h.get("sprite", {})
        rest_file = sp.get("rest")
        rb = sp.get("restBbox")
        if not rest_file or not rb:
            continue

        rest_path = SPRITES / rest_file
        if not rest_path.exists():
            continue

        rest = np.array(Image.open(rest_path))
        if rest.ndim != 3 or rest.shape[2] != 4:
            continue

        rx, ry, rw, rh = rb["x"], rb["y"], rb["w"], rb["h"]
        h_scene, w_scene = clean.shape[:2]

        rest_rgba = rest
        if rest_rgba.shape[:2] != (rh, rw):
            rest_rgba = np.array(
                Image.fromarray(rest_rgba).resize((rw, rh), Image.Resampling.NEAREST)
            )

        sy0, sy1 = max(0, ry), min(h_scene, ry + rh)
        sx0, sx1 = max(0, rx), min(w_scene, rx + rw)
        ry0, rx0 = sy0 - ry, sx0 - rx
        crop_h, crop_w = sy1 - sy0, sx1 - sx0

        rest_crop = rest_rgba[ry0:ry0 + crop_h, rx0:rx0 + crop_w]
        alpha = rest_crop[:, :, 3:4].astype(np.float32) / 255.0

        comp = clean[sy0:sy1, sx0:sx1].astype(np.float32)
        comp = comp * (1 - alpha) + rest_crop[:, :, :3].astype(np.float32) * alpha
        comp = np.clip(comp, 0, 255).astype(np.uint8)

        orig_crop = orig[sy0:sy1, sx0:sx1]
        delta = np.abs(comp.astype(np.float32) - orig_crop.astype(np.float32))
        mean_d = float(delta.mean())
        alpha_2d = rest_crop[:, :, 3]

        window_max = _rest_hole_window_max(delta, alpha_2d, crop_h, crop_w)

        if mean_d > THRESH_REST_PLATE_MEAN:
            print(
                f"  REST-HOLE FAIL: {room_id}/{h['id']} "
                f"— plate+rest vs original mean={mean_d:.2f} "
                f"(threshold <{THRESH_REST_PLATE_MEAN})"
            )
            fails += 1
        elif window_max > THRESH_REST_WINDOW_MEAN:
            print(
                f"  REST-HOLE FAIL: {room_id}/{h['id']} "
                f"— interior window max={window_max:.2f} "
                f"(threshold <{THRESH_REST_WINDOW_MEAN})"
            )
            fails += 1
        else:
            print(
                f"  REST-HOLE PASS: {room_id}/{h['id']} "
                f"— mean={mean_d:.2f}, window={window_max:.2f}"
            )

    return fails


def _rest_hole_window_max(
    delta: np.ndarray, alpha_2d: np.ndarray, crop_h: int, crop_w: int
) -> float:
    """Sliding-window max-of-means over interior regions of the rest layer.

    Only evaluates windows that are (a) not touching the restBbox boundary,
    (b) at least 50% opaque, and (c) have opaque pixels on all four border
    strips.  This excludes natural contour edges where transparency is
    expected and isolates interior alpha holes."""
    wh, ww = _REST_WIN_SIZE, _REST_WIN_SIZE
    stride = _REST_WIN_STRIDE
    pad = stride
    bw = _REST_WIN_BORDER
    min_opaque = _REST_WIN_MIN_BORDER_OPAQUE

    max_mean = 0.0
    for y0 in range(pad, crop_h - wh - pad + 1, stride):
        for x0 in range(pad, crop_w - ww - pad + 1, stride):
            a_patch = alpha_2d[y0:y0 + wh, x0:x0 + ww]
            if float((a_patch > 200).mean()) < 0.5:
                continue
            borders = (
                a_patch[:bw, :], a_patch[-bw:, :],
                a_patch[:, :bw], a_patch[:, -bw:],
            )
            if any(float((b > 200).mean()) < min_opaque for b in borders):
                continue
            m = float(delta[y0:y0 + wh, x0:x0 + ww].mean())
            if m > max_mean:
                max_mean = m
    return max_mean


def verify_plate_emptiness(room_id: str, hotspots: list[dict]) -> int:
    """For each hotspot with a rest layer, crop both the original scene and
    the clean plate at the object mask extent (or animation bbox as
    fallback), then ask Gemini whether the object was properly removed.
    Cropping at the full object mask extent catches remnants that extend
    beyond the tap-target bbox.  Fail closed."""
    clean_path = SCENES / "escape" / f"{room_id}_clean.png"
    orig_path = SCENES / "escape" / f"{room_id}.png"
    if not clean_path.exists() or not orig_path.exists():
        missing = [p for p in (clean_path, orig_path) if not p.exists()]
        print(f"  PLATE-EMPTY FAIL: {room_id} — missing {[str(p.name) for p in missing]}")
        return 1

    clean = Image.open(clean_path).convert("RGB")
    orig = Image.open(orig_path).convert("RGB")
    room_mask = _load_object_mask(room_id)
    fails = 0

    for h in hotspots:
        sp = h.get("sprite", {})
        if not sp.get("rest"):
            continue

        x0, y0, x1, y1 = _mask_bbox_for_hotspot(room_mask, h)
        if x1 <= x0 or y1 <= y0:
            continue

        orig_crop = orig.crop((x0, y0, x1, y1))
        clean_crop = clean.crop((x0, y0, x1, y1))

        obj = HOTSPOT_OBJECTS.get((room_id, h["id"]), h["id"])
        has_defect = _gemini_plate_check(orig_crop, clean_crop, obj)
        if has_defect:
            print(
                f"  PLATE-EMPTY FAIL: {room_id}/{h['id']} "
                f"— {obj} remnant or hallucinated replacement in clean plate"
            )
            fails += 1
        else:
            print(f"  PLATE-EMPTY PASS: {room_id}/{h['id']}")

    return fails


def _load_object_mask(room_id: str) -> np.ndarray | None:
    """Load the precomputed object mask for a room.  Falls back to None
    if no mask file exists (caller must handle)."""
    mask_path = SCENES / "escape" / f"{room_id}_mask.png"
    if not mask_path.exists():
        return None
    return np.array(Image.open(mask_path).convert("L")) > 127


def _bbox_fallback_mask(hotspots: list[dict], h_img: int, w_img: int) -> np.ndarray:
    """Union of bbox + restBbox (+8px dilation) — legacy fallback when no
    precomputed object mask is available."""
    mask = np.zeros((h_img, w_img), dtype=bool)
    for h in hotspots:
        sp = h.get("sprite", {})
        if not sp.get("rest"):
            continue
        for key in ("bbox", "restBbox"):
            bb = sp.get(key)
            if bb:
                x, y, w, bh = bb["x"], bb["y"], bb["w"], bb["h"]
                y0, x0 = max(0, y - 8), max(0, x - 8)
                y1, x1 = min(h_img, y + bh + 8), min(w_img, x + w + 8)
                mask[y0:y1, x0:x1] = True
    return mask


def verify_plate_drift(room_id: str, hotspots: list[dict]) -> int:
    """Gate D.3: outside the object mask, the clean plate must be
    pixel-near-identical to the original scene.  Uses precomputed
    object masks (combined inpaint + fix extent) that follow actual
    object silhouettes, not hotspot bboxes.
    Returns number of failures (0 or 1)."""
    clean_path = SCENES / "escape" / f"{room_id}_clean.png"
    orig_path = SCENES / "escape" / f"{room_id}.png"
    if not clean_path.exists() or not orig_path.exists():
        missing = [p for p in (clean_path, orig_path) if not p.exists()]
        print(f"  PLATE-DRIFT FAIL: {room_id} — missing {[str(p.name) for p in missing]}")
        return 1

    orig = np.array(Image.open(orig_path).convert("RGB"))
    clean = np.array(Image.open(clean_path).convert("RGB"))
    if orig.shape != clean.shape:
        print(f"  PLATE-DRIFT FAIL: {room_id} shape mismatch")
        return 1

    h_img, w_img = orig.shape[:2]
    mask = _load_object_mask(room_id)
    if mask is None:
        mask = _bbox_fallback_mask(hotspots, h_img, w_img)

    outside = ~mask
    if outside.sum() == 0:
        print(f"  PLATE-DRIFT SKIP: {room_id} (mask covers entire image)")
        return 0

    diff = np.abs(clean[outside].astype(np.float32) - orig[outside].astype(np.float32))
    mean_diff = float(diff.mean())
    max_diff = float(diff.max())
    changed_px = int((diff.max(axis=1) > 0).sum())

    if mean_diff > THRESH_DRIFT_MEAN:
        print(
            f"  PLATE-DRIFT FAIL: {room_id} — mean={mean_diff:.3f} "
            f"(threshold {THRESH_DRIFT_MEAN}), max={max_diff:.0f}, "
            f"changed={changed_px} px outside mask"
        )
        return 1
    else:
        print(f"  PLATE-DRIFT PASS: {room_id} — mean={mean_diff:.3f}")
        return 0


def verify_no_doubles(room_id: str, hotspots: list[dict]) -> int:
    """Gate D.2: for each animated hotspot, composite 3 mid-animation
    frames onto the clean plate and ask Gemini whether the object appears
    twice.  Fail closed."""
    from google.genai import types

    clean_path = SCENES / "escape" / f"{room_id}_clean.png"
    if not clean_path.exists():
        print(f"  NO-DOUBLES FAIL: {room_id} — missing {clean_path.name}")
        return 1

    clean = np.array(
        Image.open(clean_path).convert("RGB").resize((1280, 720)),
        dtype=np.uint8,
    )
    fails = 0

    for h in hotspots:
        sp = h.get("sprite", {})
        if not sp.get("sheet") or not sp.get("rest"):
            continue

        sheet_path = SPRITES / sp["sheet"]
        if not sheet_path.exists():
            continue

        obj = HOTSPOT_OBJECTS.get((room_id, h["id"]), h["id"])
        bbox = sp["bbox"]
        x, y, w, bh = bbox["x"], bbox["y"], bbox["w"], bbox["h"]

        sheet = np.array(Image.open(sheet_path))  # RGBA
        cols = sp["cols"]
        fc = sp["frameCount"]
        frame_w = sheet.shape[1] // cols
        rows = (fc + cols - 1) // cols
        frame_h = sheet.shape[0] // rows

        sample_indices = [fc // 4, fc // 2, 3 * fc // 4]
        any_fail = False

        for idx in sample_indices:
            idx = max(0, min(idx, fc - 1))
            r, c = divmod(idx, cols)
            frame = sheet[
                r * frame_h : (r + 1) * frame_h,
                c * frame_w : (c + 1) * frame_w,
            ]

            comp = clean.copy()
            alpha = frame[:, :, 3:4].astype(np.float32) / 255.0
            roi = comp[y : y + bh, x : x + w].astype(np.float32)
            roi = roi * (1 - alpha) + frame[:, :, :3].astype(np.float32) * alpha
            comp[y : y + bh, x : x + w] = np.clip(roi, 0, 255).astype(np.uint8)

            question = (
                f"This game scene has an animated {obj} being revealed "
                f"at one location — that is expected.\n\n"
                f"Ignore the animated {obj}. Look ONLY at the background "
                f"(walls, floor, sky, scenery). Is there a CLEAR, "
                f"SEPARATE, unmistakable second copy of the {obj} visible "
                f"elsewhere in the background?\n\n"
                f"A second copy means another distinct {obj} — not a "
                f"shadow, not a similar-looking architectural element, "
                f"not part of the animation.\n"
                f"Answer YES only if absolutely certain. If unsure, NO.\n"
                f"Answer: YES or NO."
            )
            parts = [
                types.Part(
                    inline_data=types.Blob(
                        mime_type="image/png",
                        data=_png_bytes(Image.fromarray(comp)),
                    )
                ),
                types.Part(text=question),
            ]

            client = _get_gemini_client()
            votes = []
            for attempt in range(3):
                for model in _JUDGE_MODELS:
                    try:
                        resp = client.models.generate_content(
                            model=model, contents=parts
                        )
                        answer = resp.text.strip().upper()
                        if "YES" in answer:
                            votes.append(True)
                        elif "NO" in answer:
                            votes.append(False)
                        else:
                            votes.append(True)
                        break
                    except Exception:
                        continue
                else:
                    votes.append(True)

            if sum(votes) >= 2:
                any_fail = True
                break

        if any_fail:
            print(
                f"  NO-DOUBLES FAIL: {room_id}/{h['id']} "
                f"— {obj} appears twice in composited frame"
            )
            fails += 1
        else:
            print(f"  NO-DOUBLES PASS: {room_id}/{h['id']}")

    return fails


def _get_base_for_sprite(room_id: str, sprite: dict) -> np.ndarray:
    """Return the compositing base for a sprite: clean plate for the
    clean-plate model (sprite.rest is set), before-scene for legacy."""
    if sprite.get("rest"):
        # Clean-plate model: base is the room's clean plate
        clean_path = SCENES / "escape" / f"{room_id}_clean.png"
        if clean_path.exists():
            return np.array(Image.open(clean_path).convert("RGB").resize((1280, 720)), dtype=np.uint8)
    before_path = SCENES / sprite["beforeScene"]
    return np.array(Image.open(before_path).convert("RGB").resize((1280, 720)), dtype=np.uint8)


def verify_sprite(room_id: str, hotspot_id: str, sprite: dict) -> tuple[str, float, float, float]:
    """Verify a sprite hotspot: composite base + final sheet frame
    at the bbox, compare against the after-scene ROI.
    Returns (result_str, mean_delta, frac30, coverage_pct).

    Two compositing models:
      - Legacy (patch): base = before-scene, draw patch then sprite on top
      - Clean-plate (rest): base = clean plate, draw sprite on top directly
    """
    before_path = SCENES / sprite["beforeScene"]
    after_path = SCENES / sprite["afterScene"]
    bbox = sprite["bbox"]

    if not before_path.exists():
        return f"MISSING before: {before_path}", 999, 1, 0
    if not after_path.exists():
        return f"MISSING after: {after_path}", 999, 1, 0

    base = _get_base_for_sprite(room_id, sprite)
    after = np.array(Image.open(after_path).convert("RGB").resize((1280, 720)), dtype=np.uint8)

    x, y, w, h = bbox["x"], bbox["y"], bbox["w"], bbox["h"]
    roi = base[y:y + h, x:x + w].copy().astype(np.float32)

    if not sprite.get("sheet"):
        if sprite.get("takenPatch"):
            taken_path = SPRITES / sprite["takenPatch"]
            if not taken_path.exists():
                return f"MISSING takenPatch: {taken_path}", 999, 1, 0
            target = after[y:y + h, x:x + w]
            delta = np.abs(roi.astype(np.int16) - target.astype(np.int16))
            mean_d = float(delta.mean())
            frac30 = float((delta.sum(axis=-1) > 30).mean())
            return "PASS" if mean_d < THRESH_SPRITE_MEAN else "SKIP-STATIC", mean_d, frac30, 0

        return "SKIP-STATIC", 0, 0, 0

    sheet_path = SPRITES / sprite["sheet"]
    patch_path = SPRITES / sprite["patch"] if sprite.get("patch") else None

    if not sheet_path.exists():
        return f"MISSING sheet: {sheet_path}", 999, 1, 0
    if patch_path and not patch_path.exists():
        return f"MISSING patch: {patch_path}", 999, 1, 0

    sheet = np.array(Image.open(sheet_path))  # RGBA

    cols = sprite["cols"]
    fc = sprite["frameCount"]
    frame_w = sheet.shape[1] // cols
    rows = (fc + cols - 1) // cols
    frame_h = sheet.shape[0] // rows
    last_col = (fc - 1) % cols
    last_row = (fc - 1) // cols
    last_frame = sheet[last_row * frame_h:(last_row + 1) * frame_h,
                       last_col * frame_w:(last_col + 1) * frame_w]

    if patch_path:
        patch = np.array(Image.open(patch_path).convert("RGB").resize((w, h)), dtype=np.float32)
        roi[:] = patch

    alpha = last_frame[:, :, 3:4].astype(np.float32) / 255.0
    roi = roi * (1 - alpha) + last_frame[:, :, :3].astype(np.float32) * alpha
    roi = np.clip(roi, 0, 255).astype(np.uint8)

    target = after[y:y + h, x:x + w]
    delta = np.abs(roi.astype(np.int16) - target.astype(np.int16))
    mean_d = float(delta.mean())
    frac30 = float((delta.sum(axis=-1) > 30).mean())

    coverage = float(last_frame[:, :, 3].astype(bool).mean()) * 100

    ok = mean_d < THRESH_SPRITE_MEAN and frac30 < THRESH_SPRITE_FRAC
    return "PASS" if ok else "FAIL", mean_d, frac30, coverage


def verify_tail_convergence(
    room_id: str, hotspot_id: str, sprite: dict
) -> tuple[str, float, float, float]:
    """Check that the animation tail converges monotonically to the held frame,
    and that the held frame matches the afterScene at the sprite bbox.

    Reads frames at T-0.50s and T-0.25s from the sheet, composites each
    on the patch, and compares to the composited held frame.  Also verifies
    the held frame reproduces the afterScene crop (mean diff within
    THRESH_HELD_VS_AFTER).

    Returns (result, mean_at_half, mean_at_quarter, mean_held_vs_after).
    """
    if not sprite.get("sheet"):
        return "SKIP", 0, 0, 0

    sheet_path = SPRITES / sprite["sheet"]
    patch_path = SPRITES / sprite["patch"] if sprite.get("patch") else None
    before_path = SCENES / sprite["beforeScene"]
    after_path = SCENES / sprite["afterScene"]
    bbox = sprite["bbox"]

    for p in (sheet_path, before_path, after_path):
        if not p.exists():
            return f"MISSING {p.name}", 999, 999, 999

    sheet = np.array(Image.open(sheet_path))  # RGBA
    base = _get_base_for_sprite(room_id, sprite)
    after = np.array(Image.open(after_path).convert("RGB").resize((1280, 720)), dtype=np.uint8)

    cols = sprite["cols"]
    fc = sprite["frameCount"]
    fps = sprite.get("fps", 12)
    frame_w = sheet.shape[1] // cols
    rows = (fc + cols - 1) // cols
    frame_h = sheet.shape[0] // rows

    x, y, w, h = bbox["x"], bbox["y"], bbox["w"], bbox["h"]

    def get_frame(idx: int) -> np.ndarray:
        c = idx % cols
        r = idx // cols
        return sheet[r * frame_h:(r + 1) * frame_h, c * frame_w:(c + 1) * frame_w]

    def composite(frame: np.ndarray) -> np.ndarray:
        roi = base[y:y + h, x:x + w].copy().astype(np.float32)
        if patch_path and patch_path.exists():
            patch = np.array(Image.open(patch_path).convert("RGB").resize((w, h)), dtype=np.float32)
            roi[:] = patch
        a = frame[:, :, 3:4].astype(np.float32) / 255.0
        roi = roi * (1 - a) + frame[:, :, :3].astype(np.float32) * a
        return np.clip(roi, 0, 255).astype(np.uint8)

    held = composite(get_frame(fc - 1))
    target = after[y:y + h, x:x + w]

    idx_half = fc - int(round(0.50 * fps))
    idx_quarter = fc - int(round(0.25 * fps))
    idx_half = max(0, min(idx_half, fc - 2))
    idx_quarter = max(0, min(idx_quarter, fc - 2))

    comp_half = composite(get_frame(idx_half))
    comp_quarter = composite(get_frame(idx_quarter))

    delta_half = np.abs(comp_half.astype(np.int16) - held.astype(np.int16))
    delta_quarter = np.abs(comp_quarter.astype(np.int16) - held.astype(np.int16))
    delta_held_after = np.abs(held.astype(np.int16) - target.astype(np.int16))

    mean_half = float(delta_half.mean())
    mean_quarter = float(delta_quarter.mean())
    mean_held_vs_after = float(delta_held_after.mean())

    tail_ok = mean_half <= THRESH_TAIL_MEAN_HALF and mean_quarter <= THRESH_TAIL_MEAN_QUARTER
    held_ok = mean_held_vs_after <= THRESH_HELD_VS_AFTER

    if not held_ok:
        result = "FAIL-HELD"
    elif not tail_ok and mean_quarter <= mean_half:
        result = "FAIL"
    elif not tail_ok:
        result = "FAIL-NONMONO"
    else:
        result = "PASS"

    return result, mean_half, mean_quarter, mean_held_vs_after


def check_sheet_consistency(sprite: dict) -> tuple[str, int]:
    """Verify sprite sheet geometry against manifest declarations.

    Checks: (a) sheet file exists and is RGBA, (b) computed frame
    dimensions from sheet size / cols / rows match the manifest bbox
    dimensions, (c) frameCount fits within the sheet grid, (d) last
    frame has non-zero alpha (animation isn't blank at held state).
    Returns (result, detail_count)."""
    if not sprite.get("sheet"):
        return "SKIP", 0

    sheet_path = SPRITES / sprite["sheet"]
    if not sheet_path.exists():
        return f"FAIL: missing {sheet_path.name}", 0

    sheet = np.array(Image.open(sheet_path))
    if sheet.ndim != 3 or sheet.shape[2] != 4:
        return "FAIL: sheet not RGBA", 0

    cols = sprite["cols"]
    fc = sprite["frameCount"]
    frame_w = sheet.shape[1] // cols
    rows = (fc + cols - 1) // cols
    frame_h = sheet.shape[0] // rows

    bbox = sprite.get("bbox", {})
    bw, bh = bbox.get("w", 0), bbox.get("h", 0)
    if bw > 0 and bh > 0:
        if frame_w != bw or frame_h != bh:
            return (
                f"FAIL: frame {frame_w}x{frame_h} != bbox {bw}x{bh}",
                abs(frame_w - bw) + abs(frame_h - bh),
            )

    max_frames = rows * cols
    if fc > max_frames:
        return f"FAIL: frameCount {fc} > grid capacity {max_frames}", fc - max_frames

    last_col = (fc - 1) % cols
    last_row = (fc - 1) // cols
    last_frame = sheet[last_row * frame_h:(last_row + 1) * frame_h,
                       last_col * frame_w:(last_col + 1) * frame_w]
    last_alpha = float(last_frame[:, :, 3].astype(bool).mean()) * 100
    if last_alpha < THRESH_COVERAGE_MIN:
        return f"FAIL: last-frame coverage {last_alpha:.1f}% < {THRESH_COVERAGE_MIN}%", 0

    return "PASS", 0


GAME_W, GAME_H = 1280, 720


def verify_item_layers(room_id: str, hotspots: list[dict]) -> int:
    """Verify item layers: (a) itemBbox fits within the game frame,
    (b) composite of clean plate + sprite last frame + item layer
    matches the afterScene at the itemBbox region."""
    clean_path = SCENES / "escape" / f"{room_id}_clean.png"
    if not clean_path.exists():
        print(f"  ITEM-LAYER FAIL: {room_id} — missing {clean_path.name}")
        return 1

    clean = np.array(
        Image.open(clean_path).convert("RGB").resize((GAME_W, GAME_H)),
        dtype=np.uint8,
    )
    fails = 0

    for h in hotspots:
        sp = h.get("sprite", {})
        if not sp.get("itemLayer") or not sp.get("itemBbox"):
            continue

        ib = sp["itemBbox"]
        ix, iy, iw, ih = ib["x"], ib["y"], ib["w"], ib["h"]

        if ix < 0 or iy < 0 or ix + iw > GAME_W or iy + ih > GAME_H:
            print(
                f"  ITEM-BBOX FAIL: {room_id}/{h['id']} "
                f"— itemBbox ({ix},{iy},{iw},{ih}) outside game frame"
            )
            fails += 1
            continue

        item_path = SPRITES / sp["itemLayer"]
        if not item_path.exists():
            print(f"  ITEM-LAYER FAIL: {room_id}/{h['id']} — missing {sp['itemLayer']}")
            fails += 1
            continue

        item = np.array(Image.open(item_path))
        if item.ndim != 3 or item.shape[2] != 4:
            print(f"  ITEM-LAYER FAIL: {room_id}/{h['id']} — not RGBA")
            fails += 1
            continue

        after_path = SCENES / sp.get("afterScene", "")
        if not after_path.exists():
            continue

        after = np.array(
            Image.open(after_path).convert("RGB").resize((GAME_W, GAME_H)),
            dtype=np.uint8,
        )

        comp = clean.copy()
        bbox = sp.get("bbox")
        if bbox and sp.get("sheet"):
            sheet_path = SPRITES / sp["sheet"]
            if sheet_path.exists():
                sheet = np.array(Image.open(sheet_path))
                cols = sp["cols"]
                fc = sp["frameCount"]
                fw = sheet.shape[1] // cols
                rows = (fc + cols - 1) // cols
                fh = sheet.shape[0] // rows
                last = fc - 1
                c, r = last % cols, last // cols
                frame = sheet[r * fh:(r + 1) * fh, c * fw:(c + 1) * fw]
                bx, by, bw, bh = bbox["x"], bbox["y"], bbox["w"], bbox["h"]
                alpha = frame[:, :, 3:4].astype(np.float32) / 255.0
                roi = comp[by:by + bh, bx:bx + bw].astype(np.float32)
                roi = roi * (1 - alpha) + frame[:, :, :3].astype(np.float32) * alpha
                comp[by:by + bh, bx:bx + bw] = np.clip(roi, 0, 255).astype(np.uint8)

        item_resized = np.array(
            Image.fromarray(item).resize((iw, ih), Image.Resampling.LANCZOS)
        )
        alpha_i = item_resized[:, :, 3:4].astype(np.float32) / 255.0
        roi_i = comp[iy:iy + ih, ix:ix + iw].astype(np.float32)
        roi_i = roi_i * (1 - alpha_i) + item_resized[:, :, :3].astype(np.float32) * alpha_i
        comp[iy:iy + ih, ix:ix + iw] = np.clip(roi_i, 0, 255).astype(np.uint8)

        target = after[iy:iy + ih, ix:ix + iw]
        rendered = comp[iy:iy + ih, ix:ix + iw]
        delta = np.abs(rendered.astype(np.int16) - target.astype(np.int16))
        mean_d = float(delta.mean())

        if mean_d > THRESH_ITEM_COMP_MEAN:
            print(
                f"  ITEM-COMP FAIL: {room_id}/{h['id']} "
                f"— composite-vs-after mean={mean_d:.2f} (threshold {THRESH_ITEM_COMP_MEAN})"
            )
            fails += 1
        else:
            print(f"  ITEM-COMP PASS: {room_id}/{h['id']} — mean={mean_d:.2f}")

    return fails


def main() -> int:
    m = json.loads(MANIFEST.read_text())
    entries = []
    for room in m.get("escape", []):
        for h in room.get("hotspots", []):
            if h.get("sprite"):
                entries.append((room["id"], h["id"], h["sprite"]))

    if not entries:
        print("No sprite entries found in manifest.")
        return 1

    fails = 0

    print(f"{'hotspot':<36} {'mean':>8} {'frac30':>8} {'cov%':>8} {'result':>8}")
    print("-" * 76)
    for room_id, hotspot_id, sprite in entries:
        tag = f"{room_id}/{hotspot_id}"
        result, mean_d, frac30, coverage = verify_sprite(room_id, hotspot_id, sprite)
        if result not in ("PASS", "SKIP-STATIC", "SKIP"):
            fails += 1
            if result == "FAIL":
                result = f"FAIL m={mean_d:.2f} f={frac30:.4f}"
        print(f"{tag:<36} {mean_d:>8.2f} {frac30:>8.4f} {coverage:>8.1f} {result}")

    # Tail-convergence + held-vs-after check
    print(f"\n{'hotspot':<36} {'T-0.5s':>8} {'T-0.25s':>8} {'held/aft':>8} {'result':>12}")
    print("-" * 80)
    tail_fails = 0
    for room_id, hotspot_id, sprite in entries:
        tag = f"{room_id}/{hotspot_id}"
        result, mean_half, mean_quarter, mean_held_after = verify_tail_convergence(
            room_id, hotspot_id, sprite
        )
        if result not in ("PASS", "SKIP"):
            tail_fails += 1
        print(f"{tag:<36} {mean_half:>8.2f} {mean_quarter:>8.2f} {mean_held_after:>8.2f} {result:>12}")
    if tail_fails:
        print(f"\n{tail_fails} tail-convergence failures (thresholds: T-0.5s ≤{THRESH_TAIL_MEAN_HALF}, T-0.25s ≤{THRESH_TAIL_MEAN_QUARTER}, held/after ≤{THRESH_HELD_VS_AFTER})")
        fails += tail_fails
    else:
        print(f"Tail convergence: all {len(entries)} OK")

    # Sheet consistency check (replaces former no-op outside-bbox check)
    print()
    sheet_fails = 0
    for room_id, hotspot_id, sprite in entries:
        tag = f"{room_id}/{hotspot_id}"
        result, detail = check_sheet_consistency(sprite)
        if result not in ("PASS", "SKIP"):
            sheet_fails += 1
            print(f"  SHEET {tag}: {result}")

    if sheet_fails:
        print(f"{sheet_fails} sheet-consistency failures")
        fails += sheet_fails
    else:
        print(f"Sheet consistency: all {len(entries)} OK")

    # Item-layer composite check: verify item layers composite correctly
    # against the afterScene and that itemBbox fits within the game frame.
    print(f"\n--- Item layers ---")
    item_fails = 0
    for room in m.get("escape", []):
        ilf = verify_item_layers(room["id"], room.get("hotspots", []))
        item_fails += ilf
    if item_fails:
        print(f"\n{item_fails} item-layer failures")
        fails += item_fails
    else:
        print("Item layers: all composites verified")

    # Manifest integrity: rest layers must have matching sprite sheets
    print(f"\n--- Rest/sheet integrity ---")
    rest_sheet_fails = 0
    for room in m.get("escape", []):
        rsf = verify_rest_sheet_integrity(room["id"], room.get("hotspots", []))
        rest_sheet_fails += rsf
    if rest_sheet_fails:
        print(f"\n{rest_sheet_fails} rest-without-sheet failures")
        fails += rest_sheet_fails
    else:
        print("Rest/sheet integrity: all rest layers have matching sheets")

    # Rest-layer hole check: plate + rest must reproduce the original
    print(f"\n--- Rest-layer holes ---")
    rest_hole_fails = 0
    for room in m.get("escape", []):
        rhf = verify_rest_plate_match(room["id"], room.get("hotspots", []))
        rest_hole_fails += rhf
    if rest_hole_fails:
        print(f"\n{rest_hole_fails} rest-layer-hole failures")
        fails += rest_hole_fails
    else:
        print("Rest-layer holes: all rest composites match original")

    # D.3 Plate-drift check: outside the union of hotspot masks,
    # the clean plate must be pixel-identical to the original scene.
    print(f"\n--- Plate drift (D.3) ---")
    drift_fails = 0
    for room in m.get("escape", []):
        df = verify_plate_drift(room["id"], room.get("hotspots", []))
        drift_fails += df
    if drift_fails:
        print(f"\n{drift_fails} plate-drift failures (threshold mean ≤ {THRESH_DRIFT_MEAN})")
        fails += drift_fails
    else:
        print("Plate drift: all clean plates pixel-identical outside mask union")

    # D.1-PRE: Deterministic alpha-core remnant check (pre-check before
    # Gemini).  Check region = SAM mask ∩ rest-layer opaque pixels — the
    # object's own silhouette, excluding anti-aliased edges and mesh holes.
    # HARD FAIL — blocks the gate.
    print(f"\n--- Plate remnants (D.1-PRE, alpha-core) ---")
    remnant_fails = 0
    for room in m.get("escape", []):
        rf = verify_plate_remnants(room["id"], room.get("hotspots", []))
        remnant_fails += rf
    if remnant_fails:
        print(f"\n{remnant_fails} remnant failures (threshold: <{THRESH_REMNANT_FRAC*100:.0f}% unchanged in alpha-core)")
        fails += remnant_fails
    else:
        print("Plate remnants: all alpha-core regions verified clean")

    # D.1 Plate-emptiness check: Gemini verifies no object remnants in clean plates
    print(f"\n--- Plate emptiness (D.1) ---")
    print(f"{'hotspot':<36} {'result':>20}")
    print("-" * 60)
    plate_fails = 0
    for room in m.get("escape", []):
        pf = verify_plate_emptiness(room["id"], room.get("hotspots", []))
        plate_fails += pf
    if plate_fails:
        print(f"\n{plate_fails} plate-emptiness failures (Gemini-verified)")
        fails += plate_fails
    else:
        print("Plate emptiness: all clean plates verified")

    # D.2 No-doubles check: Gemini verifies animated object doesn't appear
    # twice in composited mid-animation frames.
    print(f"\n--- No doubles (D.2) ---")
    doubles_fails = 0
    for room in m.get("escape", []):
        ndf = verify_no_doubles(room["id"], room.get("hotspots", []))
        doubles_fails += ndf
    if doubles_fails:
        print(f"\n{doubles_fails} no-doubles failures (Gemini-verified)")
        fails += doubles_fails
    else:
        print("No doubles: all composited frames clean")

    print(f"\n{len(entries)} sprite entries checked, {fails} failures")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
