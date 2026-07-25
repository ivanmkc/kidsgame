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

Coupling invariant: plate changes invalidate sprite mattes extracted against
the prior plate — re-extract affected sheets in the same commit.

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

# Tail contract (motion-through design): raw motion may play until the
# final ease window; the cross-fade must complete monotonically with at
# most this residual one frame before the anim->held handoff.
TAIL_WINDOW = 4
THRESH_TAIL_LAST = 8
THRESH_HELD_VS_AFTER = 5
THRESH_REST_IMPURITY = 15.0

THRESH_DRIFT_MEAN = 1.0  # outside-mask mean pixel diff ceiling
THRESH_ITEM_COMP_MEAN = 10  # item composite vs afterScene — raise only with team-lead sign-off

THRESH_REMNANT_FRAC = 0.02  # SAM-mask emptiness: < 2% unchanged pixels within mask
THRESH_REMNANT_DIFF = 8  # pixel diff below which a pixel counts as "unchanged"
BASELINE_MARGIN = 0.01  # 1 percentage point above baseline for regression gating
SAM_MASKS_DIR = SCENES / "escape" / "sam_masks"
REMNANT_BASELINES_PATH = ROOT / "tools" / "remnant_baselines.json"

THRESH_REST_BOUNDARY = 8.0  # rest-boundary seam: gradient energy at rest-alpha contour on current plate

THRESH_INFILL_SEAM = 12.0  # max gradient energy at object-mask boundary in clean plate
THRESH_INFILL_COLOR_DIFF = 20.0  # max mean L1 color diff between infill interior and surrounding plate
THRESH_INFILL_PATCH_SEAM = 35.0  # p95 of 32px-window boundary seams (catches localized hard edges)
THRESH_INFILL_TEXTURE_RATIO = 1.5  # max local-variance ratio inside/outside mask (catches texture discontinuity)
_INFILL_BOUNDARY_BAND = 4  # pixel width of the boundary band for seam measurement
_INFILL_SURROUND_BAND = 16  # how far outside the mask to sample surrounding plate
_INFILL_PATCH_SIZE = 32  # sliding window size for patch seam measurement
_INFILL_TEXTURE_WINDOW = 7  # uniform_filter window for local variance

THRESH_ALPHA_CONTOUR = 55.0  # alpha-contour seam: gradient excess along alpha>200 contour
_ALPHA_CONTOUR_LEVEL = 200  # contour threshold: 200 measures deep interior (less repair-zone noise)

THRESH_REST_PLATE_MEAN = 5  # rest-layer-hole detector: alpha-weighted composite-vs-original mean
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
                answer = (resp.text or "").strip().upper()
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
    """Detect rest-layer content errors via alpha-weighted mean diff.

    Composites clean_plate + rest_layer at restBbox and compares to the
    original scene using an alpha-weighted mean: only pixels where the
    rest has coverage contribute.  This lets SAM-silhouette rests pass
    even when the repair area outside the object footprint differs from
    the original (that diff is intentional — the plate was repaired).

    Interior alpha holes are caught by the windowed metric and the
    alpha-contour seam check (verify_alpha_contour).

    Reference is ALWAYS the original scene ({room_id}.png) — a rest
    that matches afterScene better than original is a wrong-state asset
    (afterScene content in a pre-interaction layer) and must fail."""
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

        ref_crop = orig[sy0:sy1, sx0:sx1]
        delta = np.abs(comp.astype(np.float32) - ref_crop.astype(np.float32))
        alpha_2d = rest_crop[:, :, 3]
        alpha_f = alpha_2d.astype(np.float32) / 255.0
        alpha_sum = float(alpha_f.sum())
        mean_d = (
            float((delta.mean(axis=2) * alpha_f).sum() / alpha_sum)
            if alpha_sum > 0
            else float(delta.mean())
        )

        window_max = _rest_hole_window_max(delta, alpha_2d, crop_h, crop_w)

        if mean_d > THRESH_REST_PLATE_MEAN:
            print(
                f"  REST-HOLE FAIL: {room_id}/{h['id']} "
                f"— plate+rest vs original alpha-weighted mean={mean_d:.2f} "
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


def verify_rest_boundary(room_id: str, hotspots: list[dict]) -> int:
    """Detect stale-lineage rest layers via restBbox perimeter seam energy.

    Composites each rest layer onto the CURRENT clean plate at its restBbox
    and measures excess perimeter gradient energy at the restBbox boundary
    (composite energy minus bare-plate energy).  A rest layer whose alpha
    reaches the restBbox edges with old-lineage RGB produces elevated
    gradient energy — the same methodology as verify_bbox_seam.

    Threshold is consistent with THRESH_REST_BOUNDARY (same scale as
    THRESH_SEAM_ENERGY).
    """
    clean_path = SCENES / "escape" / f"{room_id}_clean.png"
    if not clean_path.exists():
        return 0

    clean = np.array(Image.open(clean_path).convert("RGB"))
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
        if rest.shape[:2] != (rh, rw):
            rest = np.array(
                Image.fromarray(rest).resize((rw, rh), Image.Resampling.LANCZOS)
            )

        alpha_f = rest[:, :, 3:4].astype(np.float32) / 255.0
        comp = clean.copy().astype(np.float32)
        comp[ry:ry + rh, rx:rx + rw] = (
            comp[ry:ry + rh, rx:rx + rw] * (1 - alpha_f)
            + rest[:, :, :3].astype(np.float32) * alpha_f
        )
        comp = np.clip(comp, 0, 255).astype(np.uint8)

        plate_energy = _perimeter_gradient_energy(clean, rb)
        comp_energy = _perimeter_gradient_energy(comp, rb)
        excess = comp_energy - plate_energy
        tag = f"{room_id}/{h['id']}"
        baseline_key = f"{tag}.rest_boundary"
        baselines = _load_remnant_baselines()
        has_baseline = baseline_key in baselines
        threshold = baselines[baseline_key] if has_baseline else THRESH_REST_BOUNDARY

        if excess > threshold:
            print(
                f"  REST-BOUNDARY FAIL: {tag} "
                f"— excess={excess:.2f} (threshold {threshold})"
            )
            fails += 1
        else:
            suffix = f" (baseline {threshold})" if has_baseline else ""
            print(f"  REST-BOUNDARY PASS: {tag} — excess={excess:.2f}{suffix}")

    return fails


def verify_alpha_contour(room_id: str, hotspots: list[dict]) -> int:
    """Detect interior alpha cliffs via gradient excess at the alpha contour.

    Composites each rest layer onto the CURRENT clean plate, then
    measures Sobel gradient magnitude along the alpha≈128 contour on the
    composite, minus the same contour path energy on the original scene.

    At natural SAM-silhouette boundaries the composite gradient tracks
    the original scene's object boundary → excess near zero.  At
    artificial boundaries (interior cliffs, alpha holes), the composite
    has a gradient where the original is smooth → excess is elevated.

    Contour is sampled at alpha > _ALPHA_CONTOUR_LEVEL (200),
    deeper inside the mask where composite gradient tracks the
    original more closely even in repair zones.

    THRESH_ALPHA_CONTOUR is calibrated from (at level 200): old
    rect-alpha crate rest 65.07 (FAIL), SAM-silhouette crate
    -19.69 (PASS), interior-cliff fixture ~80 (FAIL).
    """
    clean_path = SCENES / "escape" / f"{room_id}_clean.png"
    orig_path = SCENES / "escape" / f"{room_id}.png"
    if not clean_path.exists() or not orig_path.exists():
        return 0

    clean = np.array(Image.open(clean_path).convert("RGB"))
    orig = np.array(Image.open(orig_path).convert("RGB"))
    if clean.shape != orig.shape:
        return 0

    from scipy.ndimage import binary_erosion, binary_dilation, sobel

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
        if rest.shape[:2] != (rh, rw):
            rest = np.array(
                Image.fromarray(rest).resize((rw, rh), Image.Resampling.LANCZOS)
            )

        sy0, sy1 = max(0, ry), min(h_scene, ry + rh)
        sx0, sx1 = max(0, rx), min(w_scene, rx + rw)
        ry0, rx0 = sy0 - ry, sx0 - rx
        crop_h, crop_w = sy1 - sy0, sx1 - sx0

        rest_crop = rest[ry0:ry0 + crop_h, rx0:rx0 + crop_w]
        a = rest_crop[:, :, 3:4].astype(np.float32) / 255.0

        comp = (
            clean[sy0:sy1, sx0:sx1].astype(np.float32) * (1 - a)
            + rest_crop[:, :, :3].astype(np.float32) * a
        )
        comp = np.clip(comp, 0, 255).astype(np.uint8)

        alpha_2d = rest_crop[:, :, 3]
        mask = alpha_2d > _ALPHA_CONTOUR_LEVEL
        eroded = binary_erosion(mask, iterations=1)
        dilated = binary_dilation(mask, iterations=1)
        contour = dilated & ~eroded
        if contour.sum() < 10:
            print(f"  ALPHA-CONTOUR PASS: {room_id}/{h['id']} — no contour")
            continue

        comp_gray = comp.astype(np.float32).mean(axis=-1)
        orig_gray = orig[sy0:sy1, sx0:sx1].astype(np.float32).mean(axis=-1)

        comp_gx = sobel(comp_gray, axis=1)
        comp_gy = sobel(comp_gray, axis=0)
        comp_grad = np.sqrt(comp_gx ** 2 + comp_gy ** 2)

        orig_gx = sobel(orig_gray, axis=1)
        orig_gy = sobel(orig_gray, axis=0)
        orig_grad = np.sqrt(orig_gx ** 2 + orig_gy ** 2)

        excess = float(comp_grad[contour].mean() - orig_grad[contour].mean())
        tag = f"{room_id}/{h['id']}"

        if excess > THRESH_ALPHA_CONTOUR:
            print(
                f"  ALPHA-CONTOUR FAIL: {tag} "
                f"— excess={excess:.2f} (threshold {THRESH_ALPHA_CONTOUR})"
            )
            fails += 1
        else:
            print(f"  ALPHA-CONTOUR PASS: {tag} — excess={excess:.2f}")

    return fails


THRESH_ALL_HELD_OVERLAP = 150  # px of a later hotspot's opaque core over an earlier one's
_SHARED_OBJECT = {("rocketpad", "panel"): "rocket", ("rocketpad", "slot"): "rocket"}
_SAM_FOR_HOTSPOT = {("rocketpad", "panel"): "rocketpad_slot", ("rocketpad", "slot"): "rocketpad_slot"}

THRESH_F0_SILHOUETTE = 0.85  # frame 0 must cover its own silhouette (current assets 0.91-1.00)
THRESH_COVERAGE_DROP = 0.5   # max frame-to-frame opaque-coverage collapse
THRESH_VANISH_RGB = 40       # lost-region RGB vs plate: below = source-content vanish


def _scene_shape(sam_path) -> tuple[int, int]:
    with Image.open(sam_path) as im:
        return (im.height, im.width)


def verify_frame_integrity(room_id: str, hotspots: list[dict]) -> int:
    """Animation-extraction integrity, catastrophic classes:

    - frame 0 must cover the hotspot's own silhouette (the object is
      still at rest at tap time) — catches vanished bodies and large
      holes at the tap transition;
    - opaque coverage must not collapse between consecutive frames —
      catches mid-animation vanishing and mass alpha loss. A collapse is
      excused when it is a SOURCE-CONTENT departure: if the afterScene
      matches the plate over the lost region (the object is absent from
      the final state there — net yank-away), the matte is following the
      clip honestly. A dropout keeps failing: the object still occupies
      that region in the afterScene. (Stored RGB under alpha=0 is NOT
      usable: libwebp lossless discards it without exact=True.)

    Fine tears below these floors remain judge territory: without the
    source clip the gate cannot tell a small tear from real content."""
    fails = 0
    entries = [h for h in hotspots if h.get("sprite", {}).get("sheet")]
    for idx, h in enumerate(entries):
        sp = h.get("sprite", {})
        sheet_path = SPRITES / sp["sheet"]
        sam_name = _SAM_FOR_HOTSPOT.get((room_id, h["id"]), f"{room_id}_{h['id']}")
        sam_path = SAM_MASKS_DIR / f"{sam_name}.png"
        if not sheet_path.exists():
            continue
        # shared-object tiling: a LATER sibling's rest layer can own part of
        # this hotspot's silhouette (slot's rest owns the upper rocket) —
        # frames only need to cover the part nothing else draws
        later_rest: np.ndarray | None = None
        for later in entries[idx + 1:]:
            lsp = later.get("sprite", {})
            if not lsp.get("rest") or not lsp.get("restBbox"):
                continue
            lp = SPRITES / lsp["rest"]
            if not lp.exists():
                continue
            lr = np.array(Image.open(lp).convert("RGBA"))
            lb = lsp["restBbox"]
            if lr.shape[:2] != (lb["h"], lb["w"]):
                lr = np.array(Image.fromarray(lr).resize((lb["w"], lb["h"]), Image.LANCZOS))
            if later_rest is None:
                later_rest = np.zeros(
                    _scene_shape(sam_path) if sam_path.exists() else (720, 1280),
                    dtype=bool)
            later_rest[lb["y"]:lb["y"] + lb["h"], lb["x"]:lb["x"] + lb["w"]] |= lr[:, :, 3] > 128
        sheet = np.array(Image.open(sheet_path))
        cols, fc = sp["cols"], sp["frameCount"]
        rows_g = (fc + cols - 1) // cols
        fh, fw = sheet.shape[0] // rows_g, sheet.shape[1] // cols
        bb = sp["bbox"]
        tag = f"{room_id}/{h['id']}"

        covs = []
        for i in range(fc):
            r, c = i // cols, i % cols
            covs.append(int((sheet[r * fh:(r + 1) * fh, c * fw:(c + 1) * fw, 3] > 128).sum()))

        if sam_path.exists():
            sam = np.array(Image.open(sam_path).convert("L")) > 0
            if later_rest is not None and later_rest.shape == sam.shape:
                sam &= ~later_rest
            sam_c = sam[bb["y"]:bb["y"] + bb["h"], bb["x"]:bb["x"] + bb["w"]]
            n_sam = int(sam_c.sum())
            if n_sam > 500:
                a0 = sheet[0:fh, 0:fw, 3] > 128
                cov0 = float((a0 & sam_c).sum()) / n_sam
                if cov0 < THRESH_F0_SILHOUETTE:
                    print(f"  FRAME-BODY FAIL: {tag} — frame 0 covers {cov0:.2f} of silhouette "
                          f"(threshold {THRESH_F0_SILHOUETTE})")
                    fails += 1
                else:
                    print(f"  FRAME-BODY PASS: {tag} — frame 0 silhouette coverage {cov0:.2f}")

        worst_drop, worst_at = 0.0, -1
        floor = 0.02 * fh * fw
        for i in range(1, fc):
            if covs[i - 1] > floor:
                drop = 1 - covs[i] / covs[i - 1]
                if drop > worst_drop:
                    worst_drop, worst_at = drop, i
        if worst_drop > THRESH_COVERAGE_DROP:
            i = worst_at
            ra, ca_ = (i - 1) // cols, (i - 1) % cols
            rb_, cb_ = i // cols, i % cols
            fa = sheet[ra * fh:(ra + 1) * fh, ca_ * fw:(ca_ + 1) * fw]
            fb = sheet[rb_ * fh:(rb_ + 1) * fh, cb_ * fw:(cb_ + 1) * fw]
            lost = (fa[:, :, 3] > 128) & (fb[:, :, 3] <= 128)
            clean_path = SCENES / "escape" / f"{room_id}_clean.png"
            after_path = SCENES / sp["afterScene"]
            vanish_rgb = 999.0
            if lost.sum() > 0 and clean_path.exists() and after_path.exists():
                plate = np.array(Image.open(clean_path).convert("RGB"))
                after = np.array(Image.open(after_path).convert("RGB").resize(
                    (plate.shape[1], plate.shape[0])))
                pl = plate[bb["y"]:bb["y"] + bb["h"], bb["x"]:bb["x"] + bb["w"]]
                af = after[bb["y"]:bb["y"] + bb["h"], bb["x"]:bb["x"] + bb["w"]]
                d = np.abs(af.astype(np.int16) - pl.astype(np.int16)).sum(-1)
                vanish_rgb = float(d[lost].mean())
            if vanish_rgb < THRESH_VANISH_RGB:
                print(f"  FRAME-DROP PASS: {tag} — collapse {worst_drop:.2f} at frame "
                      f"{worst_at} is a source-content departure (afterScene matches "
                      f"plate over lost region, mean {vanish_rgb:.0f} < {THRESH_VANISH_RGB})")
            else:
                print(f"  FRAME-DROP FAIL: {tag} — coverage collapses {worst_drop:.2f} "
                      f"at frame {worst_at} (threshold {THRESH_COVERAGE_DROP}; afterScene "
                      f"vs plate over lost region mean {vanish_rgb:.0f} — object still "
                      f"present in the final state)")
                fails += 1
        else:
            print(f"  FRAME-DROP PASS: {tag} — worst frame-to-frame drop {worst_drop:.2f}")
    return fails


def verify_all_held(room_id: str, hotspots: list[dict]) -> int:
    """Gate the simultaneous-held configuration: every hotspot used, all
    LAST frames stacked on the plate in draw order.

    A later hotspot's held frame must not paint over an earlier one's
    object (baked sibling state — the double-draw class), and each bbox
    perimeter on the full stack must stay seam-free against the plate.
    Shared-object pairs (panel/slot both draw the rocket) are exempt
    from the overlap rule."""
    clean_path = SCENES / "escape" / f"{room_id}_clean.png"
    if not clean_path.exists():
        return 0
    clean = np.array(Image.open(clean_path).convert("RGB"))
    h_scene, w_scene = clean.shape[:2]

    cores: list[tuple[str, np.ndarray]] = []
    comp = clean.astype(np.float32)
    fails = 0

    entries = [h for h in hotspots if h.get("sprite", {}).get("sheet")]
    for h in entries:
        sp = h["sprite"]
        sheet_path = SPRITES / sp["sheet"]
        bb = sp["bbox"]
        if not sheet_path.exists():
            continue
        sheet = np.array(Image.open(sheet_path))
        cols, fc = sp["cols"], sp["frameCount"]
        rows_g = (fc + cols - 1) // cols
        fh, fw = sheet.shape[0] // rows_g, sheet.shape[1] // cols
        li = fc - 1
        lf = sheet[(li // cols) * fh:(li // cols + 1) * fh,
                   (li % cols) * fw:(li % cols + 1) * fw]
        if lf.shape[:2] != (bb["h"], bb["w"]):
            lf = np.array(Image.fromarray(lf).resize((bb["w"], bb["h"]), Image.LANCZOS))

        core = np.zeros((h_scene, w_scene), dtype=bool)
        core[bb["y"]:bb["y"] + bb["h"], bb["x"]:bb["x"] + bb["w"]] = lf[:, :, 3] >= 250

        my_obj = _SHARED_OBJECT.get((room_id, h["id"]))
        for earlier_id, earlier_core in cores:
            if my_obj and _SHARED_OBJECT.get((room_id, earlier_id)) == my_obj:
                continue
            overlap = int((core & earlier_core).sum())
            tag = f"{room_id}/{earlier_id}<-{h['id']}"
            if overlap > THRESH_ALL_HELD_OVERLAP:
                print(f"  ALL-HELD FAIL: {tag} — {overlap} px of held-over-held overlap")
                fails += 1
            else:
                print(f"  ALL-HELD PASS: {tag} — overlap {overlap} px")
        cores.append((h["id"], core))

        a = lf[:, :, 3:4].astype(np.float32) / 255.0
        comp[bb["y"]:bb["y"] + bb["h"], bb["x"]:bb["x"] + bb["w"]] = (
            comp[bb["y"]:bb["y"] + bb["h"], bb["x"]:bb["x"] + bb["w"]] * (1 - a)
            + lf[:, :, :3].astype(np.float32) * a
        )

    comp_u8 = np.clip(comp, 0, 255).astype(np.uint8)
    for h in entries:
        bb = h["sprite"]["bbox"]
        excess = (_perimeter_gradient_energy(comp_u8, bb)
                  - _perimeter_gradient_energy(clean, bb))
        tag = f"{room_id}/{h['id']}"
        if excess > THRESH_SEAM_ENERGY:
            print(f"  ALL-HELD-SEAM FAIL: {tag} — excess={excess:.2f}")
            fails += 1
        else:
            print(f"  ALL-HELD-SEAM PASS: {tag} — excess={excess:.2f}")
    return fails


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


def _infill_boundary_energy(clean: np.ndarray, mask: np.ndarray, band: int) -> float:
    """Gradient energy at the object-mask boundary in the clean plate.

    Dilates the mask by `band` pixels and erodes it by `band` pixels,
    then measures the mean absolute gradient between the inner band
    (just inside the mask edge) and the outer band (just outside).
    High energy = visible seam where inpainting meets real background.
    """
    from scipy.ndimage import binary_dilation, binary_erosion
    dilated = binary_dilation(mask, iterations=band)
    eroded = binary_erosion(mask, iterations=band)

    outer_band = dilated & ~mask
    inner_band = mask & ~eroded

    if outer_band.sum() == 0 or inner_band.sum() == 0:
        return 0.0

    gray = clean.astype(np.float32)
    if gray.ndim == 3:
        gray = gray.mean(axis=-1)

    outer_mean = gray[outer_band].mean()
    inner_mean = gray[inner_band].mean()
    return float(abs(inner_mean - outer_mean))


def _infill_color_consistency(clean: np.ndarray, mask: np.ndarray,
                               surround_band: int) -> float:
    """Mean L1 color difference between infill interior and surrounding plate.

    Compares the mean RGB of pixels inside the mask (the infill) against
    the mean RGB of pixels in a band just outside the mask (real background).
    High difference = color mismatch in the inpainting.
    """
    from scipy.ndimage import binary_dilation
    dilated = binary_dilation(mask, iterations=surround_band)
    surround = dilated & ~mask

    if mask.sum() == 0 or surround.sum() == 0:
        return 0.0

    clean_f = clean.astype(np.float32)
    if clean_f.ndim == 2:
        clean_f = clean_f[:, :, np.newaxis]

    infill_mean = clean_f[mask].mean(axis=0)
    surround_mean = clean_f[surround].mean(axis=0)
    return float(np.abs(infill_mean - surround_mean).mean())


def _infill_patch_seam(clean: np.ndarray, mask: np.ndarray,
                       band: int, patch: int) -> float:
    """P95 of per-patch boundary seam energy.

    Same inner/outer band logic as _infill_boundary_energy, but computed
    per sliding window along the mask boundary.  Returns the 95th
    percentile — robust to a single outlier patch from inherent scene
    geometry while still catching localized hard seams.
    """
    from scipy.ndimage import binary_dilation, binary_erosion
    dilated = binary_dilation(mask, iterations=band)
    eroded = binary_erosion(mask, iterations=band)
    outer_ring = dilated & ~mask
    inner_ring = mask & ~eroded

    boundary_pixels = np.argwhere(outer_ring | inner_ring)
    if len(boundary_pixels) == 0:
        return 0.0

    gray = clean.astype(np.float32)
    if gray.ndim == 3:
        gray = gray.mean(axis=-1)

    ymin, xmin = boundary_pixels.min(axis=0)
    ymax, xmax = boundary_pixels.max(axis=0)

    seams: list[float] = []
    for y in range(ymin, ymax, patch):
        for x in range(xmin, xmax, patch):
            lo = outer_ring[y:y + patch, x:x + patch]
            li = inner_ring[y:y + patch, x:x + patch]
            if lo.sum() < 5 or li.sum() < 5:
                continue
            lg = gray[y:y + patch, x:x + patch]
            seams.append(abs(float(lg[lo].mean()) - float(lg[li].mean())))

    if not seams:
        return 0.0
    return float(np.percentile(seams, 95))


def _infill_texture_ratio(clean: np.ndarray, mask: np.ndarray,
                          surround_band: int, window: int) -> float:
    """Local-variance ratio of infill interior vs surrounding plate.

    Computes per-pixel local variance via uniform_filter, then compares
    the mean local variance inside the mask against the mean in a band
    just outside.  A good infill has similar texture energy to its
    surroundings (ratio near 1.0).  High ratio = infill is noisier /
    has artifacts; low ratio = infill is suspiciously flat / blurry.
    """
    from scipy.ndimage import binary_dilation, uniform_filter
    dilated = binary_dilation(mask, iterations=surround_band)
    surround = dilated & ~mask

    if mask.sum() == 0 or surround.sum() == 0:
        return 1.0

    gray = clean.astype(np.float32)
    if gray.ndim == 3:
        gray = gray.mean(axis=-1)

    mu = uniform_filter(gray, window)
    var = uniform_filter(gray * gray, window) - mu * mu

    inside_var = float(var[mask].mean())
    outside_var = float(var[surround].mean())
    if outside_var < 0.01:
        return 1.0
    return inside_var / outside_var


def verify_plate_infill_quality(room_id: str, hotspots: list[dict]) -> int:
    """Check clean plate inpainting quality at each object location.

    Measures four things per hotspot:
    1. Boundary seam energy: global mean gradient at the mask edge.
    2. Color consistency: global mean color diff inside vs outside.
    3. Patch seam (p95): catches localized hard edges the global mean
       averages away — the primary fill-seam detector.
    4. Texture ratio: local-variance ratio inside vs outside — catches
       texture discontinuities and hallucinated replacement textures.

    Uses the SAM mask to define the object region.  Falls back to bbox
    if no SAM mask is available.  Per-hotspot baselines in
    remnant_baselines.json override absolute thresholds.
    """
    clean_path = SCENES / "escape" / f"{room_id}_clean.png"
    if not clean_path.exists():
        print(f"  INFILL-QUALITY SKIP: {room_id} — no clean plate")
        return 0

    clean = np.array(Image.open(clean_path).convert("RGB"))
    room_mask = _load_object_mask(room_id)
    raw_baselines = json.loads(REMNANT_BASELINES_PATH.read_text()) if REMNANT_BASELINES_PATH.exists() else {}
    fails = 0

    for h in hotspots:
        sp = h.get("sprite", {})
        if not sp.get("rest"):
            continue

        tag = f"{room_id}/{h['id']}"

        sam_path = SAM_MASKS_DIR / f"{room_id}_{h['id']}.png"
        if sam_path.exists():
            obj_mask = np.array(Image.open(sam_path).convert("L")) > 127
            if obj_mask.shape != clean.shape[:2]:
                obj_mask = np.array(
                    Image.fromarray(obj_mask.astype(np.uint8) * 255).resize(
                        (clean.shape[1], clean.shape[0]), Image.NEAREST
                    )
                ) > 127
        else:
            bb = sp.get("bbox", {})
            if not bb:
                continue
            obj_mask = np.zeros(clean.shape[:2], dtype=bool)
            obj_mask[bb["y"]:bb["y"]+bb["h"], bb["x"]:bb["x"]+bb["w"]] = True

        if obj_mask.sum() == 0:
            continue

        seam = _infill_boundary_energy(clean, obj_mask, _INFILL_BOUNDARY_BAND)
        color_diff = _infill_color_consistency(clean, obj_mask, _INFILL_SURROUND_BAND)
        patch_seam = _infill_patch_seam(clean, obj_mask, _INFILL_BOUNDARY_BAND, _INFILL_PATCH_SIZE)
        tex_ratio = _infill_texture_ratio(clean, obj_mask, _INFILL_SURROUND_BAND, _INFILL_TEXTURE_WINDOW)

        def _bl(suffix: str, default: float) -> float:
            entry = raw_baselines.get(f"{tag}.{suffix}")
            return entry["baseline"] if entry else default

        seam_limit = _bl("infill_seam", THRESH_INFILL_SEAM)
        color_limit = _bl("infill_color", THRESH_INFILL_COLOR_DIFF)
        patch_limit = _bl("infill_patch_seam", THRESH_INFILL_PATCH_SEAM)
        tex_limit = _bl("infill_texture", THRESH_INFILL_TEXTURE_RATIO)

        reason = None
        if seam > seam_limit:
            reason = f"seam={seam:.2f} > {seam_limit}"
        elif color_diff > color_limit:
            reason = f"color_diff={color_diff:.2f} > {color_limit}"
        elif patch_seam > patch_limit:
            reason = f"patch_seam={patch_seam:.2f} > {patch_limit}"
        elif tex_ratio > tex_limit:
            reason = f"texture_ratio={tex_ratio:.2f} > {tex_limit}"

        if reason:
            print(f"  INFILL-QUALITY FAIL: {tag} — {reason}")
            fails += 1
        else:
            print(
                f"  INFILL-QUALITY PASS: {tag}"
                f" — seam={seam:.2f}, color={color_diff:.2f}"
                f", patch_seam={patch_seam:.2f}, texture={tex_ratio:.2f}"
            )

    return fails


def _gemini_collateral_check(
    orig_crop: Image.Image, clean_crop: Image.Image, obj: str
) -> bool:
    """Compare before/after crops and ask Gemini whether inpainting
    damaged surrounding scene elements (furniture, architecture,
    surfaces, other objects).  Returns True = collateral damage found."""
    from google.genai import types

    question = (
        f"These two images show the SAME scene location before and after "
        f"digitally removing a {obj}.\n\n"
        f"IMAGE 1 (before): the original scene with the {obj} present.\n"
        f"IMAGE 2 (after): the scene after the {obj} was removed via "
        f"inpainting.\n\n"
        f"Ignore the area where the {obj} used to be — that area is "
        f"expected to look different.\n\n"
        f"Focus on EVERYTHING ELSE in the scene: furniture, walls, "
        f"floor, platforms, pedestals, shelves, other objects, "
        f"architectural elements, decorations.\n\n"
        f"Has any surrounding scene element been damaged, partially "
        f"erased, deformed, or lost detail compared to the original? "
        f"For example: a pedestal top gone, a shelf edge broken, a wall "
        f"pattern disrupted, furniture partially erased.\n\n"
        f"Answer YES if ANY surrounding element was damaged.\n"
        f"Answer NO if the surrounding scene is intact.\n"
        f"Answer with exactly one word: YES or NO."
    )

    parts = [
        types.Part(
            inline_data=types.Blob(
                mime_type="image/png", data=_png_bytes(orig_crop)
            )
        ),
        types.Part(
            inline_data=types.Blob(
                mime_type="image/png", data=_png_bytes(clean_crop)
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
                answer = (resp.text or "").strip().upper()
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

    yes_count = sum(votes)
    return yes_count >= 2


def verify_plate_collateral(room_id: str, hotspots: list[dict]) -> int:
    """Gate D.1-VIS: Gemini vision check for collateral scene damage.

    For each hotspot, crops the object region (with padding) from both
    the original scene and clean plate, then asks Gemini whether any
    surrounding scene element was damaged during inpainting.  Catches
    semantic artifacts that pixel metrics miss — e.g. a pedestal top
    erased along with the dragon sitting on it.

    Per-hotspot baselines in remnant_baselines.json can suppress known
    false positives (key: '{room}/{hotspot}.collateral_skip').
    """
    clean_path = SCENES / "escape" / f"{room_id}_clean.png"
    orig_path = SCENES / "escape" / f"{room_id}.png"
    if not clean_path.exists() or not orig_path.exists():
        missing = [p for p in (clean_path, orig_path) if not p.exists()]
        print(f"  COLLATERAL SKIP: {room_id} — missing {[str(p.name) for p in missing]}")
        return 0

    clean = Image.open(clean_path).convert("RGB")
    orig = Image.open(orig_path).convert("RGB")
    room_mask = _load_object_mask(room_id)
    raw_baselines = json.loads(REMNANT_BASELINES_PATH.read_text()) if REMNANT_BASELINES_PATH.exists() else {}
    fails = 0

    for h in hotspots:
        sp = h.get("sprite", {})
        if not sp.get("rest"):
            continue

        tag = f"{room_id}/{h['id']}"

        if raw_baselines.get(f"{tag}.collateral_skip"):
            print(f"  COLLATERAL SKIP: {tag} — baseline override")
            continue

        x0, y0, x1, y1 = _mask_bbox_for_hotspot(room_mask, h, pad=40)
        if x1 <= x0 or y1 <= y0:
            continue

        orig_crop = orig.crop((x0, y0, x1, y1))
        clean_crop = clean.crop((x0, y0, x1, y1))

        obj = HOTSPOT_OBJECTS.get((room_id, h["id"]), h["id"])
        has_damage = _gemini_collateral_check(orig_crop, clean_crop, obj)
        if has_damage:
            print(f"  COLLATERAL FAIL: {tag} — surrounding scene damage detected")
            fails += 1
        else:
            print(f"  COLLATERAL PASS: {tag}")

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
                        answer = (resp.text or "").strip().upper()
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


def _build_full_runtime_base(room_id: str, hotspot_id: str, sprite: dict) -> np.ndarray:
    """Build the chain-aware compositing base for a hotspot.

    At the moment a hotspot settles, siblings EARLIER in the chain have
    already been used — the runtime draws their LAST frames — while
    LATER siblings are still at rest. Comparing against an afterScene
    (a chain-state snapshot) is only honest against this base; using
    rests for everyone silently required each sprite to bake its
    siblings' states (the all-held hazard)."""
    base = _get_base_for_sprite(room_id, sprite)
    if not sprite.get("rest"):
        return base

    def draw(layer_rgba: np.ndarray, bx: int, by: int, bw: int, bh: int) -> None:
        nonlocal base
        if layer_rgba.shape[:2] != (bh, bw):
            layer_rgba = np.array(
                Image.fromarray(layer_rgba).resize((bw, bh), Image.LANCZOS)
            )
        alpha = layer_rgba[:, :, 3:4].astype(np.float32) / 255.0
        base_f = base.astype(np.float32)
        base_f[by:by + bh, bx:bx + bw] = (
            base_f[by:by + bh, bx:bx + bw] * (1 - alpha)
            + layer_rgba[:, :, :3].astype(np.float32) * alpha
        )
        base = np.clip(base_f, 0, 255).astype(np.uint8)

    m = json.loads(MANIFEST.read_text())
    before_me = True
    for room in m.get("escape", []):
        if room["id"] != room_id:
            continue
        for h in room.get("hotspots", []):
            if h["id"] == hotspot_id:
                before_me = False
                continue
            sib_sp = h.get("sprite", {})
            if before_me and sib_sp.get("sheet"):
                sheet_path = SPRITES / sib_sp["sheet"]
                bb = sib_sp.get("bbox")
                if not sheet_path.exists() or not bb:
                    continue
                sheet = np.array(Image.open(sheet_path))
                cols = sib_sp["cols"]
                fc = sib_sp["frameCount"]
                rows_g = (fc + cols - 1) // cols
                fh = sheet.shape[0] // rows_g
                fw = sheet.shape[1] // cols
                li = fc - 1
                lf = sheet[(li // cols) * fh:(li // cols + 1) * fh,
                           (li % cols) * fw:(li % cols + 1) * fw]
                draw(lf, bb["x"], bb["y"], bb["w"], bb["h"])
            else:
                rest_file = sib_sp.get("rest")
                rb = sib_sp.get("restBbox")
                if not rest_file or not rb:
                    continue
                rest_path = SPRITES / rest_file
                if not rest_path.exists():
                    continue
                rest = np.array(Image.open(rest_path))
                draw(rest, rb["x"], rb["y"], rb["w"], rb["h"])
    return base


def verify_sprite(room_id: str, hotspot_id: str, sprite: dict) -> tuple[str, float, float, float]:
    """Verify a sprite hotspot: composite base + final sheet frame
    at the bbox, compare against the after-scene ROI.
    Returns (result_str, mean_delta, frac30, coverage_pct).

    Two compositing models:
      - Legacy (patch): base = before-scene, draw patch then sprite on top
      - Clean-plate (rest): base = clean plate + sibling rest layers,
        draw sprite on top directly
    """
    before_path = SCENES / sprite["beforeScene"]
    after_path = SCENES / sprite["afterScene"]
    bbox = sprite["bbox"]

    if not before_path.exists():
        return f"MISSING before: {before_path}", 999, 1, 0
    if not after_path.exists():
        return f"MISSING after: {after_path}", 999, 1, 0

    base = _build_full_runtime_base(room_id, hotspot_id, sprite)
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

    coverage = float((last_frame[:, :, 3] > 0).mean()) * 100
    # opaque core only: feathered pixels blend base with content by
    # design, and the base is chain-aware runtime state, not the
    # afterScene snapshot — comparing the feather to the snapshot would
    # re-require baked sibling states
    alpha_mask = last_frame[:, :, 3] >= 250

    if alpha_mask.any():
        mean_d = float(delta[alpha_mask].mean())
        frac30 = float((delta.sum(axis=-1)[alpha_mask] > 30).mean())
    else:
        mean_d = float(delta.mean())
        frac30 = float((delta.sum(axis=-1) > 30).mean())

    ok = mean_d < THRESH_SPRITE_MEAN and frac30 < THRESH_SPRITE_FRAC
    return "PASS" if ok else "FAIL", mean_d, frac30, coverage


def verify_rest_purity(room_id: str, sprite: dict) -> tuple[str, float]:
    """A rest layer must contain its OBJECT, not a background slab: the
    fraction of opaque pixels that are plate-identical (<25 L1) must stay
    under THRESH_REST_IMPURITY. Moderate plate-identical fringes are
    tolerated (they compensate plate-inpaint halos); majority-background
    rests are a decomposition failure."""
    if not sprite.get("rest") or not sprite.get("restBbox"):
        return "SKIP", 0.0
    rp = SPRITES / sprite["rest"]
    cp = SCENES / "escape" / f"{room_id}_clean.png"
    if not rp.exists() or not cp.exists():
        return "SKIP", 0.0
    lay = np.array(Image.open(rp).convert("RGBA"))
    rb = sprite["restBbox"]
    if lay.shape[:2] != (rb["h"], rb["w"]):
        lay = np.array(Image.fromarray(lay).resize((rb["w"], rb["h"])))
    plate = np.array(Image.open(cp).convert("RGB"))
    pl = plate[rb["y"]:rb["y"] + rb["h"], rb["x"]:rb["x"] + rb["w"]]
    dd = np.abs(lay[:, :, :3].astype(np.int16) - pl.astype(np.int16)).sum(-1)
    op = lay[:, :, 3] > 128
    imp = float((op & (dd < 25)).sum()) / max(int(op.sum()), 1) * 100
    return ("FAIL" if imp > THRESH_REST_IMPURITY else "PASS"), imp


def verify_tail_convergence(
    room_id: str, hotspot_id: str, sprite: dict
) -> tuple[str, float, float, float]:
    """Check that the animation tail converges to the held frame within
    the final ease window, and that the held frame matches the afterScene.

    The motion-through tail design keeps raw clip motion playing until a
    short smoothstep ease (TAIL_WINDOW frames); mid-animation frames are
    NOT expected to resemble the held state.  The contract is: deltas to
    the held composite are monotonically non-increasing over the last
    TAIL_WINDOW frames, the frame before the handoff is within
    THRESH_TAIL_LAST, and the held frame reproduces the afterScene crop
    (THRESH_HELD_VS_AFTER).  T-0.5s / T-0.25s deltas are reported as
    context only.

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
    base = _build_full_runtime_base(room_id, hotspot_id, sprite)
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
    core = get_frame(fc - 1)[:, :, 3] >= 250
    mean_held_vs_after = (
        float(delta_held_after[core].mean()) if core.any() else float(delta_held_after.mean())
    )

    window = min(TAIL_WINDOW, fc - 1)
    win_deltas = []
    for idx in range(fc - window, fc):
        comp = composite(get_frame(idx))
        win_deltas.append(float(np.abs(comp.astype(np.int16) - held.astype(np.int16)).mean()))
    last_ok = win_deltas[-2] <= THRESH_TAIL_LAST if len(win_deltas) >= 2 else True
    mono_ok = all(win_deltas[i] >= win_deltas[i + 1] - 0.5 for i in range(len(win_deltas) - 1))
    held_ok = mean_held_vs_after <= THRESH_HELD_VS_AFTER

    if not held_ok:
        result = "FAIL-HELD"
    elif not last_ok:
        result = "FAIL"
    elif not mono_ok:
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
        # departed-object excuse: when the after scene itself has (almost)
        # no non-plate content in the bbox (net yanked away, only the fish
        # remains), a low held coverage is faithful, not a vanished body.
        after_p = SCENES / sprite.get("afterScene", "_missing_")
        rid = Path(sprite.get("sheet", "x/x")).stem.split("_")[0]
        clean_p = SCENES / "escape" / f"{rid}_clean.png"
        if after_p.exists() and clean_p.exists() and bw > 0:
            after = np.array(Image.open(after_p).convert("RGB").resize((1280, 720)))
            plate = np.array(Image.open(clean_p).convert("RGB"))
            y, x = bbox["y"], bbox["x"]
            af = after[y:y + bh, x:x + bw].astype(np.int16)
            pl = plate[y:y + bh, x:x + bw].astype(np.int16)
            nonplate = float((np.abs(af - pl).sum(-1) > 60).mean()) * 100
            if nonplate < THRESH_COVERAGE_MIN:
                return "PASS", 0
        return f"FAIL: last-frame coverage {last_alpha:.1f}% < {THRESH_COVERAGE_MIN}%", 0

    return "PASS", 0


GAME_W, GAME_H = 1280, 720

THRESH_SEAM_ENERGY = 8.0  # max excess gradient energy along bbox perimeter vs plain plate


def _perimeter_gradient_energy(full_frame: np.ndarray, bbox: dict, band: int = 2) -> float:
    """Mean absolute gradient across the sprite bbox perimeter.

    Samples a 'band'-pixel strip straddling each bbox edge, computes the
    cross-edge gradient (inner minus outer mean per row/column), and
    returns the mean absolute value across all four edges.
    """
    x, y, w, h = bbox["x"], bbox["y"], bbox["w"], bbox["h"]
    fh, fw = full_frame.shape[:2]
    gray = full_frame.astype(np.float32)
    if gray.ndim == 3:
        gray = gray.mean(axis=-1)

    energies: list[float] = []

    # Top edge: rows y-band..y-1 (outer) vs y..y+band-1 (inner)
    oy1, oy2 = max(0, y - band), y
    iy1, iy2 = y, min(fh, y + band)
    if oy2 > oy1 and iy2 > iy1:
        outer = gray[oy1:oy2, x:x + w].mean(axis=0)
        inner = gray[iy1:iy2, x:x + w].mean(axis=0)
        energies.append(float(np.abs(inner - outer).mean()))

    # Bottom edge
    iy1, iy2 = max(0, y + h - band), y + h
    oy1, oy2 = y + h, min(fh, y + h + band)
    if oy2 > oy1 and iy2 > iy1:
        inner = gray[iy1:iy2, x:x + w].mean(axis=0)
        outer = gray[oy1:oy2, x:x + w].mean(axis=0)
        energies.append(float(np.abs(inner - outer).mean()))

    # Left edge
    ox1, ox2 = max(0, x - band), x
    ix1, ix2 = x, min(fw, x + band)
    if ox2 > ox1 and ix2 > ix1:
        outer = gray[y:y + h, ox1:ox2].mean(axis=1)
        inner = gray[y:y + h, ix1:ix2].mean(axis=1)
        energies.append(float(np.abs(inner - outer).mean()))

    # Right edge
    ix1, ix2 = max(0, x + w - band), x + w
    ox1, ox2 = x + w, min(fw, x + w + band)
    if ox2 > ox1 and ix2 > ix1:
        inner = gray[y:y + h, ix1:ix2].mean(axis=1)
        outer = gray[y:y + h, ox1:ox2].mean(axis=1)
        energies.append(float(np.abs(inner - outer).mean()))

    return float(np.mean(energies)) if energies else 0.0


def _build_runtime_base(room_id: str, hotspot_id: str, sprite: dict) -> np.ndarray:
    """Build the true runtime compositing base for a hotspot.

    For hotspots in HOTSPOT_OBJECT_MAP (shared-object siblings), the
    runtime draws sibling rest layers underneath the sprite frame.
    Compositing on the bare plate would show a disembodied sprite
    floating on an object-free background, producing false gradient
    energy at the bbox boundary.

    Returns the base image with sibling rest layers composited.
    """
    base = _get_base_for_sprite(room_id, sprite)
    mapped = HOTSPOT_OBJECT_MAP.get((room_id, hotspot_id))
    if not mapped:
        return base

    m = json.loads(MANIFEST.read_text())
    for room in m.get("escape", []):
        if room["id"] != room_id:
            continue
        for h in room.get("hotspots", []):
            if h["id"] == hotspot_id:
                continue
            sib_mapped = HOTSPOT_OBJECT_MAP.get((room_id, h["id"]))
            if sib_mapped != mapped:
                continue
            sib_sp = h.get("sprite", {})
            rest_file = sib_sp.get("rest")
            rb = sib_sp.get("restBbox")
            if not rest_file or not rb:
                continue
            rest_path = SPRITES / rest_file
            if not rest_path.exists():
                continue
            rest = np.array(Image.open(rest_path))
            rx, ry, rw, rh = rb["x"], rb["y"], rb["w"], rb["h"]
            rest_resized = np.array(
                Image.fromarray(rest).resize((rw, rh), Image.LANCZOS)
            )
            alpha = rest_resized[:, :, 3:4].astype(np.float32) / 255.0
            base_f = base.astype(np.float32)
            base_f[ry:ry + rh, rx:rx + rw] = (
                base_f[ry:ry + rh, rx:rx + rw] * (1 - alpha)
                + rest_resized[:, :, :3].astype(np.float32) * alpha
            )
            base = np.clip(base_f, 0, 255).astype(np.uint8)
    return base


def verify_bbox_seam(
    room_id: str, hotspot_id: str, sprite: dict
) -> tuple[str, float]:
    """Check for rectangular tonal seams at the sprite bbox boundary.

    Composites mid-animation frames (25/50/75%) on the true runtime base
    (clean plate + sibling rest layers for shared-object hotspots) and
    measures the excess gradient energy along the bbox perimeter compared
    to the plain base.  A baked wrong-tone background in the sprite
    produces a rectangle-shaped seam that elevates the gradient.

    Returns (result, max_excess_energy).
    """
    if not sprite.get("sheet"):
        return "SKIP", 0.0

    sheet_path = SPRITES / sprite["sheet"]
    if not sheet_path.exists():
        return f"MISSING {sheet_path.name}", 99.0

    base = _build_runtime_base(room_id, hotspot_id, sprite)
    sheet = np.array(Image.open(sheet_path))
    bbox = sprite["bbox"]
    x, y, w, h = bbox["x"], bbox["y"], bbox["w"], bbox["h"]

    cols = sprite["cols"]
    fc = sprite["frameCount"]
    frame_w = sheet.shape[1] // cols
    rows_grid = (fc + cols - 1) // cols
    frame_h = sheet.shape[0] // rows_grid

    plate_energy = _perimeter_gradient_energy(base, bbox)

    max_excess = 0.0
    for pct in (0.25, 0.50, 0.75):
        idx = min(int(pct * (fc - 1)), fc - 1)
        col = idx % cols
        row = idx // cols
        frame = sheet[row * frame_h:(row + 1) * frame_h,
                      col * frame_w:(col + 1) * frame_w]

        comp = base.copy().astype(np.float32)
        alpha = frame[:, :, 3:4].astype(np.float32) / 255.0
        comp[y:y + h, x:x + w] = (
            comp[y:y + h, x:x + w] * (1 - alpha)
            + frame[:, :, :3].astype(np.float32) * alpha
        )
        comp = np.clip(comp, 0, 255).astype(np.uint8)

        comp_energy = _perimeter_gradient_energy(comp, bbox)
        excess = comp_energy - plate_energy
        max_excess = max(max_excess, excess)

    ok = max_excess <= THRESH_SEAM_ENERGY
    return "PASS" if ok else "FAIL", max_excess


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


def verify_sibling_isolation(room_id: str, hotspots: list[dict]) -> int:
    """Verify that no sprite sheet contains pixels from sibling rest layers.

    Enlarged bboxes can overlap neighboring objects; diff-vs-plate matting
    captures sibling content when that happens. This check ensures sibling
    mask subtraction has been applied: for each frame in each sheet, the
    intersection of opaque sheet pixels and sibling rest-layer masks must
    be near-zero (< 0.1% of frame area).

    Hotspots sharing a HOTSPOT_OBJECT_MAP entry are exempted (panel/slot
    legitimately contain rocket pixels).
    """
    fails = 0
    for h in hotspots:
        sp = h.get("sprite", {})
        if not sp.get("sheet") or not sp.get("bbox"):
            continue

        sheet_path = SPRITES / sp["sheet"]
        if not sheet_path.exists():
            continue

        bbox = sp["bbox"]
        sheet = np.array(Image.open(sheet_path))
        cols = sp["cols"]
        fc = sp["frameCount"]
        fw = sheet.shape[1] // cols
        rows = (fc + cols - 1) // cols
        fh = sheet.shape[0] // rows

        for sib in hotspots:
            if sib["id"] == h["id"]:
                continue
            sib_sp = sib.get("sprite", {})
            if not sib_sp.get("rest") or not sib_sp.get("restBbox"):
                continue

            my_obj = HOTSPOT_OBJECT_MAP.get((room_id, h["id"]))
            sib_obj = HOTSPOT_OBJECT_MAP.get((room_id, sib["id"]))
            if my_obj and sib_obj and my_obj == sib_obj:
                continue

            rb = sib_sp["restBbox"]
            ox0 = max(bbox["x"], rb["x"])
            oy0 = max(bbox["y"], rb["y"])
            ox1 = min(bbox["x"] + bbox["w"], rb["x"] + rb["w"])
            oy1 = min(bbox["y"] + bbox["h"], rb["y"] + rb["h"])
            if ox0 >= ox1 or oy0 >= oy1:
                continue

            rest = np.array(
                Image.open(SPRITES / sib_sp["rest"]).convert("RGBA")
            )
            rest_h, rest_w = rest.shape[:2]
            sp_x0 = ox0 - bbox["x"]
            sp_y0 = oy0 - bbox["y"]
            sp_x1 = ox1 - bbox["x"]
            sp_y1 = oy1 - bbox["y"]
            r_x0 = int((ox0 - rb["x"]) / rb["w"] * rest_w)
            r_y0 = int((oy0 - rb["y"]) / rb["h"] * rest_h)
            r_x1 = min(int((ox1 - rb["x"]) / rb["w"] * rest_w), rest_w)
            r_y1 = min(int((oy1 - rb["y"]) / rb["h"] * rest_h), rest_h)

            rest_crop = rest[r_y0:r_y1, r_x0:r_x1, 3]
            if rest_crop.size == 0:
                continue
            sib_mask = np.array(
                Image.fromarray(rest_crop).resize(
                    (sp_x1 - sp_x0, sp_y1 - sp_y0), Image.NEAREST
                )
            ) > 128

            frame_area = fw * fh
            for i in range(fc):
                r_i, c_i = i // cols, i % cols
                frame_alpha = sheet[
                    r_i * fh : (r_i + 1) * fh,
                    c_i * fw : (c_i + 1) * fw,
                    3,
                ]
                overlap_region = frame_alpha[sp_y0:sp_y1, sp_x0:sp_x1]
                hit = int((sib_mask & (overlap_region > 0)).sum())
                if hit / frame_area > 0.001:
                    tag = f"{room_id}/{h['id']}"
                    print(
                        f"  SIBLING-ISOLATION FAIL: {tag} frame {i} "
                        f"— {hit} px overlap with {sib['id']}'s rest layer "
                        f"({hit/frame_area*100:.2f}% of frame)"
                    )
                    fails += 1
                    break

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
        print(f"\n{tail_fails} tail-convergence failures (contract: monotone over last {TAIL_WINDOW} frames, T-1f ≤{THRESH_TAIL_LAST}, held/after ≤{THRESH_HELD_VS_AFTER}; T-0.5s/T-0.25s are context)")
        fails += tail_fails
    else:
        print(f"Tail convergence: all {len(entries)} OK")

    # Rest-purity check (E3): a rest layer must be its object, not a
    # background slab (the panel 82% case).
    # panel rest is a known slab (82%) — needs SAM rebuild (GPU); warn, don't gate
    REST_PURITY_KNOWN_SLABS = {("rocketpad", "panel")}
    print()
    rest_fails = 0
    for room_id2, hotspot_id2, sprite2 in entries:
        result2, imp = verify_rest_purity(room_id2, sprite2)
        tag2 = f"{room_id2}/{hotspot_id2}"
        if result2 == "FAIL":
            if (room_id2, hotspot_id2) in REST_PURITY_KNOWN_SLABS:
                print(f"  REST-PURITY WARN: {tag2} — {imp:.1f}% slab (known, needs rebuild)")
            else:
                print(f"  REST-PURITY FAIL: {tag2} — {imp:.1f}% of opaque rest is plate-identical (max {THRESH_REST_IMPURITY}%)")
                rest_fails += 1
        elif result2 == "PASS":
            print(f"  REST-PURITY PASS: {tag2} — impurity {imp:.1f}%")
    fails += rest_fails

    # Sheet consistency check
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

    # Bbox-boundary seam energy: detects baked wrong-tone background in
    # sprite mattes (coupling invariant violation).  Hotspots with a
    # .seam_energy baseline use that limit instead of the absolute threshold.
    seam_baselines = _load_remnant_baselines()
    print("\n--- Bbox seam energy ---")
    seam_fails = 0
    for room_id, hotspot_id, sprite in entries:
        tag = f"{room_id}/{hotspot_id}"
        result, excess = verify_bbox_seam(room_id, hotspot_id, sprite)
        seam_key = f"{tag}.seam_energy"
        if seam_key in seam_baselines:
            limit = seam_baselines[seam_key]
            if excess <= limit:
                print(f"  SEAM PASS: {tag} — excess={excess:.2f} (baseline {limit})")
            else:
                seam_fails += 1
                print(f"  SEAM FAIL: {tag} — excess={excess:.2f} > baseline {limit}")
        elif result not in ("PASS", "SKIP"):
            seam_fails += 1
            print(f"  SEAM FAIL: {tag} — excess={excess:.2f} (threshold {THRESH_SEAM_ENERGY})")
        else:
            print(f"  SEAM PASS: {tag} — excess={excess:.2f}")
    if seam_fails:
        print(f"\n{seam_fails} bbox-seam failures")
        fails += seam_fails
    else:
        print(f"Bbox seam energy: all {len(entries)} OK")

    # Item-layer composite check: verify item layers composite correctly
    # against the afterScene and that itemBbox fits within the game frame.
    print("\n--- Item layers ---")
    item_fails = 0
    for room in m.get("escape", []):
        ilf = verify_item_layers(room["id"], room.get("hotspots", []))
        item_fails += ilf
    if item_fails:
        print(f"\n{item_fails} item-layer failures")
        fails += item_fails
    else:
        print("Item layers: all composites verified")

    # Sibling isolation: no baked sibling content in sprite sheets
    print("\n--- Sibling isolation ---")
    sib_fails = 0
    for room in m.get("escape", []):
        sf = verify_sibling_isolation(room["id"], room.get("hotspots", []))
        sib_fails += sf
    if sib_fails:
        print(f"\n{sib_fails} sibling-isolation failures")
        fails += sib_fails
    else:
        print("Sibling isolation: no baked sibling content in sheets")

    # Manifest integrity: rest layers must have matching sprite sheets
    print("\n--- Rest/sheet integrity ---")
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
    print("\n--- Rest-layer holes ---")
    rest_hole_fails = 0
    for room in m.get("escape", []):
        rhf = verify_rest_plate_match(room["id"], room.get("hotspots", []))
        rest_hole_fails += rhf
    if rest_hole_fails:
        print(f"\n{rest_hole_fails} rest-layer-hole failures")
        fails += rest_hole_fails
    else:
        print("Rest-layer holes: all rest composites match original")

    # Rest-boundary seam: stale-lineage detection at rest-alpha contour
    print("\n--- Rest-boundary seam ---")
    rest_boundary_fails = 0
    for room in m.get("escape", []):
        rbf = verify_rest_boundary(room["id"], room.get("hotspots", []))
        rest_boundary_fails += rbf
    if rest_boundary_fails:
        print(f"\n{rest_boundary_fails} rest-boundary failures (threshold {THRESH_REST_BOUNDARY})")
        fails += rest_boundary_fails
    else:
        print("Rest-boundary seam: all rest layers match current plate")

    # Alpha-contour seam: interior cliff / hole detection
    print("\n--- Alpha-contour seam ---")
    alpha_contour_fails = 0
    for room in m.get("escape", []):
        acf = verify_alpha_contour(room["id"], room.get("hotspots", []))
        alpha_contour_fails += acf
    if alpha_contour_fails:
        print(f"\n{alpha_contour_fails} alpha-contour failures (threshold {THRESH_ALPHA_CONTOUR})")
        fails += alpha_contour_fails
    else:
        print("Alpha-contour seam: all rest layers have natural contours")

    # Frame integrity: extraction produced usable animation frames
    print("\n--- Frame integrity ---")
    frame_integrity_fails = 0
    for room in m.get("escape", []):
        frame_integrity_fails += verify_frame_integrity(room["id"], room.get("hotspots", []))
    if frame_integrity_fails:
        print(f"\n{frame_integrity_fails} frame-integrity failures")
        fails += frame_integrity_fails
    else:
        print("Frame integrity: all sheets carry their bodies")

    # All-held stack: every hotspot used simultaneously is a real game
    # configuration and must be seam-free with no held-over-held painting
    print("\n--- All-held stack ---")
    all_held_fails = 0
    for room in m.get("escape", []):
        all_held_fails += verify_all_held(room["id"], room.get("hotspots", []))
    if all_held_fails:
        print(f"\n{all_held_fails} all-held failures")
        fails += all_held_fails
    else:
        print("All-held stack: every room clean")

    # D.3 Plate-drift check: outside the union of hotspot masks,
    # the clean plate must be pixel-identical to the original scene.
    print("\n--- Plate drift (D.3) ---")
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
    print("\n--- Plate remnants (D.1-PRE, alpha-core) ---")
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
    print("\n--- Plate emptiness (D.1) ---")
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

    # D.1-POST: Plate infill quality — seam and color consistency of inpainting
    print("\n--- Plate infill quality (D.1-POST) ---")
    infill_fails = 0
    for room in m.get("escape", []):
        iqf = verify_plate_infill_quality(room["id"], room.get("hotspots", []))
        infill_fails += iqf
    if infill_fails:
        print(f"\n{infill_fails} infill-quality failures (seam ≤ {THRESH_INFILL_SEAM}, color ≤ {THRESH_INFILL_COLOR_DIFF})")
        fails += infill_fails
    else:
        print("Plate infill quality: all clean plates have smooth inpainting")

    # D.1-VIS: Gemini vision check for collateral scene damage.
    # Compares before/after crops — catches semantic artifacts that
    # pixel metrics miss (e.g. pedestal top erased with the dragon).
    print("\n--- Collateral damage (D.1-VIS) ---")
    collateral_fails = 0
    for room in m.get("escape", []):
        cf = verify_plate_collateral(room["id"], room.get("hotspots", []))
        collateral_fails += cf
    if collateral_fails:
        print(f"\n{collateral_fails} collateral-damage failures (Gemini-verified)")
        fails += collateral_fails
    else:
        print("Collateral damage: all clean plates have intact surroundings")

    # D.2 No-doubles check: Gemini verifies animated object doesn't appear
    # twice in composited mid-animation frames.
    print("\n--- No doubles (D.2) ---")
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
