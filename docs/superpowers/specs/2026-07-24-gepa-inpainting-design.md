# GEPA Inpainting Quality Optimization

## Problem

Clean plates have visible inpainting artifacts — texture discontinuities, fill seams, and color mismatches where objects were removed. The Imagen removal pipeline uses hardcoded prompts and mask parameters that were never systematically optimized. The new 4-metric infill quality gate (seam, color_diff, patch_seam, texture_ratio) quantifies these artifacts and provides an objective optimization signal.

## Approach

Apply GEPA (Genetic Evolution of Prompt Architecture) to search for optimal Imagen inpainting parameters — one universal configuration that works across all escape-room objects.

### Gene components (the candidate dict)

```python
@dataclass
class InpaintCandidate:
    name: str
    removal_prompt: str       # Imagen prompt text
    negative_prompt: str      # Imagen negative prompt
    mask_dilation: int        # paint mask dilation (px)
    composite_dilation: int   # accept-back mask dilation (px)
```

**Baseline** (current hardcoded values):
- `removal_prompt`: `"empty background, seamless continuation of the surrounding scenery"`
- `negative_prompt`: `"a new object, a new animal, a new character, text, watermark"`
- `mask_dilation`: 12
- `composite_dilation`: 4

### Metrics (4-axis weighted harmonic mean)

| Metric | Weight | Normalization | What it catches |
|---|---|---|---|
| `patch_seam` (p95) | 0.35 | `max(0, 1 - patch_seam/35)` | Localized hard edges at mask boundary |
| `texture_ratio` | 0.25 | `max(0, 1 - abs(texture_ratio - 1)/0.5)` | Texture variance discontinuity |
| `color_diff` | 0.20 | `max(0, 1 - color_diff/20)` | Global color mismatch |
| `seam` | 0.20 | `max(0, 1 - seam/12)` | Global boundary gradient |

Gate condition: `patch_seam <= 35 AND texture_ratio <= 1.5 AND color_diff <= 20 AND seam <= 12`

### Data split (difficulty-based)

**Train (7)** — optimization targets, hardest objects:
- `rocketpad/toolbox` (hard: floor-wall texture boundary)
- `piratecove/net` (medium-hard: thin mesh, gray-on-gray)
- `rocketpad/crate` (medium-hard: multi-material, large area)
- `rocketpad/panel` (medium: shared rocket, color diff)
- `toyroom/pillow` (medium: texture ratio)
- `piratecove/chest` (medium: color diff)
- `toyroom/pen` (medium: wide motion, patch seam)

**Eval (3)** — validation, medium difficulty:
- `rocketpad/slot` (medium: shared rocket)
- `dragoncave/haystack` (medium: large area)
- `toyroom/chest` (medium: texture ratio)

**Holdout (3)** — OOD promotion gate, easy objects:
- `dragoncave/stove` (easy)
- `piratecove/pelican` (easy)
- `dragoncave/dragon` (easy)

Designed for extensibility — new objects added to train or eval sets by appending to lists.

### Evaluation protocol

For each candidate:
1. Start from the original scene image (`{room}.png`)
2. Load the SAM mask for the object
3. Dilate mask by `candidate.mask_dilation` for the paint region
4. Dilate mask by `candidate.composite_dilation` for the accept-back region
5. Call `imagen_remove_mask(scene, paint_mask, composite_mask)` with candidate prompts
6. Measure all 4 infill metrics on the result
7. Compute weighted harmonic score
8. Gate check: all 4 metrics must pass absolute thresholds

K=3 samples per object (median score) for robustness against Imagen stochasticity.

### Reflective hill-climb

1. Evaluate baseline on train set
2. LLM reflector reads per-object metric breakdown, identifies weakest axis
3. Proposes a mutation to the prompt or parameters to improve that axis
4. Evaluate mutation on train set
5. Accept if median harmonic score improves; reject otherwise
6. Repeat for N iterations (3-5)
7. Validate winner on eval set
8. Promote if holdout gate passes

### Architecture

```
tools/experiments/gepa_inpainting.py
├── InpaintCandidate       — gene components
├── InpaintResult          — per-object metrics
├── evaluate_candidate()   — runs inpainting + measures quality
├── score()                — weighted harmonic mean
├── TRAIN/EVAL/HOLDOUT     — data splits
├── METRIC_WEIGHTS         — scoring weights
└── BASELINE               — current production config
```

Follows the same pattern as `gepa_segmentation.py`. Uses `gen.nbp.imagen_remove_mask` for inpainting, and the infill metric functions from `verify_escape_chain.py` for scoring.

## Constraints

- Imagen API calls are rate-limited and cost money — K=3 × 13 objects × ~5 iterations = ~200 API calls per run
- Each call takes 5-15 seconds; full train-set evaluation = ~3-5 minutes
- The original scene images are the starting point (not the current clean plates), so results are independent of prior inpainting
- Per-hotspot baselines in `remnant_baselines.json` are NOT used during optimization — raw thresholds only, so the optimizer doesn't learn to game baselines
