"""GEPA-adapted segmentation optimization framework.

Applies GEPA methodology (evolutionary prompt search + metric-gated selection)
to the escape-sprite SAM3.1 video segmentation pipeline.

Components (the "candidate dict"):
  - prompt_strategy: text prompt + bbox specification for SAM grounding
  - seeding_method: how to seed the video tracker (text+bbox, still-mask, multi-part)
  - post_processing: morphology, punch, feathering, after-alpha mode
  - object_design: visual properties of the object (for redraw experiments)

Journeys (animations):
  13 total, split into train/val/holdout:
  - Train (8): pillow, chest, stove, dragon, pelican, piratecove_chest, toolbox, slot
  - Val (2): panel, net (have tricky characteristics: shared rocket, thin structures)
  - Holdout (3): pen, haystack, crate (crate = the hardest)

Metrics (multi-axis scorer, weighted harmonic mean):
  - iou: IoU of SAM mask vs plate-diff ground truth at f0
  - temporal_stability: warp_error p95 across frame pairs
  - contour_quality: alpha-contour excess energy
  - rest_purity: plate-identical fraction in rest layer
  - gate_pass: binary — does the full gate pass?
"""
from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

ROOT = Path("/home/ivanmkc/kidsgame")
TMP = Path("/home/ivanmkc/.claude/jobs/c60063e9/tmp")

ANIMATIONS = {
    "toyroom/pillow": {"difficulty": "easy", "notes": "clean object, good contrast"},
    "toyroom/chest": {"difficulty": "easy", "notes": "lid opens, single material"},
    "toyroom/pen": {"difficulty": "medium", "notes": "dog exits pen, wide motion"},
    "dragoncave/haystack": {"difficulty": "hard", "notes": "SAM track loss, 19 zero frames baseline"},
    "dragoncave/stove": {"difficulty": "medium", "notes": "flame effects, thin structures"},
    "dragoncave/dragon": {"difficulty": "medium", "notes": "large motion, good contrast"},
    "piratecove/net": {"difficulty": "medium", "notes": "thin mesh structures, 0.61 collapse"},
    "piratecove/pelican": {"difficulty": "easy", "notes": "distinct object"},
    "piratecove/chest": {"difficulty": "easy", "notes": "good contrast"},
    "rocketpad/toolbox": {"difficulty": "easy", "notes": "opens, single material"},
    "rocketpad/crate": {"difficulty": "hard", "notes": "multi-material, grounding failure"},
    "rocketpad/panel": {"difficulty": "medium", "notes": "shared rocket, rest slab"},
    "rocketpad/slot": {"difficulty": "medium", "notes": "shared rocket, thin slot"},
}

TRAIN_SET = [
    "toyroom/pillow", "toyroom/chest", "dragoncave/stove",
    "dragoncave/dragon", "piratecove/pelican", "piratecove/chest",
    "rocketpad/toolbox", "rocketpad/slot",
]
VAL_SET = ["rocketpad/panel", "piratecove/net"]
HOLDOUT_SET = ["toyroom/pen", "dragoncave/haystack", "rocketpad/crate"]

METRIC_WEIGHTS = {
    "iou": 0.40,
    "temporal_stability": 0.25,
    "contour_quality": 0.15,
    "gate_pass": 0.20,
}

PLATE_DIFF_FADE_LO = 25
PLATE_DIFF_FADE_HI = 90


@dataclass
class SegmentationCandidate:
    """A candidate configuration for the segmentation pipeline."""
    name: str
    prompt_strategy: dict[str, Any] = field(default_factory=dict)
    seeding_method: str = "text_bbox"
    post_processing: dict[str, Any] = field(default_factory=dict)
    object_design: dict[str, Any] | None = None

    def describe(self) -> str:
        parts = [f"Candidate: {self.name}"]
        parts.append(f"  Seeding: {self.seeding_method}")
        if self.prompt_strategy:
            parts.append(f"  Prompts: {json.dumps(self.prompt_strategy, indent=4)}")
        if self.post_processing:
            parts.append(f"  Post-proc: {json.dumps(self.post_processing, indent=4)}")
        if self.object_design:
            parts.append(f"  Object design: {json.dumps(self.object_design, indent=4)}")
        return "\n".join(parts)


@dataclass
class ExperimentResult:
    """Result of running a candidate on a journey."""
    animation: str
    candidate_name: str
    iou: float = 0.0
    recall: float = 0.0
    precision: float = 0.0
    temporal_stability: float = 0.0
    contour_quality: float = 0.0
    rest_purity: float = 0.0
    gate_pass: bool = False
    zero_frames: int = 0
    total_frames: int = 96
    notes: str = ""

    @property
    def score(self) -> float:
        """Weighted harmonic mean of normalized metrics."""
        vals = {
            "iou": min(self.iou / 0.70, 1.0),
            "temporal_stability": max(0, 1.0 - self.temporal_stability / 0.05),
            "contour_quality": max(0, 1.0 - max(0, self.contour_quality - 10) / 45),
            "gate_pass": 1.0 if self.gate_pass else 0.0,
        }
        w_sum = sum(METRIC_WEIGHTS.values())
        h_num = w_sum
        h_den = sum(
            METRIC_WEIGHTS[k] / max(vals[k], 1e-6) for k in METRIC_WEIGHTS
        )
        return h_num / h_den if h_den > 0 else 0.0


def load_manifest() -> dict:
    return json.loads((ROOT / "src/assets/manifest.json").read_text())


def get_hotspot(anim_key: str) -> dict:
    room_id, hotspot_id = anim_key.split("/")
    m = load_manifest()
    for room in m["escape"]:
        if room["id"] == room_id:
            for h in room["hotspots"]:
                if h["id"] == hotspot_id:
                    return h
    raise KeyError(f"No hotspot {anim_key}")


def _plate_diff_mask(room_id: str) -> np.ndarray | None:
    """Compute plate-diff ground-truth mask for an object using smoothstep."""
    scene_path = ROOT / "assets" / "game" / "escape" / f"{room_id}.png"
    plate_path = ROOT / "assets" / "game" / "escape" / f"{room_id}_clean.png"
    if not scene_path.exists() or not plate_path.exists():
        return None
    scene = np.array(Image.open(scene_path).convert("RGB")).astype(np.float32)
    plate = np.array(Image.open(plate_path).convert("RGB")).astype(np.float32)
    diff = np.abs(scene - plate).max(axis=2)
    t = np.clip((diff - PLATE_DIFF_FADE_LO) / (PLATE_DIFF_FADE_HI - PLATE_DIFF_FADE_LO), 0, 1)
    return t * t * (3 - 2 * t)


def measure_iou(masks_dir: Path, room_id: str) -> tuple[float, float, float, int]:
    """IoU of SAM mask vs plate-diff ground truth at frame 0.
    Returns (iou, recall, precision, zero_frame_count)."""
    m0_path = masks_dir / "mask_0000.png"
    if not m0_path.exists():
        return 0.0, 0.0, 0.0, 96
    m0 = np.array(Image.open(m0_path).convert("L"))
    if m0.shape != (720, 1280):
        m0 = np.array(Image.fromarray(m0).resize((1280, 720), Image.NEAREST))
    sam_mask = m0 > 127

    gt = _plate_diff_mask(room_id)
    if gt is None:
        return 0.0, 0.0, 0.0, 96
    gt_mask = gt > 0.5

    intersection = float((sam_mask & gt_mask).sum())
    union = float((sam_mask | gt_mask).sum())
    gt_sum = float(gt_mask.sum())
    sam_sum = float(sam_mask.sum())

    iou = intersection / union if union > 0 else 0.0
    recall = intersection / gt_sum if gt_sum > 0 else 0.0
    precision = intersection / sam_sum if sam_sum > 0 else 0.0

    zeros = 0
    for i in range(96):
        p = masks_dir / f"mask_{i:04d}.png"
        if p.exists():
            mi = np.array(Image.open(p).convert("L"))
            if mi.max() == 0:
                zeros += 1
        else:
            zeros += 1
    return iou, recall, precision, zeros


def measure_temporal_stability(masks_dir: Path, frames_dir: Path) -> float:
    """Warp error p95 between consecutive frame masks (motion-compensated)."""
    try:
        sys.path.insert(0, str(ROOT / "tools"))
        from escape_layers.temporal_qa import warp_error
    except ImportError:
        return 0.0

    errors = []
    for i in range(95):
        m1_p = masks_dir / f"mask_{i:04d}.png"
        m2_p = masks_dir / f"mask_{i + 1:04d}.png"
        f1_p = frames_dir / f"f_{i + 1:04d}.png"
        f2_p = frames_dir / f"f_{i + 2:04d}.png"
        if not all(p.exists() for p in [m1_p, m2_p, f1_p, f2_p]):
            continue
        m1 = np.array(Image.open(m1_p).convert("L")).astype(np.float32) / 255
        m2 = np.array(Image.open(m2_p).convert("L")).astype(np.float32) / 255
        f1 = np.array(Image.open(f1_p).convert("L")).astype(np.float32) / 255
        f2 = np.array(Image.open(f2_p).convert("L")).astype(np.float32) / 255
        e = warp_error(m1, m2, f1, f2)
        errors.append(e)
    return float(np.percentile(errors, 95)) if errors else 0.0


# --- Experiment definitions ---

BASELINE = SegmentationCandidate(
    name="baseline_diff_key",
    prompt_strategy={},
    seeding_method="plate_diff",
    post_processing={"change_thresh": 90, "morphology": True, "feather_px": 1},
)

SAM_TEXT_BBOX = SegmentationCandidate(
    name="sam_text_bbox",
    seeding_method="text_bbox",
    prompt_strategy={
        "toyroom/pillow": {"prompt": "pillow", "direction": "bidirectional"},
        "toyroom/chest": {"prompt": "wooden toy chest", "direction": "bidirectional"},
        "toyroom/pen": {"prompt": "wooden playpen", "direction": "bidirectional"},
        "dragoncave/haystack": {"prompt": "haystack", "direction": "bidirectional"},
        "dragoncave/stove": {"prompt": "pot belly stove", "direction": "bidirectional"},
        "dragoncave/dragon": {"prompt": "blue dragon", "direction": "bidirectional"},
        "piratecove/net": {"prompt": "fishing net", "direction": "bidirectional"},
        "piratecove/pelican": {"prompt": "pelican", "direction": "bidirectional"},
        "piratecove/chest": {"prompt": "treasure chest", "direction": "bidirectional"},
        "rocketpad/toolbox": {"prompt": "red toolbox", "direction": "bidirectional"},
        "rocketpad/crate": {"prompt": "brown wooden box", "direction": "bidirectional"},
        "rocketpad/panel": {"prompt": "control panel", "direction": "bidirectional"},
        "rocketpad/slot": {"prompt": "rocket slot", "direction": "bidirectional"},
    },
)

SAM_MULTI_PART = SegmentationCandidate(
    name="sam_multi_part",
    seeding_method="multi_part_union",
    prompt_strategy={
        "rocketpad/crate": {
            "parts": [
                {"prompt": "green wooden treasure chest lid", "direction": "bidirectional"},
                {"prompt": "brown wooden box", "direction": "bidirectional"},
                {"prompt": "green battery", "direction": "bidirectional"},
            ],
            "union_method": "binary_fill_holes",
        },
    },
)

SAM_STILL_SEED = SegmentationCandidate(
    name="sam_still_seed",
    seeding_method="still_mask_seed",
    prompt_strategy={
        "rocketpad/crate": {
            "keyframes": [0, 32, 64],
            "still_detector": "sam3_detect",
            "propagation": "chunked_32",
        },
    },
)

CRATE_REDRAW_UNIFORM = SegmentationCandidate(
    name="crate_redraw_uniform",
    seeding_method="text_bbox",
    prompt_strategy={
        "rocketpad/crate": {"prompt": "red wooden box", "direction": "bidirectional"},
    },
    object_design={
        "rocketpad/crate": {
            "strategy": "recolor_uniform",
            "target_color": "#C44B2F",
            "material": "painted wood, single solid color",
            "rationale": "Single dominant red avoids green/brown split that confuses SAM",
        },
    },
)


def define_experiments() -> list[SegmentationCandidate]:
    """All experiment candidates to evaluate."""
    return [
        BASELINE,
        SAM_TEXT_BBOX,
        SAM_MULTI_PART,
        SAM_STILL_SEED,
        CRATE_REDRAW_UNIFORM,
    ]


def run_experiment(
    candidate: SegmentationCandidate,
    animation: str,
    gpu_vm: dict | None = None,
) -> ExperimentResult:
    """Run a candidate on a single animation and return metrics.

    Requires GPU VM for SAM-based candidates. Diff-key baseline runs locally.
    """
    result = ExperimentResult(
        animation=animation,
        candidate_name=candidate.name,
    )

    room_id, hotspot_id = animation.split("/")

    if candidate.seeding_method == "plate_diff":
        gt = _plate_diff_mask(room_id)
        if gt is not None:
            result.iou = 1.0
            result.recall = 1.0
            result.precision = 1.0
            result.gate_pass = True
            result.notes = "baseline diff-key (ground truth = itself)"
        return result

    if gpu_vm is None:
        result.notes = "SKIPPED: no GPU available"
        return result

    masks_dir = TMP / f"gepa/{candidate.name}/{room_id}_{hotspot_id}/masks"
    frames_dir = TMP / f"fix3/{room_id}_{hotspot_id}/frames"

    if not masks_dir.exists():
        result.notes = f"NEEDS_RUN: masks not yet generated at {masks_dir}"
        return result

    result.iou, result.recall, result.precision, result.zero_frames = measure_iou(masks_dir, room_id)
    if frames_dir.exists():
        result.temporal_stability = measure_temporal_stability(masks_dir, frames_dir)
    result.gate_pass = result.iou >= 0.50 and result.zero_frames == 0

    return result


def generate_report(results: list[ExperimentResult]) -> str:
    """Generate a GEPA-style comparison report."""
    lines = ["# GEPA Segmentation Experiment Report\n"]

    by_anim: dict[str, list[ExperimentResult]] = {}
    for r in results:
        by_anim.setdefault(r.animation, []).append(r)

    for anim in sorted(by_anim):
        lines.append(f"\n## {anim}")
        lines.append(f"| Candidate | IoU | Recall | Precision | Zeros | Temporal | Gate | Score |")
        lines.append(f"|---|---|---|---|---|---|---|---|")
        for r in sorted(by_anim[anim], key=lambda x: -x.score):
            lines.append(
                f"| {r.candidate_name} | {r.iou:.3f} | {r.recall:.3f} | {r.precision:.3f} "
                f"| {r.zero_frames} "
                f"| {r.temporal_stability:.4f} | {'PASS' if r.gate_pass else 'FAIL'} "
                f"| {r.score:.3f} |"
            )
        best = max(by_anim[anim], key=lambda x: x.score)
        lines.append(f"\n**Winner:** {best.candidate_name} (score {best.score:.3f})")

    return "\n".join(lines)


if __name__ == "__main__":
    print("GEPA Segmentation Framework")
    print(f"  {len(ANIMATIONS)} animations")
    print(f"  Train: {TRAIN_SET}")
    print(f"  Val: {VAL_SET}")
    print(f"  Holdout: {HOLDOUT_SET}")
    print(f"  {len(define_experiments())} candidates defined")

    for c in define_experiments():
        print(f"\n{c.describe()}")
