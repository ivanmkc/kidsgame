"""Artifact detection phase: sweep image tiles from a scan plan for editing artifacts.

Overlapping tiles of every image go through an inverted artifact-hunt question
("answer YES if you see ANY editing mistake"), threaded for speed. Flags are saved
as crops for human review.

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
PLAN = ROOT / "tools" / "audit_out" / "scan_plan.json"
OUT = ROOT / "tools" / "audit_out" / "artifact_scan"

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


def judge_tile(args) -> dict | None:
    from PIL import Image
    from gen.judge import ask_yes_no

    path, rect, tag = args
    img = Image.open(ROOT / path).convert("RGB")
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
        description="Sweep image tiles from a scan plan for editing artifacts."
    )
    parser.add_argument(
        "--plan",
        type=Path,
        default=PLAN,
        metavar="FILE",
        help="path to scan plan JSON (default: %(default)s)",
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

    plan = json.loads(args.plan.read_text())
    jobs = []
    for batch in plan:
        for job in batch:
            if job.get("asset", {}).get("kind") == "image":
                jobs.append((job["asset"]["path"], tuple(job["rect"]), job["tag"]))

    findings: list[dict] = []
    print(f"judging {len(jobs)} tiles...")
    with ThreadPoolExecutor(max_workers=8) as pool:
        for res in pool.map(judge_tile, jobs):
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
