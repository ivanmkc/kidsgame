"""Artifact detection phase: sweep every shipped scene for editing artifacts.

Layer 1 (deterministic): a diff pair must be pixel-identical outside its
difference rects (+feather margin) — any violation is a pipeline bug.
Layer 2 (judged): overlapping tiles of every scene image go through an
inverted artifact-hunt question ("answer YES if you see ANY editing
mistake"), threaded for speed. Flags are saved as crops for human review.

Output: tmp/artifact_report.json + flagged crop PNGs.
"""

from __future__ import annotations

import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))

from gen.judge import ask_yes_no  # noqa: E402

ROOT = Path(__file__).parent.parent
ASSETS = ROOT / "assets" / "game"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"
OUT = Path.home() / ".claude/jobs/c60063e9/tmp/artifacts"

ARTIFACT_Q = (
    "You are inspecting one region of a children's book illustration for "
    "EDITING MISTAKES. Answer YES if you see ANY of: a pale or white "
    "rectangular patch, an erased-looking smear, a blurry spot unlike the "
    "rest, a half-drawn or cut-off object, a hard rectangular seam, or a "
    "style clash. Answer NO if the region looks cleanly illustrated."
)


def tiles(w: int, h: int, cols: int = 3, rows: int = 2, overlap: float = 0.25):
    tw, th = w // cols, h // rows
    ox, oy = int(tw * overlap), int(th * overlap)
    for r in range(rows):
        for c in range(cols):
            x0 = max(0, c * tw - ox)
            y0 = max(0, r * th - oy)
            x1 = min(w, (c + 1) * tw + ox)
            y1 = min(h, (r + 1) * th + oy)
            yield (x0, y0, x1, y1)


def check_pair_identity(entry: dict) -> list[dict]:
    """Outside the diff rects (+6px feather margin), A and B must match."""
    a = np.asarray(Image.open(ASSETS / entry["imageA"]).convert("RGB"), np.int16)
    b = np.asarray(Image.open(ASSETS / entry["imageB"]).convert("RGB"), np.int16)
    mask = np.zeros(a.shape[:2], bool)
    for d in entry["diffs"]:
        y0, y1 = max(0, d["y"] - 6), min(a.shape[0], d["y"] + d["h"] + 6)
        x0, x1 = max(0, d["x"] - 6), min(a.shape[1], d["x"] + d["w"] + 6)
        mask[y0:y1, x0:x1] = True
    outside = np.abs(a - b).sum(-1) > 60  # JPEG noise tolerance
    outside[mask] = False
    frac = float(outside.mean())
    if frac > 0.002:
        return [{"asset": entry["imageB"], "kind": "pair-identity",
                 "detail": f"{frac:.3%} of out-of-rect pixels differ"}]
    return []


def judge_tile(args) -> dict | None:
    path, rect, tag = args
    img = Image.open(ASSETS / path).convert("RGB")
    crop = img.crop(rect)
    if ask_yes_no(ARTIFACT_Q, [crop]):
        OUT.mkdir(parents=True, exist_ok=True)
        crop_name = f"{tag}.png"
        crop.save(OUT / crop_name)
        return {"asset": path, "kind": "judged-artifact",
                "rect": list(rect), "crop": crop_name}
    return None


def main() -> None:
    m = json.loads(MANIFEST.read_text())
    findings: list[dict] = []

    for entry in m["diff"]:
        findings.extend(check_pair_identity(entry))

    jobs = []
    for entry in m["diff"]:
        for img_key in ("imageA", "imageB"):
            path = entry[img_key]
            with Image.open(ASSETS / path) as im:
                w, h = im.size
            for i, rect in enumerate(tiles(w, h)):
                jobs.append((path, rect, f"{entry['id']}_{img_key}_{i}"))
    for entry in m["hidden"]:
        path = entry["image"]
        with Image.open(ASSETS / path) as im:
            w, h = im.size
        for i, rect in enumerate(tiles(w, h)):
            jobs.append((path, rect, f"{entry['id']}_hidden_{i}"))

    print(f"deterministic pair checks done ({len(findings)} flags); judging {len(jobs)} tiles...")
    with ThreadPoolExecutor(max_workers=8) as pool:
        for res in pool.map(judge_tile, jobs):
            if res:
                findings.append(res)
                print(f"  FLAG {res['asset']} tile {res.get('rect')}")

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "artifact_report.json").write_text(json.dumps(findings, indent=2))
    print(f"\n{len(findings)} findings -> {OUT / 'artifact_report.json'}")


if __name__ == "__main__":
    main()
