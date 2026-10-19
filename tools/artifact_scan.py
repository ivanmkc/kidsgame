"""Artifact detection phase: sweep every shipped scene for editing artifacts.

Reads scan jobs from tools/audit_out/scan_plan.json. Overlapping tiles of every
scene image go through an inverted artifact-hunt question ("answer YES if you
see ANY editing mistake"), threaded for speed. Flags are saved as crops for
human review.

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
DEFAULT_PLAN = ROOT / "tools" / "audit_out" / "scan_plan.json"
OUT = ROOT / "tools" / "audit_out" / "artifact_scan"

ARTIFACT_Q = (
    "You are inspecting one region of a children's book illustration for "
    "EDITING MISTAKES. Answer YES if you see ANY of: a pale or white "
    "rectangular patch, an erased-looking smear, a blurry spot unlike the "
    "rest, a half-drawn or cut-off object, a hard rectangular seam, or a "
    "style clash. Answer NO if the region looks cleanly illustrated."
)


def _resolve_image_path(path: str | Path) -> Path:
    p = Path(path)
    if p.is_absolute():
        return p
    return ROOT / p



def load_scan_jobs(plan_path: Path = DEFAULT_PLAN) -> list[dict]:
    """Load and flatten batch lists of ScanJob dicts from scan_plan.json."""
    if not plan_path.exists():
        raise FileNotFoundError(f"Scan plan not found: {plan_path}")
    batches = json.loads(plan_path.read_text())
    jobs: list[dict] = []
    for batch in batches:
        if isinstance(batch, list):
            jobs.extend(batch)
        elif isinstance(batch, dict):
            jobs.append(batch)
    return jobs


def judge_tile(job: dict) -> dict | None:
    from gen.judge import ask_yes_no
    from PIL import Image

    asset = job["asset"]
    path = asset["path"]
    rect = tuple(job["rect"])
    tag = job["tag"]

    img_path = _resolve_image_path(path)
    img = Image.open(img_path).convert("RGB")
    crop = img.crop(rect)
    if ask_yes_no(ARTIFACT_Q, [crop]):
        OUT.mkdir(parents=True, exist_ok=True)
        crop_name = f"{tag}.png"
        crop.save(OUT / crop_name)
        return {
            "asset": path,
            "kind": "judged-artifact",
            "rect": list(rect),
            "crop": crop_name,
        }
    return None


def scan_artifacts(
    jobs: list[dict],
    out_dir: Path = OUT,
    max_workers: int = 8,
) -> list[dict]:
    global OUT
    OUT = out_dir

    findings: list[dict] = []
    print(f"judging {len(jobs)} tiles...")
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        for res in pool.map(judge_tile, jobs):
            if res:
                findings.append(res)
                print(f"  FLAG {res['asset']} tile {res.get('rect')}")

    out_dir.mkdir(parents=True, exist_ok=True)
    report_path = out_dir / "artifact_report.json"
    report_path.write_text(json.dumps(findings, indent=2))
    return findings


def main(argv: list[str] | None = None) -> None:
    global OUT

    parser = argparse.ArgumentParser(
        description="Sweep shipped scenes for editing artifacts."
    )
    parser.add_argument(
        "--plan",
        type=Path,
        default=DEFAULT_PLAN,
        metavar="FILE",
        help="scan plan path (default: %(default)s)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=OUT,
        metavar="DIR",
        help="output directory (default: %(default)s)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=8,
        help="number of parallel workers (default: %(default)s)",
    )
    args = parser.parse_args(argv)
    OUT = args.out

    jobs = load_scan_jobs(args.plan)
    findings = scan_artifacts(jobs, out_dir=OUT, max_workers=args.workers)

    report_path = OUT / "artifact_report.json"
    try:
        report_display = report_path.resolve().relative_to(ROOT.resolve())
    except ValueError:
        report_display = report_path
    print(f"\n{len(findings)} findings -> {report_display}")


if __name__ == "__main__":
    main()
