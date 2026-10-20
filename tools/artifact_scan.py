"""Artifact detection phase: sweep every shipped scene for editing artifacts.

Layer 1 (deterministic): a diff pair must be pixel-identical outside its
difference rects (+feather margin) — any violation is a pipeline bug.
Layer 2 (judged): overlapping tiles of every scene image from scan_plan.json
go through an inverted artifact-hunt question ("answer YES if you see ANY
editing mistake"), threaded for speed. Flags are saved as crops for human review.

Output: tools/audit_out/artifact_scan/artifact_report.json + flagged crop PNGs.
"""

from __future__ import annotations

import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets" / "game"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"
OUT = ROOT / "tools" / "audit_out" / "artifact_scan"

ARTIFACT_Q = (
    "You are inspecting one region of a children's book illustration for "
    "EDITING MISTAKES. Answer YES if you see ANY of: a pale or white "
    "rectangular patch, an erased-looking smear, a blurry spot unlike the "
    "rest, a half-drawn or cut-off object, a hard rectangular seam, or a "
    "style clash. Answer NO if the region looks cleanly illustrated."
)


def check_pair_identity(entry: dict) -> list[dict]:
    """Outside the diff rects (+6px feather margin), A and B must match."""
    import numpy as np
    from PIL import Image

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


def judge_tile(job: dict) -> dict | None:
    from PIL import Image
    from gen.judge import ask_yes_no

    asset = job["asset"]
    path = asset["path"] if isinstance(asset, dict) else str(asset)
    rect = job["rect"]
    tag = job["tag"]

    img_path = ROOT / path
    img = Image.open(img_path).convert("RGB")
    crop = img.crop(rect)
    if ask_yes_no(ARTIFACT_Q, [crop]):
        OUT.mkdir(parents=True, exist_ok=True)
        crop_name = f"{tag}.png"
        crop.save(OUT / crop_name)
        return {"asset": path, "kind": "judged-artifact",
                "rect": list(rect), "crop": crop_name}
    return None


def main(argv: list[str] | None = None) -> None:
    global OUT

    parser = argparse.ArgumentParser(
        description="Sweep shipped scenes for editing artifacts."
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=OUT,
        metavar="DIR",
        help="output directory (default: %(default)s)",
    )
    args = parser.parse_args(argv)
    OUT = args.out

    m = json.loads(MANIFEST.read_text())
    findings: list[dict] = []

    for entry in m["diff"]:
        findings.extend(check_pair_identity(entry))

    plan_path = OUT.parent / "scan_plan.json"
    plan = json.loads(plan_path.read_text())

    total_jobs = sum(len(b) if isinstance(b, list) else 1 for b in plan)
    print(f"pair checks done ({len(findings)} flags); judging {total_jobs} tiles across {len(plan)} batches...")
    with ThreadPoolExecutor(max_workers=8) as pool:
        for batch in plan:
            batch_jobs = batch if isinstance(batch, list) else [batch]
            for res in pool.map(judge_tile, batch_jobs):
                if res:
                    findings.append(res)
                    print(f"  FLAG {res['asset']} tile {res.get('rect')}")

    OUT.mkdir(parents=True, exist_ok=True)
    report_path = OUT / "artifact_report.json"
    report_path.write_text(json.dumps(findings, indent=2))
    try:
        report_display = report_path.resolve().relative_to(ROOT.resolve())
    except ValueError:
        report_display = report_path
    print(f"\n{len(findings)} findings -> {report_display}")


if __name__ == "__main__":
    main()
