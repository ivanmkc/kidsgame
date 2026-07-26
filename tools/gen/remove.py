"""Robust adaptive object removal — GEPA R7-R9 distilled.

Removes objects from escape room scenes using Gemini image editing with:
- Size-adaptive crop padding (small objects get tight crops)
- Native removal first, cyan-fill fallback
- 5-criterion rubric judge gate (object, shadow, collateral, boundary, fill)
- Thread-safe Gemini clients for parallel operation

Replaces the deprecated Imagen 3 pipeline with Gemini 3.1 Flash Lite (image).

Usage:
    from gen.remove import remove_object, remove_all_objects

    result = remove_object(scene, sam_mask_bool, "dragon")
    if result is not None:
        clean_scene, scores = result

CLI:
    python3 tools/gen/remove.py <room_id> [hotspot ...]
"""
from __future__ import annotations

import io
import json
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np
from PIL import Image

EDIT_MODEL = "gemini-3.1-flash-lite-image"
JUDGE_MODEL = "gemini-3.6-flash"
PROJECT = "adk-coding-agents"
LOCATION = "global"

CYAN = (0, 255, 255)
MAX_ATTEMPTS = 3

CRITERIA = ["object_removal", "shadow_removal", "collateral", "boundary", "fill_quality"]

RUBRIC_PROMPT = """\
You are an expert evaluator for image inpainting quality in game scenes. An object \
was removed and the region filled in.

Image 1: ORIGINAL (object present). Image 2: RESULT (after removal).

Score each criterion 1-5:

OBJECT_REMOVAL: 5=gone, 4=faint ghost, 3=small fragment, 2=significant remains, 1=still present
SHADOW_REMOVAL: 5=no trace, 4=subtle darkening, 3=faint shadow, 2=clear remnant, 1=intact shadow
COLLATERAL: 5=pixel-identical outside, 4=negligible, 3=minor, 2=noticeable, 1=major damage
BOUNDARY: 5=invisible, 4=detectable comparing, 3=subtle, 2=clear seam, 1=harsh outline
FILL_QUALITY: 5=indistinguishable, 4=natural, 3=acceptable, 2=artificial, 1=clearly wrong

Reason step-by-step, then end with JSON:
```json
{"object_removal": N, "shadow_removal": N, "collateral": N, "boundary": N, "fill_quality": N}
```
"""

_tls = threading.local()


def _client():
    from google import genai
    if getattr(_tls, "client", None) is None:
        _tls.client = genai.Client(vertexai=True, project=PROJECT, location=LOCATION)
    return _tls.client


def _reset_client():
    _tls.client = None


def _png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def _sam_bbox(mask: np.ndarray, pad: int = 60) -> tuple[int, int, int, int]:
    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]
    h, w = mask.shape
    return (max(0, cmin - pad), max(0, rmin - pad),
            min(w, cmax + pad + 1), min(h, rmax + pad + 1))


def _choose_padding(mask: np.ndarray) -> int:
    """Size-adaptive padding: small objects get tight crops so the model
    can identify them; large objects get wide context for fill quality."""
    area = mask.sum()
    scene_area = mask.shape[0] * mask.shape[1]
    ratio = area / scene_area
    if ratio < 0.005:
        return 30
    if ratio < 0.02:
        return 60
    return 110


def _gemini_edit(img: Image.Image, prompt: str, attempts: int = 3) -> Image.Image:
    from google.genai import types
    last = None
    for i in range(attempts):
        try:
            resp = _client().models.generate_content(
                model=EDIT_MODEL,
                contents=[prompt, types.Part.from_bytes(
                    data=_png_bytes(img), mime_type="image/png")],
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE", "TEXT"]),
            )
            for cand in (resp.candidates or []):
                for part in (cand.content.parts or []):
                    if getattr(part, "inline_data", None) and \
                       part.inline_data.mime_type.startswith("image/"):
                        return Image.open(
                            io.BytesIO(part.inline_data.data)).convert("RGB")
            last = RuntimeError("no image in response")
        except Exception as e:
            last = e
            _reset_client()
        wait = 3 * (i + 1)
        print(f"  WARN edit attempt {i + 1}: {type(last).__name__}: "
              f"{str(last)[:100]}; retry in {wait}s", file=sys.stderr)
        time.sleep(wait)
    raise RuntimeError(f"gemini_edit failed after {attempts} attempts: {last}")


def rubric_judge(original_crop: Image.Image,
                 result_crop: Image.Image) -> dict[str, int]:
    from google.genai import types
    resp = _client().models.generate_content(
        model=JUDGE_MODEL,
        contents=[
            RUBRIC_PROMPT,
            "Image 1 (ORIGINAL):",
            types.Part.from_bytes(
                data=_png_bytes(original_crop), mime_type="image/png"),
            "Image 2 (RESULT):",
            types.Part.from_bytes(
                data=_png_bytes(result_crop), mime_type="image/png"),
        ],
        config=types.GenerateContentConfig(
            response_modalities=["TEXT"], temperature=0.0),
    )
    text = (resp.text or "").strip()
    m = re.search(r'\{[^{}]*"object_removal"[^{}]*\}', text)
    if m:
        try:
            scores = json.loads(m.group())
            for c in CRITERIA:
                v = scores.get(c)
                if not isinstance(v, int) or v < 1 or v > 5:
                    scores[c] = 0
            return scores
        except json.JSONDecodeError:
            pass
    return {c: 0 for c in CRITERIA}


def passes_gate(scores: dict[str, int]) -> bool:
    return all(3 <= scores.get(c, 0) <= 5 for c in CRITERIA)


def _try_native(scene: Image.Image, mask: np.ndarray,
                obj_name: str, pad: int) -> tuple[Image.Image, dict] | None:
    """Native removal: crop region, prompt to remove object, composite back."""
    x0, y0, x1, y1 = _sam_bbox(mask, pad=pad)
    crop = scene.crop((x0, y0, x1, y1))
    prompt = (
        f"Remove the {obj_name} from this image. Fill the area where it was "
        f"with a seamless continuation of the surrounding scenery — matching "
        f"the same art style, color palette, and level of detail. Keep "
        f"everything else exactly the same. The result should look like the "
        f"{obj_name} was never there."
    )
    result_crop = _gemini_edit(crop, prompt)
    if result_crop.size != crop.size:
        result_crop = result_crop.resize(crop.size, Image.Resampling.LANCZOS)

    full = scene.copy()
    full.paste(result_crop, (x0, y0))

    jx0, jy0, jx1, jy1 = _sam_bbox(mask, pad=60)
    scores = rubric_judge(scene.crop((jx0, jy0, jx1, jy1)),
                          full.crop((jx0, jy0, jx1, jy1)))
    if passes_gate(scores):
        return full, scores
    return None


def _try_cyan(scene: Image.Image, mask: np.ndarray,
              pad: int) -> tuple[Image.Image, dict] | None:
    """Cyan-fill removal: mark object with cyan, prompt to replace."""
    x0, y0, x1, y1 = _sam_bbox(mask, pad=pad)
    crop = scene.crop((x0, y0, x1, y1))
    mask_crop = mask[y0:y1, x0:x1]
    arr = np.array(crop).copy()
    arr[mask_crop] = CYAN
    cyan_crop = Image.fromarray(arr)
    prompt = (
        "The cyan/turquoise colored region in this image is a placeholder "
        "marker. Replace ONLY the cyan region with a seamless continuation "
        "of the surrounding scenery. The result should look completely "
        "natural with no trace of cyan. Do not change anything outside the "
        "cyan region."
    )
    result_crop = _gemini_edit(cyan_crop, prompt)
    if result_crop.size != crop.size:
        result_crop = result_crop.resize(crop.size, Image.Resampling.LANCZOS)

    full = scene.copy()
    full.paste(result_crop, (x0, y0))

    jx0, jy0, jx1, jy1 = _sam_bbox(mask, pad=60)
    scores = rubric_judge(scene.crop((jx0, jy0, jx1, jy1)),
                          full.crop((jx0, jy0, jx1, jy1)))
    if passes_gate(scores):
        return full, scores
    return None


def remove_object(
    scene: Image.Image,
    sam_mask: np.ndarray,
    obj_name: str,
    max_attempts: int = MAX_ATTEMPTS,
) -> tuple[Image.Image, dict[str, int]] | None:
    """Remove an object from a scene using adaptive strategy.

    Returns (clean_scene, rubric_scores) on success, None on failure.
    """
    pad = _choose_padding(sam_mask)
    best = None

    for attempt in range(max_attempts):
        result = _try_native(scene, sam_mask, obj_name, pad)
        if result is not None:
            _, scores = result
            tag = " ".join(f"{c[:3]}={scores[c]}" for c in CRITERIA)
            print(f"  {obj_name} native #{attempt + 1}: {tag} [PASS]")
            if best is None or _score_sum(scores) > _score_sum(best[1]):
                best = result
            break
        print(f"  {obj_name} native #{attempt + 1}: FAIL, trying cyan")

        result = _try_cyan(scene, sam_mask, pad)
        if result is not None:
            _, scores = result
            tag = " ".join(f"{c[:3]}={scores[c]}" for c in CRITERIA)
            print(f"  {obj_name} cyan #{attempt + 1}: {tag} [PASS]")
            if best is None or _score_sum(scores) > _score_sum(best[1]):
                best = result
            break
        print(f"  {obj_name} cyan #{attempt + 1}: FAIL")

    return best


def _score_sum(scores: dict[str, int]) -> int:
    return sum(scores.get(c, 0) for c in CRITERIA)


def remove_all_objects(
    scene: Image.Image,
    masks: dict[str, np.ndarray],
    names: dict[str, str],
    max_workers: int = 4,
) -> tuple[Image.Image, dict[str, dict]]:
    """Remove all objects from a scene, returning clean plate + per-object scores.

    Objects are removed independently from the original scene, then composited
    in a single pass (each removal only touches its own mask region).
    """
    results: dict[str, tuple[Image.Image, dict]] = {}

    def _do(hotspot: str) -> tuple[str, tuple | None]:
        mask = masks[hotspot]
        name = names.get(hotspot, hotspot)
        r = remove_object(scene, mask, name)
        return hotspot, r

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_do, h): h for h in masks}
        for fut in as_completed(futures):
            hotspot, r = fut.result()
            if r is not None:
                results[hotspot] = r
            else:
                print(f"  WARNING: {hotspot} removal failed all attempts")

    clean = np.array(scene).copy()
    scores_out = {}
    for hotspot in masks:
        if hotspot not in results:
            scores_out[hotspot] = {"error": "all attempts failed"}
            continue
        img, scores = results[hotspot]
        mask = masks[hotspot]
        result_arr = np.array(img)
        clean[mask] = result_arr[mask]
        scores_out[hotspot] = scores

    return Image.fromarray(clean), scores_out


# ---- CLI ----

ROOT = Path(__file__).resolve().parent.parent.parent
SCENES = ROOT / "assets" / "game" / "escape"
SAM_DIR = SCENES / "sam_masks"

OBJECT_NAMES = {
    "dragon": "dragon", "haystack": "haystack", "stove": "stove",
    "chest": "treasure chest", "net": "fishing net",
    "pelican": "pelican bird", "crate": "wooden crate",
    "panel": "control panel", "slot": "slot machine",
    "toolbox": "toolbox", "pen": "pen", "pillow": "pillow",
}


def _load_masks(room_id: str | None = None,
                hotspots: list[str] | None = None
                ) -> list[tuple[str, str, str, np.ndarray]]:
    """Load SAM masks, returning (room, hotspot, obj_name, mask_bool)."""
    out = []
    for f in sorted(SAM_DIR.glob("*.png")):
        parts = f.stem.split("_", 1)
        if len(parts) != 2:
            continue
        room, hs = parts
        if room_id and room != room_id:
            continue
        if hotspots and hs not in hotspots:
            continue
        mask = np.array(Image.open(f).convert("L")) > 127
        name = OBJECT_NAMES.get(hs, hs)
        out.append((room, hs, name, mask))
    return out


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Remove objects from escape scenes")
    parser.add_argument("room", nargs="?", help="Room ID (all rooms if omitted)")
    parser.add_argument("hotspots", nargs="*", help="Hotspot names (all if omitted)")
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--attempts", type=int, default=3)
    args = parser.parse_args()

    items = _load_masks(args.room, args.hotspots or None)
    if not items:
        print("No matching SAM masks found")
        return

    scenes_cache: dict[str, Image.Image] = {}
    passed, failed = 0, 0

    def run_one(item):
        room, hs, name, mask = item
        if room not in scenes_cache:
            scenes_cache[room] = Image.open(SCENES / f"{room}.png").convert("RGB")
        scene = scenes_cache[room]
        result = remove_object(scene, mask, name, max_attempts=args.attempts)
        return room, hs, name, result

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        # Pre-load scenes (sequential, fast)
        for room, _, _, _ in items:
            if room not in scenes_cache:
                scenes_cache[room] = Image.open(
                    SCENES / f"{room}.png").convert("RGB")

        futures = {pool.submit(run_one, item): item for item in items}
        for fut in as_completed(futures):
            room, hs, _, result = fut.result()
            if result is not None:
                _, scores = result
                tag = " ".join(f"{c[:3]}={scores[c]}" for c in CRITERIA)
                print(f"  {room}/{hs}: PASS — {tag}")
                passed += 1
            else:
                print(f"  {room}/{hs}: FAIL — all attempts exhausted")
                failed += 1

    print(f"\nResults: {passed} passed, {failed} failed out of {len(items)}")


if __name__ == "__main__":
    main()
