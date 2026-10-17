"""Deterministic rest-layer generator — GEPA-informed.

A rest layer is an RGBA cutout of a hotspot object from the original scene,
composited at runtime over the clean plate to reconstruct the pre-interaction
appearance.  Alpha comes from the SAM instance mask (feathered), NOT diff-keying
— diff-keying misses static object bodies and thin mesh structures (GEPA finding
from pen/crate/net fixes).

Pipeline per hotspot:
  1. Load original scene + clean plate + SAM mask (all at 1280×720).
  2. Compute restBbox from SAM mask + padding (or use manifest override).
  3. Crop original scene to restBbox → RGB.
  4. Crop SAM mask to restBbox → raw alpha.
  5. Feather alpha edges (Gaussian, 2px σ) for anti-aliased compositing.
  6. Plate-purity cleanup: zero alpha where L1(original, clean) < threshold,
     so background-slab pixels don't bloat the rest layer.
  7. Quality gate: SAM coverage, plate purity, composition fidelity.

Usage:
    python3 tools/gen/rest_layers.py [--room ROOM] [--all] [--dry-run]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent.parent
ASSETS = ROOT / "assets" / "game" / "escape"
SPRITES = ROOT / "public" / "escape-sprites"
SAM_DIR = ASSETS / "sam_masks"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"

SCENE_W, SCENE_H = 1280, 720
FEATHER_SIGMA = 2.0
PLATE_PURITY_THRESH = 25
REST_BBOX_PAD = 8

SAM_OVERRIDE = {
    "rocketpad_panel": "rocketpad_slot",
    "rocketpad_slot": "rocketpad_slot",
}


def _load_scene(path: Path) -> np.ndarray:
    return np.array(
        Image.open(path).convert("RGB").resize((SCENE_W, SCENE_H), Image.LANCZOS)
    )


def _load_mask(name: str) -> np.ndarray:
    sam_name = SAM_OVERRIDE.get(name, name)
    p = SAM_DIR / f"{sam_name}.png"
    if not p.exists():
        raise FileNotFoundError(f"SAM mask not found: {p}")
    mask = np.array(Image.open(p).convert("L"))
    if mask.shape != (SCENE_H, SCENE_W):
        mask = np.array(
            Image.fromarray(mask).resize((SCENE_W, SCENE_H), Image.NEAREST)
        )
    return mask > 0


def _bbox_from_mask(mask: np.ndarray, pad: int = REST_BBOX_PAD) -> dict:
    ys, xs = np.nonzero(mask)
    if len(ys) == 0:
        raise ValueError("Empty mask — cannot compute bbox")
    x0 = max(int(xs.min()) - pad, 0)
    y0 = max(int(ys.min()) - pad, 0)
    x1 = min(int(xs.max()) + 1 + pad, SCENE_W)
    y1 = min(int(ys.max()) + 1 + pad, SCENE_H)
    return {"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0}


def generate_rest_layer(
    room_id: str,
    hotspot_id: str,
    scene_img: np.ndarray | None = None,
    clean_img: np.ndarray | None = None,
    rest_bbox: dict | None = None,
    feather_sigma: float = FEATHER_SIGMA,
    plate_thresh: int = PLATE_PURITY_THRESH,
) -> tuple[np.ndarray, dict]:
    """Generate a rest layer for a single hotspot.

    Returns (rgba_array, metrics_dict).
    """
    name = f"{room_id}_{hotspot_id}"

    if scene_img is None:
        scene_path = ASSETS / f"{room_id}.png"
        if not scene_path.exists():
            for ext in ("_scene.png", ".jpg"):
                alt = ASSETS / f"{room_id}{ext}"
                if alt.exists():
                    scene_path = alt
                    break
        scene_img = _load_scene(scene_path)

    if clean_img is None:
        clean_img = _load_scene(ASSETS / f"{room_id}_clean.png")

    sam_mask = _load_mask(name)

    if rest_bbox is None:
        rest_bbox = _bbox_from_mask(sam_mask)

    x, y, w, h = rest_bbox["x"], rest_bbox["y"], rest_bbox["w"], rest_bbox["h"]

    scene_crop = scene_img[y : y + h, x : x + w].copy()
    clean_crop = clean_img[y : y + h, x : x + w].copy()
    mask_crop = sam_mask[y : y + h, x : x + w].astype(np.float32)

    alpha = ndimage.gaussian_filter(mask_crop, sigma=feather_sigma)
    alpha = np.clip(alpha * 255, 0, 255).astype(np.uint8)

    # plate-purity cleanup: zero alpha where scene ≈ clean plate.
    # These pixels are visually neutral (composite is identical with or
    # without them) and removing them avoids remnant-metric false positives
    # on mesh objects (net) where SAM covers background-visible holes.
    diff_l1 = np.abs(scene_crop.astype(np.int16) - clean_crop.astype(np.int16)).sum(
        axis=-1
    )
    plate_identical = diff_l1 < plate_thresh
    alpha[plate_identical] = 0

    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, :3] = scene_crop
    rgba[:, :, 3] = alpha

    # metrics
    sam_pixels_in_bbox = mask_crop.astype(bool).sum()
    opaque_pixels = (alpha > 128).sum()
    plate_pure = (plate_identical & mask_crop.astype(bool)).sum()
    plate_purity_pct = (
        100 * plate_pure / max(sam_pixels_in_bbox, 1)
    )

    # composition fidelity: clean + rest vs original at restBbox
    comp = clean_crop.copy().astype(np.float32)
    a_f = alpha.astype(np.float32) / 255.0
    for c in range(3):
        comp[:, :, c] = (
            comp[:, :, c] * (1 - a_f) + scene_crop[:, :, c].astype(np.float32) * a_f
        )
    fidelity_l1 = np.abs(comp - scene_crop.astype(np.float32)).mean()

    metrics = {
        "name": name,
        "sam_in_bbox": int(sam_pixels_in_bbox),
        "opaque_pixels": int(opaque_pixels),
        "plate_purity_pct": round(plate_purity_pct, 1),
        "fidelity_l1": round(float(fidelity_l1), 2),
        "rest_bbox": rest_bbox,
    }

    return rgba, metrics


def generate_all(
    room_filter: str | None = None,
    dry_run: bool = False,
) -> list[dict]:
    manifest = json.loads(MANIFEST.read_text())
    rooms = manifest.get("escape", [])
    results = []

    for room in rooms:
        room_id = room["id"]
        if room_filter and room_id != room_filter:
            continue

        scene_img = _load_scene(ASSETS / f"{room_id}.png")
        clean_img = _load_scene(ASSETS / f"{room_id}_clean.png")

        for h in room.get("hotspots", []):
            hid = h["id"]
            sp = h.get("sprite", {})
            if sp.get("rest") is None:
                continue

            rb = sp.get("restBbox")
            name = f"{room_id}_{hid}"
            sam_p = SAM_DIR / f"{SAM_OVERRIDE.get(name, name)}.png"
            if not sam_p.exists():
                print(f"  SKIP {name}: no SAM mask")
                continue

            rgba, metrics = generate_rest_layer(
                room_id, hid,
                scene_img=scene_img,
                clean_img=clean_img,
                rest_bbox=rb,
            )

            status = "OK" if metrics["plate_purity_pct"] < 15 else "WARN"
            print(
                f"  {status} {name}: "
                f"sam={metrics['sam_in_bbox']}, "
                f"opaque={metrics['opaque_pixels']}, "
                f"plate_purity={metrics['plate_purity_pct']}%, "
                f"fidelity_L1={metrics['fidelity_l1']}"
            )

            if not dry_run:
                out = SPRITES / f"{name}_rest.png"
                Image.fromarray(rgba, "RGBA").save(out)
                print(f"    -> {out.relative_to(ROOT)}")

            results.append(metrics)

    return results


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate rest layers from SAM masks")
    parser.add_argument("--room", help="Only process this room")
    parser.add_argument("--all", action="store_true", help="Process all rooms")
    parser.add_argument(
        "--dry-run", action="store_true", help="Measure without writing"
    )
    args = parser.parse_args()

    if not (args.all or args.room):
        parser.print_help()
        sys.exit(1)

    print("Rest layer generation (SAM-mask alpha + plate-purity cleanup)")
    print(f"  feather_sigma={FEATHER_SIGMA}, plate_thresh={PLATE_PURITY_THRESH}")
    print()

    results = generate_all(room_filter=args.room, dry_run=args.dry_run)

    print(f"\n{'='*60}")
    print(f"Processed {len(results)} rest layers")
    ok = sum(1 for r in results if r["plate_purity_pct"] < 15)
    print(f"  {ok}/{len(results)} pass plate-purity gate (<15%)")
    avg_fidelity = np.mean([r["fidelity_l1"] for r in results]) if results else 0
    print(f"  avg composition fidelity L1: {avg_fidelity:.2f}")
