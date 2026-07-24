"""GEPA-adapted inpainting quality optimization framework.

Applies GEPA methodology (evolutionary prompt search + metric-gated selection)
to Imagen 3 EDIT_MODE_INPAINT_REMOVAL for the escape-sprite pipeline.

Components (the "candidate dict"):
  - removal_prompt: Imagen prompt text for background fill
  - negative_prompt: what to avoid generating
  - mask_dilation: paint region dilation (px) beyond the SAM mask
  - composite_dilation: accept-back region dilation (px) beyond the SAM mask

Objects (13 total, split by inpainting difficulty):
  - Train (7): toolbox, net, crate, panel, pillow, piratecove_chest, pen
  - Eval (3): slot, haystack, toyroom_chest
  - Holdout (3): stove, pelican, dragon

Metrics (4-axis scorer, weighted harmonic mean):
  - patch_seam (p95): localized boundary seam energy — weight 0.35
  - texture_ratio: local-variance ratio inside/outside mask — weight 0.25
  - color_diff: global mean L1 color difference — weight 0.20
  - seam: global boundary energy — weight 0.20
"""
from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path("/home/ivanmkc/kidsgame")
SCENES = ROOT / "assets" / "game" / "escape"
SAM_DIR = SCENES / "sam_masks"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"

# --- Data splits (by inpainting difficulty) ---

TRAIN_SET = [
    "rocketpad/toolbox",
    "piratecove/net",
    "rocketpad/crate",
    "rocketpad/panel",
    "toyroom/pillow",
    "piratecove/chest",
    "toyroom/pen",
]

EVAL_SET = [
    "rocketpad/slot",
    "dragoncave/haystack",
    "toyroom/chest",
]

HOLDOUT_SET = [
    "dragoncave/stove",
    "piratecove/pelican",
    "dragoncave/dragon",
]

# --- Metric weights ---

METRIC_WEIGHTS = {
    "patch_seam": 0.35,
    "texture_ratio": 0.25,
    "color_diff": 0.20,
    "seam": 0.20,
}

# Absolute thresholds (gate conditions)
THRESH_SEAM = 12.0
THRESH_COLOR_DIFF = 20.0
THRESH_PATCH_SEAM = 35.0
THRESH_TEXTURE_RATIO = 1.5

# Metric function parameters
_BOUNDARY_BAND = 4
_SURROUND_BAND = 16
_PATCH_SIZE = 32
_TEXTURE_WINDOW = 7


@dataclass
class InpaintCandidate:
    """A candidate configuration for the inpainting pipeline."""
    name: str
    removal_prompt: str = "empty background, seamless continuation of the surrounding scenery"
    negative_prompt: str = "a new object, a new animal, a new character, text, watermark"
    mask_dilation: int = 12
    composite_dilation: int = 4

    def describe(self) -> str:
        return (
            f"Candidate: {self.name}\n"
            f"  Prompt: {self.removal_prompt}\n"
            f"  Negative: {self.negative_prompt}\n"
            f"  Mask dilation: {self.mask_dilation}px\n"
            f"  Composite dilation: {self.composite_dilation}px"
        )


@dataclass
class InpaintResult:
    """Result of running a candidate on one object."""
    object_key: str
    candidate_name: str
    seam: float = 0.0
    color_diff: float = 0.0
    patch_seam: float = 0.0
    texture_ratio: float = 1.0
    gate_pass: bool = False
    notes: str = ""

    @property
    def score(self) -> float:
        """Weighted harmonic mean of normalized metrics."""
        vals = {
            "seam": max(0, 1.0 - self.seam / THRESH_SEAM),
            "color_diff": max(0, 1.0 - self.color_diff / THRESH_COLOR_DIFF),
            "patch_seam": max(0, 1.0 - self.patch_seam / THRESH_PATCH_SEAM),
            # Asymmetric: penalize only ratio > 1.0 (noisy infill = artifact);
            # ratio <= 1.0 (smoother than surroundings) is fine.
            "texture_ratio": max(0, 1.0 - max(0, self.texture_ratio - 1.0) / 0.5),
        }
        w_sum = sum(METRIC_WEIGHTS.values())
        h_den = sum(
            METRIC_WEIGHTS[k] / max(vals[k], 1e-6) for k in METRIC_WEIGHTS
        )
        return w_sum / h_den if h_den > 0 else 0.0


# --- Metric functions ---
# (Standalone versions — not importing from verify_escape_chain to avoid
#  circular deps and to keep the experiment self-contained.)

def _measure_seam(clean: np.ndarray, mask: np.ndarray) -> float:
    """Global boundary energy: |inner_band_mean - outer_band_mean|."""
    from scipy.ndimage import binary_dilation, binary_erosion
    dilated = binary_dilation(mask, iterations=_BOUNDARY_BAND)
    eroded = binary_erosion(mask, iterations=_BOUNDARY_BAND)
    outer = dilated & ~mask
    inner = mask & ~eroded
    if outer.sum() == 0 or inner.sum() == 0:
        return 0.0
    gray = clean.astype(np.float32).mean(axis=-1)
    return float(abs(gray[inner].mean() - gray[outer].mean()))


def _measure_color_diff(clean: np.ndarray, mask: np.ndarray) -> float:
    """Global mean L1 color difference inside vs outside mask."""
    from scipy.ndimage import binary_dilation
    dilated = binary_dilation(mask, iterations=_SURROUND_BAND)
    surround = dilated & ~mask
    if mask.sum() == 0 or surround.sum() == 0:
        return 0.0
    f = clean.astype(np.float32)
    return float(np.abs(f[mask].mean(axis=0) - f[surround].mean(axis=0)).mean())


def _measure_patch_seam(clean: np.ndarray, mask: np.ndarray) -> float:
    """P95 of per-patch boundary seam energy (32px windows)."""
    from scipy.ndimage import binary_dilation, binary_erosion
    dilated = binary_dilation(mask, iterations=_BOUNDARY_BAND)
    eroded = binary_erosion(mask, iterations=_BOUNDARY_BAND)
    outer = dilated & ~mask
    inner = mask & ~eroded
    boundary = np.argwhere(outer | inner)
    if len(boundary) == 0:
        return 0.0
    gray = clean.astype(np.float32).mean(axis=-1)
    ymin, xmin = boundary.min(axis=0)
    ymax, xmax = boundary.max(axis=0)
    seams: list[float] = []
    for y in range(ymin, ymax, _PATCH_SIZE):
        for x in range(xmin, xmax, _PATCH_SIZE):
            lo = outer[y:y + _PATCH_SIZE, x:x + _PATCH_SIZE]
            li = inner[y:y + _PATCH_SIZE, x:x + _PATCH_SIZE]
            if lo.sum() < 5 or li.sum() < 5:
                continue
            lg = gray[y:y + _PATCH_SIZE, x:x + _PATCH_SIZE]
            seams.append(abs(float(lg[lo].mean()) - float(lg[li].mean())))
    return float(np.percentile(seams, 95)) if seams else 0.0


def _measure_texture_ratio(clean: np.ndarray, mask: np.ndarray) -> float:
    """Local-variance ratio inside/outside mask."""
    from scipy.ndimage import binary_dilation, uniform_filter
    dilated = binary_dilation(mask, iterations=_SURROUND_BAND)
    surround = dilated & ~mask
    if mask.sum() == 0 or surround.sum() == 0:
        return 1.0
    gray = clean.astype(np.float32).mean(axis=-1)
    mu = uniform_filter(gray, _TEXTURE_WINDOW)
    var = uniform_filter(gray * gray, _TEXTURE_WINDOW) - mu * mu
    outside_var = float(var[surround].mean())
    if outside_var < 0.01:
        return 1.0
    return float(var[mask].mean()) / outside_var


def measure_all(clean: np.ndarray, mask: np.ndarray) -> dict[str, float]:
    """Compute all 4 infill metrics."""
    return {
        "seam": _measure_seam(clean, mask),
        "color_diff": _measure_color_diff(clean, mask),
        "patch_seam": _measure_patch_seam(clean, mask),
        "texture_ratio": _measure_texture_ratio(clean, mask),
    }


def gate_check(metrics: dict[str, float]) -> bool:
    """Check if all metrics pass absolute thresholds."""
    return (
        metrics["seam"] <= THRESH_SEAM
        and metrics["color_diff"] <= THRESH_COLOR_DIFF
        and metrics["patch_seam"] <= THRESH_PATCH_SEAM
        and metrics["texture_ratio"] <= THRESH_TEXTURE_RATIO
    )


# --- Evaluation ---

def _load_sam_mask(room_id: str, hotspot_id: str) -> np.ndarray | None:
    """Load SAM mask for a hotspot. Returns bool array or None."""
    p = SAM_DIR / f"{room_id}_{hotspot_id}.png"
    if not p.exists():
        return None
    return np.array(Image.open(p).convert("L")) > 127


def _inpaint_with_candidate(
    scene: Image.Image,
    paint_mask: np.ndarray,
    composite_mask: np.ndarray,
    candidate: InpaintCandidate,
) -> Image.Image:
    """Run Imagen inpainting with the candidate's prompts and return the
    composited result.  Uses the candidate's removal_prompt and
    negative_prompt instead of the hardcoded ones in nbp."""
    import io
    import time

    sys.path.insert(0, str(ROOT / "tools"))
    from gen.nbp import (
        _imagen_client, _object_composite, IMAGEN_MODEL, aspect_fit, _tls,
    )
    from google.genai import types

    def png(im: Image.Image) -> bytes:
        buf = io.BytesIO()
        im.save(buf, "PNG")
        return buf.getvalue()

    mask_arr = (paint_mask * 255).astype(np.uint8)
    comp_arr = (composite_mask * 255).astype(np.uint8)

    last: Exception | None = None
    for i in range(3):
        try:
            resp = _imagen_client().models.edit_image(
                model=IMAGEN_MODEL,
                prompt=candidate.removal_prompt,
                reference_images=[
                    types.RawReferenceImage(
                        reference_image=types.Image(image_bytes=png(scene)),
                        reference_id=0,
                    ),
                    types.MaskReferenceImage(
                        reference_image=types.Image(
                            image_bytes=png(
                                Image.fromarray(mask_arr, "L").convert("RGB")
                            )
                        ),
                        reference_id=1,
                        config=types.MaskReferenceConfig(
                            mask_mode="MASK_MODE_USER_PROVIDED",
                            mask_dilation=0.01,
                        ),
                    ),
                ],
                config=types.EditImageConfig(
                    edit_mode="EDIT_MODE_INPAINT_REMOVAL",
                    number_of_images=1,
                    negative_prompt=candidate.negative_prompt,
                ),
            )
            gens = [
                g for g in (resp.generated_images or [])
                if g.image and g.image.image_bytes
            ]
            if not gens:
                raise RuntimeError("imagen returned no images")
            out = Image.open(io.BytesIO(gens[0].image.image_bytes)).convert("RGB")
            if out.size != scene.size:
                out = aspect_fit(out, scene.size)

            b = np.asarray(scene, np.int16)
            o = np.asarray(out, np.int16)
            comp = _object_composite(b, o, comp_arr > 127)
            return comp
        except Exception as e:
            last = e
            _tls.imagen_client = None
            print(
                f"  WARN imagen attempt {i + 1}: {type(e).__name__} "
                f"{str(e)[:120]}",
                file=sys.stderr,
            )
            time.sleep(5 * (i + 1))
    raise RuntimeError(f"imagen failed after 3 attempts: {last}")


def evaluate_single(
    candidate: InpaintCandidate,
    object_key: str,
) -> InpaintResult:
    """Evaluate a candidate on one object.

    Starts from the original scene image (with object present), applies
    Imagen inpainting with the candidate's prompts/parameters, and
    measures the 4 infill metrics on the result.
    """
    from scipy.ndimage import binary_dilation

    room_id, hotspot_id = object_key.split("/")
    scene_path = SCENES / f"{room_id}.png"
    if not scene_path.exists():
        return InpaintResult(object_key, candidate.name, notes="missing scene")

    sam_mask = _load_sam_mask(room_id, hotspot_id)
    if sam_mask is None:
        return InpaintResult(object_key, candidate.name, notes="missing SAM mask")

    scene = Image.open(scene_path).convert("RGB")

    paint_mask = binary_dilation(sam_mask, iterations=candidate.mask_dilation)
    composite_mask = binary_dilation(sam_mask, iterations=candidate.composite_dilation)

    try:
        result_img = _inpaint_with_candidate(
            scene, paint_mask, composite_mask, candidate,
        )
    except Exception as e:
        return InpaintResult(
            object_key, candidate.name,
            notes=f"imagen error: {type(e).__name__}: {str(e)[:100]}",
        )

    result_arr = np.array(result_img)
    metrics = measure_all(result_arr, sam_mask)
    passed = gate_check(metrics)

    return InpaintResult(
        object_key=object_key,
        candidate_name=candidate.name,
        seam=metrics["seam"],
        color_diff=metrics["color_diff"],
        patch_seam=metrics["patch_seam"],
        texture_ratio=metrics["texture_ratio"],
        gate_pass=passed,
    )


def evaluate_set(
    candidate: InpaintCandidate,
    object_keys: list[str],
    k: int = 3,
) -> list[InpaintResult]:
    """Evaluate a candidate on a set of objects with K-sample median.

    Runs K inpainting attempts per object and keeps the result with
    the median score — robust against Imagen stochasticity.
    """
    results: list[InpaintResult] = []
    for key in object_keys:
        print(f"  Evaluating {key} (K={k})...", flush=True)

        attempts: list[InpaintResult] = []
        for i in range(k):
            r = evaluate_single(candidate, key)
            attempts.append(r)
            print(
                f"    k={i+1}: seam={r.seam:.2f}, color={r.color_diff:.2f}, "
                f"patch={r.patch_seam:.2f}, tex={r.texture_ratio:.2f}, "
                f"score={r.score:.3f}",
                flush=True,
            )

        attempts.sort(key=lambda r: r.score)
        median = attempts[len(attempts) // 2]
        results.append(median)
        print(
            f"  → {key}: median score={median.score:.3f} "
            f"({'PASS' if median.gate_pass else 'FAIL'})",
            flush=True,
        )

    return results


def aggregate_score(results: list[InpaintResult]) -> float:
    """Mean of per-object harmonic scores."""
    if not results:
        return 0.0
    return float(np.mean([r.score for r in results]))


# --- Candidate definitions ---

# _object_composite erodes the accept-back region by EDGE_ERODE_PX (6px),
# so composite_dilation must exceed that to avoid leaving original scene
# pixels (with the object) at the mask edge.  Production uses 14px.
_MIN_COMPOSITE_DILATION = 8  # 6px erosion + 2px margin

BASELINE = InpaintCandidate(
    name="baseline",
    removal_prompt="empty background, seamless continuation of the surrounding scenery",
    negative_prompt="a new object, a new animal, a new character, text, watermark",
    mask_dilation=16,
    composite_dilation=10,
)

CANDIDATES: list[InpaintCandidate] = [
    BASELINE,
    InpaintCandidate(
        name="texture_match",
        removal_prompt=(
            "Fill with the natural background texture that continues from "
            "the surrounding area. Match the exact color palette, grain, "
            "lighting direction, and surface material of the adjacent pixels. "
            "No seams, no color shifts, no new objects."
        ),
        negative_prompt=(
            "a new object, animal, character, shadow, text, watermark, "
            "sharp edges, color discontinuity, flat fill, blurry patch"
        ),
        mask_dilation=20,
        composite_dilation=12,
    ),
    InpaintCandidate(
        name="scene_continuation",
        removal_prompt=(
            "Continue the background scenery seamlessly into this region. "
            "The fill must be indistinguishable from the surrounding "
            "environment at game resolution. Preserve the art style, "
            "lighting, and perspective."
        ),
        negative_prompt=(
            "object, animal, character, shadow, artifact, text, watermark, "
            "visible seam, color mismatch, hallucinated detail"
        ),
        mask_dilation=18,
        composite_dilation=10,
    ),
    InpaintCandidate(
        name="wide_blend",
        removal_prompt=(
            "empty background, seamless continuation of the surrounding scenery"
        ),
        negative_prompt="a new object, a new animal, a new character, text, watermark",
        mask_dilation=28,
        composite_dilation=14,
    ),
]

# Hill-climb mutations (run separately, not in initial sweep)
MUTATIONS: list[InpaintCandidate] = [
    InpaintCandidate(
        name="mid_blend",
        mask_dilation=22,
        composite_dilation=12,
    ),
    InpaintCandidate(
        name="art_blend",
        removal_prompt=(
            "empty background, seamless continuation of the surrounding "
            "scenery, matching art style"
        ),
        negative_prompt=(
            "a new object, a new animal, a new character, text, watermark, "
            "visible seam"
        ),
        mask_dilation=24,
        composite_dilation=12,
    ),
]


# --- Report ---

def print_report(results: list[InpaintResult], label: str = "") -> None:
    """Print a formatted results table."""
    if label:
        print(f"\n=== {label} ===")
    print(
        f"{'Object':25s} {'seam':>6s} {'color':>6s} {'p_seam':>7s} "
        f"{'tex_r':>6s} {'score':>6s} {'gate':>5s}"
    )
    print("-" * 65)
    for r in results:
        print(
            f"{r.object_key:25s} {r.seam:6.2f} {r.color_diff:6.2f} "
            f"{r.patch_seam:7.2f} {r.texture_ratio:6.2f} {r.score:6.3f} "
            f"{'PASS' if r.gate_pass else 'FAIL':>5s}"
        )
    agg = aggregate_score(results)
    print(f"{'AGGREGATE':25s} {'':6s} {'':6s} {'':7s} {'':6s} {agg:6.3f}")


# --- Main entry point ---

def run_experiment(
    candidates: list[InpaintCandidate] | None = None,
    sets: list[str] | None = None,
    k: int = 3,
) -> dict[str, list[InpaintResult]]:
    """Run GEPA inpainting experiment.

    Args:
        candidates: list of candidates to evaluate (default: CANDIDATES)
        sets: which sets to run ("train", "eval", "holdout")
        k: K-sample size per object

    Returns:
        dict of candidate_name -> results
    """
    if candidates is None:
        candidates = CANDIDATES
    if sets is None:
        sets = ["train"]

    set_map = {"train": TRAIN_SET, "eval": EVAL_SET, "holdout": HOLDOUT_SET}
    object_keys: list[str] = []
    for s in sets:
        object_keys.extend(set_map.get(s, []))

    all_results: dict[str, list[InpaintResult]] = {}
    for cand in candidates:
        print(f"\n{'='*60}")
        print(cand.describe())
        print(f"{'='*60}")
        results = evaluate_set(cand, object_keys, k=k)
        all_results[cand.name] = results
        print_report(results, f"{cand.name} results")

    # Summary comparison
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"{'Candidate':25s} {'train_score':>12s} {'gate_pass':>10s}")
    print("-" * 50)
    for cand in candidates:
        res = all_results.get(cand.name, [])
        agg = aggregate_score(res)
        passes = sum(1 for r in res if r.gate_pass)
        total = len(res)
        print(f"{cand.name:25s} {agg:12.3f} {passes:>5d}/{total}")

    return all_results


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="GEPA inpainting experiment")
    parser.add_argument("--sets", nargs="+", default=["train"],
                        choices=["train", "eval", "holdout"])
    parser.add_argument("--k", type=int, default=3, help="K-sample size")
    parser.add_argument("--candidates", nargs="+", default=None,
                        help="Candidate names to run (default: all)")
    args = parser.parse_args()

    cands = CANDIDATES
    if args.candidates:
        cands = [c for c in CANDIDATES if c.name in args.candidates]

    run_experiment(cands, args.sets, args.k)
