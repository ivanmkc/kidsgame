"""Patch-local inpainting experiment: diff-game techniques for escape plates.

Two fixes from the diff game pipeline:
1. Patch-local cropping — send only SAM bbox + context to Imagen, not the full
   scene. The model can't damage what it can't see.
2. Collateral vision judge — after compositing, Gemini compares before/after
   crops. Reject and retry if surrounding elements were damaged.

Compares:
  A) full-frame (current production approach)
  B) patch-local only
  C) collateral judge only (full-frame + reject/retry)
  D) patch-local + collateral judge (both fixes)

Runs on the 8 objects that fail the collateral gate.
"""
from __future__ import annotations

import io
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path("/home/ivanmkc/kidsgame")
SCENES = ROOT / "assets" / "game" / "escape"
SAM_DIR = SCENES / "sam_masks"

sys.path.insert(0, str(ROOT / "tools"))

from experiments.gepa_inpainting import (
    InpaintCandidate, InpaintResult,
    measure_all, gate_check,
    _load_sam_mask,
    THRESH_SEAM, THRESH_COLOR_DIFF, THRESH_PATCH_SEAM, THRESH_TEXTURE_RATIO,
)

# wide_blend parameters (GEPA winner)
WIDE_BLEND = InpaintCandidate(
    name="wide_blend",
    mask_dilation=28,
    composite_dilation=14,
)

# Objects that fail the collateral gate
COLLATERAL_FAIL_OBJECTS = [
    "dragoncave/dragon",
    "dragoncave/stove",
    "dragoncave/haystack",
    "piratecove/pelican",
    "piratecove/chest",
    "toyroom/pen",
    "rocketpad/toolbox",
    "rocketpad/crate",
]

HOTSPOT_OBJECTS = {
    ("toyroom", "pillow"): "blue striped pillow or cushion",
    ("toyroom", "chest"): "red wooden toy chest with a lock",
    ("toyroom", "pen"): "wooden playpen fence or golden puppy",
    ("dragoncave", "haystack"): "haystack or hay pile",
    ("dragoncave", "stove"): "stone cooking stove or furnace",
    ("dragoncave", "dragon"): "small dragon",
    ("piratecove", "net"): "fishing net with rope",
    ("piratecove", "pelican"): "pelican bird",
    ("piratecove", "chest"): "treasure chest",
    ("rocketpad", "toolbox"): "red toolbox",
    ("rocketpad", "crate"): "shipping crate with cross braces and green dome",
    ("rocketpad", "panel"): "control panel with buttons and lights",
    ("rocketpad", "slot"): "battery slot or vertical panel opening",
}


def _png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def _sam_bbox(mask: np.ndarray, pad: int = 80) -> tuple[int, int, int, int]:
    """Get bounding box of SAM mask with padding. Returns (x0, y0, x1, y1)."""
    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    if not rows.any():
        return (0, 0, mask.shape[1], mask.shape[0])
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]
    h, w = mask.shape
    return (
        max(0, cmin - pad),
        max(0, rmin - pad),
        min(w, cmax + pad + 1),
        min(h, rmax + pad + 1),
    )


def _collateral_check(
    orig_crop: Image.Image, clean_crop: Image.Image, obj: str
) -> bool:
    """Ask Gemini whether inpainting damaged surrounding scene elements.
    Returns True = damage found (FAIL)."""
    from google import genai
    from google.genai import types

    client = genai.Client(
        vertexai=True, project="adk-coding-agents", location="global"
    )
    models = ["gemini-3.5-flash", "gemini-3.1-flash", "gemini-3-flash-preview"]

    question = (
        f"These two images show the SAME scene location before and after "
        f"digitally removing a {obj}.\n\n"
        f"IMAGE 1 (before): the original scene with the {obj} present.\n"
        f"IMAGE 2 (after): the scene after the {obj} was removed via "
        f"inpainting.\n\n"
        f"Ignore the area where the {obj} used to be — that area is "
        f"expected to look different.\n\n"
        f"Focus on EVERYTHING ELSE: furniture, walls, floor, platforms, "
        f"pedestals, shelves, other objects, architectural elements.\n\n"
        f"Has any surrounding scene element been damaged, partially "
        f"erased, deformed, or lost detail compared to the original?\n\n"
        f"Answer YES if ANY surrounding element was damaged.\n"
        f"Answer NO if the surrounding scene is intact.\n"
        f"Answer with exactly one word: YES or NO."
    )

    parts = [
        types.Part(inline_data=types.Blob(
            mime_type="image/png", data=_png_bytes(orig_crop))),
        types.Part(inline_data=types.Blob(
            mime_type="image/png", data=_png_bytes(clean_crop))),
        types.Part(text=question),
    ]

    votes = []
    for _ in range(3):
        for model in models:
            try:
                resp = client.models.generate_content(model=model, contents=parts)
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

    return sum(votes) >= 2


def _inpaint_full_frame(
    scene: Image.Image,
    sam_mask: np.ndarray,
    candidate: InpaintCandidate,
) -> Image.Image:
    """Full-frame inpainting (current production approach)."""
    from scipy.ndimage import binary_dilation
    from gen.nbp import (
        _imagen_client, _object_composite, IMAGEN_MODEL, aspect_fit, _tls,
    )
    from google.genai import types

    paint_mask = binary_dilation(sam_mask, iterations=candidate.mask_dilation)
    composite_mask = binary_dilation(sam_mask, iterations=candidate.composite_dilation)
    mask_arr = (paint_mask * 255).astype(np.uint8)
    comp_arr = (composite_mask * 255).astype(np.uint8)

    last = None
    for i in range(3):
        try:
            resp = _imagen_client().models.edit_image(
                model=IMAGEN_MODEL,
                prompt=candidate.removal_prompt,
                reference_images=[
                    types.RawReferenceImage(
                        reference_image=types.Image(
                            image_bytes=_png_bytes(scene)), reference_id=0),
                    types.MaskReferenceImage(
                        reference_image=types.Image(
                            image_bytes=_png_bytes(
                                Image.fromarray(mask_arr, "L").convert("RGB"))),
                        reference_id=1,
                        config=types.MaskReferenceConfig(
                            mask_mode="MASK_MODE_USER_PROVIDED",
                            mask_dilation=0.01)),
                ],
                config=types.EditImageConfig(
                    edit_mode="EDIT_MODE_INPAINT_REMOVAL",
                    number_of_images=1,
                    negative_prompt=candidate.negative_prompt),
            )
            gens = [g for g in (resp.generated_images or [])
                    if g.image and g.image.image_bytes]
            if not gens:
                raise RuntimeError("no images returned")
            out = Image.open(io.BytesIO(gens[0].image.image_bytes)).convert("RGB")
            if out.size != scene.size:
                out = aspect_fit(out, scene.size)
            b = np.asarray(scene, np.int16)
            o = np.asarray(out, np.int16)
            return _object_composite(b, o, comp_arr > 127)
        except Exception as e:
            last = e
            _tls.imagen_client = None
            print(f"  WARN full-frame attempt {i+1}: {e}", file=sys.stderr)
            time.sleep(5 * (i + 1))
    raise RuntimeError(f"full-frame failed: {last}")


def _inpaint_patch_local(
    scene: Image.Image,
    sam_mask: np.ndarray,
    candidate: InpaintCandidate,
    ctx: int = 80,
) -> Image.Image:
    """Patch-local inpainting: crop to SAM bbox + context, inpaint the
    crop, composite back. The model can't damage what it can't see."""
    from scipy.ndimage import binary_dilation
    from gen.nbp import (
        _imagen_client, _object_composite, IMAGEN_MODEL, aspect_fit, _tls,
    )
    from google.genai import types

    # Crop region = SAM bbox + context + mask dilation headroom
    headroom = candidate.mask_dilation + 10
    x0, y0, x1, y1 = _sam_bbox(sam_mask, pad=ctx + headroom)
    crop = scene.crop((x0, y0, x1, y1))
    mask_crop = sam_mask[y0:y1, x0:x1]

    paint_crop = binary_dilation(mask_crop, iterations=candidate.mask_dilation)
    composite_crop = binary_dilation(mask_crop, iterations=candidate.composite_dilation)

    mask_arr = (paint_crop * 255).astype(np.uint8)
    comp_arr = (composite_crop * 255).astype(np.uint8)

    last = None
    for i in range(3):
        try:
            resp = _imagen_client().models.edit_image(
                model=IMAGEN_MODEL,
                prompt=candidate.removal_prompt,
                reference_images=[
                    types.RawReferenceImage(
                        reference_image=types.Image(
                            image_bytes=_png_bytes(crop)), reference_id=0),
                    types.MaskReferenceImage(
                        reference_image=types.Image(
                            image_bytes=_png_bytes(
                                Image.fromarray(mask_arr, "L").convert("RGB"))),
                        reference_id=1,
                        config=types.MaskReferenceConfig(
                            mask_mode="MASK_MODE_USER_PROVIDED",
                            mask_dilation=0.01)),
                ],
                config=types.EditImageConfig(
                    edit_mode="EDIT_MODE_INPAINT_REMOVAL",
                    number_of_images=1,
                    negative_prompt=candidate.negative_prompt),
            )
            gens = [g for g in (resp.generated_images or [])
                    if g.image and g.image.image_bytes]
            if not gens:
                raise RuntimeError("no images returned")
            out = Image.open(io.BytesIO(gens[0].image.image_bytes)).convert("RGB")
            if out.size != crop.size:
                out = aspect_fit(out, crop.size)

            b = np.asarray(crop, np.int16)
            o = np.asarray(out, np.int16)
            comp_crop = _object_composite(b, o, comp_arr > 127)

            # Paste composited crop back onto full scene
            result = scene.copy()
            result.paste(comp_crop, (x0, y0))
            return result
        except Exception as e:
            last = e
            _tls.imagen_client = None
            print(f"  WARN patch-local attempt {i+1}: {e}", file=sys.stderr)
            time.sleep(5 * (i + 1))
    raise RuntimeError(f"patch-local failed: {last}")


@dataclass
class ExperimentResult:
    object_key: str
    approach: str
    seam: float = 0.0
    color_diff: float = 0.0
    patch_seam: float = 0.0
    texture_ratio: float = 1.0
    pixel_pass: bool = False
    collateral_pass: bool = False
    attempts: int = 1
    notes: str = ""

    @property
    def score(self) -> float:
        from experiments.gepa_inpainting import InpaintResult
        r = InpaintResult(
            self.object_key, self.approach,
            self.seam, self.color_diff, self.patch_seam, self.texture_ratio,
        )
        return r.score

    @property
    def both_pass(self) -> bool:
        return self.pixel_pass and self.collateral_pass


def run_single(
    object_key: str,
    approach: str,
    candidate: InpaintCandidate,
    max_collateral_retries: int = 3,
) -> ExperimentResult:
    """Run one approach on one object.

    Approaches:
      "full_frame": current production (no fixes)
      "patch_local": crop to SAM bbox + ctx (fix 1)
      "full_judge": full frame + collateral reject/retry (fix 2)
      "patch_judge": patch-local + collateral reject/retry (both fixes)
    """
    room_id, hotspot_id = object_key.split("/")
    scene_path = SCENES / f"{room_id}.png"
    sam_mask = _load_sam_mask(room_id, hotspot_id)
    if sam_mask is None or not scene_path.exists():
        return ExperimentResult(object_key, approach, notes="missing data")

    scene = Image.open(scene_path).convert("RGB")
    obj_desc = HOTSPOT_OBJECTS.get((room_id, hotspot_id), hotspot_id)

    use_local = approach in ("patch_local", "patch_judge")
    use_judge = approach in ("full_judge", "patch_judge")

    inpaint_fn = _inpaint_patch_local if use_local else _inpaint_full_frame

    best_result = None
    best_score = -1.0

    retries = max_collateral_retries if use_judge else 1
    for attempt in range(retries):
        try:
            result_img = inpaint_fn(scene, sam_mask, candidate)
        except Exception as e:
            return ExperimentResult(
                object_key, approach, attempts=attempt + 1,
                notes=f"inpaint error: {e}")

        result_arr = np.array(result_img)
        metrics = measure_all(result_arr, sam_mask)
        pixel_pass = gate_check(metrics)

        # Collateral check
        x0, y0, x1, y1 = _sam_bbox(sam_mask, pad=40)
        orig_crop = scene.crop((x0, y0, x1, y1))
        clean_crop = result_img.crop((x0, y0, x1, y1))

        if use_judge:
            collateral_ok = not _collateral_check(orig_crop, clean_crop, obj_desc)
        else:
            collateral_ok = not _collateral_check(orig_crop, clean_crop, obj_desc)

        r = ExperimentResult(
            object_key=object_key,
            approach=approach,
            seam=metrics["seam"],
            color_diff=metrics["color_diff"],
            patch_seam=metrics["patch_seam"],
            texture_ratio=metrics["texture_ratio"],
            pixel_pass=pixel_pass,
            collateral_pass=collateral_ok,
            attempts=attempt + 1,
        )

        if r.score > best_score:
            best_score = r.score
            best_result = r

        if use_judge and collateral_ok:
            print(f"    attempt {attempt+1}: collateral PASS (accepted)", flush=True)
            break
        elif use_judge:
            print(f"    attempt {attempt+1}: collateral FAIL (retrying...)", flush=True)
        else:
            break

    return best_result


def run_experiment():
    """Run the full A/B/C/D experiment on all collateral-failing objects."""
    approaches = ["full_frame", "patch_local", "full_judge", "patch_judge"]
    candidate = WIDE_BLEND

    print(f"{'='*70}")
    print(f"PATCH-LOCAL INPAINTING EXPERIMENT")
    print(f"Candidate: {candidate.name} (mask={candidate.mask_dilation}, "
          f"composite={candidate.composite_dilation})")
    print(f"Objects: {len(COLLATERAL_FAIL_OBJECTS)} collateral-failing")
    print(f"Approaches: {', '.join(approaches)}")
    print(f"{'='*70}\n")

    all_results: dict[str, list[ExperimentResult]] = {a: [] for a in approaches}

    for obj_key in COLLATERAL_FAIL_OBJECTS:
        print(f"\n{'='*60}")
        print(f"Object: {obj_key}")
        print(f"{'='*60}")

        for approach in approaches:
            print(f"\n  --- {approach} ---")
            result = run_single(obj_key, approach, candidate)
            all_results[approach].append(result)

            status = "BOTH PASS" if result.both_pass else (
                f"pixel={'PASS' if result.pixel_pass else 'FAIL'} "
                f"collateral={'PASS' if result.collateral_pass else 'FAIL'}"
            )
            print(
                f"  Result: seam={result.seam:.2f} color={result.color_diff:.2f} "
                f"patch={result.patch_seam:.2f} tex={result.texture_ratio:.2f} "
                f"score={result.score:.3f} [{status}] "
                f"(attempts={result.attempts})",
                flush=True,
            )

    # Summary
    print(f"\n\n{'='*70}")
    print(f"SUMMARY")
    print(f"{'='*70}\n")

    header = f"{'Approach':<15} {'Pixel':>6} {'Collat':>7} {'Both':>6} {'Score':>7} {'Attempts':>9}"
    print(header)
    print("-" * len(header))

    for approach in approaches:
        results = all_results[approach]
        pixel_pass = sum(1 for r in results if r.pixel_pass)
        collat_pass = sum(1 for r in results if r.collateral_pass)
        both_pass = sum(1 for r in results if r.both_pass)
        avg_score = np.mean([r.score for r in results])
        avg_attempts = np.mean([r.attempts for r in results])
        total = len(results)
        print(
            f"{approach:<15} {pixel_pass:>3}/{total:<2} {collat_pass:>4}/{total:<2} "
            f"{both_pass:>3}/{total:<2} {avg_score:>7.3f} {avg_attempts:>9.1f}"
        )

    print(f"\n\nPer-object detail:")
    print(f"{'Object':<25} ", end="")
    for a in approaches:
        print(f"{'|':>1} {a:<15}", end="")
    print()
    print("-" * (26 + 17 * len(approaches)))

    for i, obj_key in enumerate(COLLATERAL_FAIL_OBJECTS):
        print(f"{obj_key:<25} ", end="")
        for approach in approaches:
            r = all_results[approach][i]
            mark = "PP" if r.both_pass else (
                "P." if r.pixel_pass and not r.collateral_pass else
                ".P" if not r.pixel_pass and r.collateral_pass else
                ".."
            )
            print(f"| {mark} {r.score:.3f} a={r.attempts:<2}", end="")
        print()


if __name__ == "__main__":
    run_experiment()
