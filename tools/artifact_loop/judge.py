"""Dual-judge artifact detection for rendered screenshots.

For each PNG, tiles the image and runs two independently-phrased Gemini
vision judges. A finding counts if EITHER judge reports it (union for
detection). A surface is clean only if BOTH judges say clean.

Uses the structured taxonomy:
  rectangular_seam, ghost_semitransparent_sprite, fringe_halo,
  clipped_object, mismatched_patch, baked_text, layout_overflow,
  blank_region, duplicate_character, other
"""

from __future__ import annotations

import io
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image
from google.genai import types

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from gen.nbp import client  # noqa: E402

_JUDGE_CANDIDATES = ["gemini-3.5-flash", "gemini-3.1-flash", "gemini-3-flash-preview", "gemini-2.5-flash"]
_judge_model: str | None = None


def judge_model() -> str:
    global _judge_model
    if _judge_model is None:
        for m in _JUDGE_CANDIDATES:
            try:
                client().models.generate_content(model=m, contents="Say OK")
                _judge_model = m
                break
            except Exception:
                continue
        if _judge_model is None:
            raise RuntimeError(f"no judge model reachable: {_JUDGE_CANDIDATES}")
        print(f"judge model: {_judge_model}")
    return _judge_model


TAXONOMY = [
    "rectangular_seam",
    "ghost_semitransparent_sprite",
    "fringe_halo",
    "clipped_object",
    "mismatched_patch",
    "baked_text",
    "layout_overflow",
    "blank_region",
    "duplicate_character",
    "other",
]

INTENTIONAL_STYLE = """IMPORTANT — these are INTENTIONAL and should NOT be flagged:
- Flat cartoon shapes with bold clean outlines (this is a children's picture-book art style)
- Emoji previews shown in menu cards (small emoji icons in card previews are intentional)
- Simple geometric UI elements (rounded rectangles, circles for buttons)
- Beta badges or label pills on cards
- Parallax layers with different art densities (sky sparser than ground is by design)
- Semi-transparent floating music notes or stars that appear after tapping (these are game feedback)"""

JUDGE_A_PROMPT = f"""You are a QA inspector checking a children's game screenshot for VISUAL ARTIFACTS
(rendering bugs, not intentional art). Study the image carefully.

{INTENTIONAL_STYLE}

For each artifact you find, report it as a JSON object with these fields:
- "class": one of {json.dumps(TAXONOMY)}
- "where": brief description of where in the image (e.g. "top-left corner", "center of scene")
- "severity": 1 (minor cosmetic), 2 (noticeable), or 3 (glaring/broken)
- "description": what exactly looks wrong

If no artifacts are found, return an empty array.

Respond with ONLY a JSON array, no other text. Example:
[{{"class": "rectangular_seam", "where": "left edge of scene", "severity": 2, "description": "hard vertical line where two background strips join"}}]
or [] if clean."""

JUDGE_B_PROMPT = f"""Examine this screenshot from a children's interactive app. Your job is to find
RENDERING DEFECTS — things that look broken, glitchy, or unfinished, NOT
intentional artistic choices.

{INTENTIONAL_STYLE}

Look specifically for:
1. Hard rectangular edges or seams where image strips were stitched
2. Semi-transparent ghostly copies of sprites that shouldn't be there
3. White or dark outlines/halos around cutout objects
4. Objects that are cut off or clipped by the screen edge unnaturally
5. Patches of art that look like a different style from surrounding areas
6. Text or letters baked into artwork that shouldn't have text
7. UI elements overflowing their containers
8. Large blank or solid-color regions that look unfinished
9. The same character or object appearing twice in the same scene
10. Any other rendering anomaly

Report each defect as a JSON object:
- "class": one of {json.dumps(TAXONOMY)}
- "where": region description
- "severity": 1-3
- "description": what's wrong

Return ONLY a JSON array. Empty array [] if no defects found."""


def _png_part(img: Image.Image) -> types.Part:
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return types.Part(inline_data=types.Blob(mime_type="image/png", data=buf.getvalue()))


def _ask_findings(prompt: str, img: Image.Image, attempts: int = 3) -> list[dict]:
    parts = [_png_part(img), types.Part(text=prompt)]
    for i in range(attempts):
        try:
            resp = client().models.generate_content(
                model=judge_model(),
                contents=[types.Content(role="user", parts=parts)],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )
            text = (resp.text or "").strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            result = json.loads(text)
            if isinstance(result, list):
                return [f for f in result if isinstance(f, dict) and "class" in f]
            return []
        except Exception as e:  # noqa: BLE001
            print(f"  WARN judge attempt {i + 1}: {type(e).__name__}: {str(e)[:120]}", file=sys.stderr)
            time.sleep(4 * (i + 1))
    return []


def judge_image(surface_id: str, screenshot_path: str) -> list[dict]:
    """Run dual judges on a screenshot. Union of findings (either reports = counts)."""
    img = Image.open(screenshot_path).convert("RGB")

    findings_a = _ask_findings(JUDGE_A_PROMPT, img)
    findings_b = _ask_findings(JUDGE_B_PROMPT, img)

    merged = []
    seen_keys = set()

    for src, findings in [("judge_a", findings_a), ("judge_b", findings_b)]:
        for f in findings:
            cls = f.get("class", "other")
            if cls not in TAXONOMY:
                cls = "other"
            where = f.get("where", "unknown")
            key = (cls, where[:30])
            if key in seen_keys:
                continue
            seen_keys.add(key)
            merged.append({
                "surface": surface_id,
                "screenshot": str(screenshot_path),
                "class": cls,
                "where": where,
                "severity": min(3, max(1, int(f.get("severity", 1)))),
                "description": f.get("description", "")[:200],
                "source": src,
            })

    return merged


def judge_all(captures: list[dict], max_workers: int = 4) -> list[dict]:
    """Judge all captured screenshots. Returns combined findings list."""
    all_findings = []

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {}
        for cap in captures:
            fut = pool.submit(judge_image, cap["surface"], cap["screenshot"])
            futures[fut] = cap["surface"]

        for fut in as_completed(futures):
            surface = futures[fut]
            try:
                findings = fut.result()
                if findings:
                    for f in findings:
                        print(f"  FLAG [{f['class']}] {surface}: {f['description'][:80]}")
                    all_findings.extend(findings)
                else:
                    print(f"  CLEAN {surface}")
            except Exception as e:
                print(f"  ERROR judging {surface}: {e}", file=sys.stderr)

    return sorted(all_findings, key=lambda f: (-f["severity"], f["surface"]))


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Judge screenshots for artifacts")
    parser.add_argument("captures_json", help="Path to captures.json from capture.mjs")
    parser.add_argument("-o", "--output", required=True, help="Output findings JSON path")
    parser.add_argument("-w", "--workers", type=int, default=4)
    args = parser.parse_args()

    captures = json.loads(Path(args.captures_json).read_text())
    findings = judge_all(captures, max_workers=args.workers)

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(findings, indent=2))
    print(f"\n{len(findings)} findings -> {out}")


if __name__ == "__main__":
    main()
