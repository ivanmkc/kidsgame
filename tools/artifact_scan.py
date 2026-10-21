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

from batch_executor import BatchExecutor

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


def compute_asset_fingerprint_seed(plan: list, root: Path) -> str:
    import hashlib

    seen_paths: set[str] = set()
    for batch in plan:
        for job in batch:
            if isinstance(job, dict) and job.get("asset", {}).get("kind") == "image":
                path_str = job.get("asset", {}).get("path")
                if path_str:
                    seen_paths.add(path_str)

    entries: list[tuple[str, int, int]] = []
    for path_str in sorted(seen_paths):
        file = root / path_str
        if file.exists():
            st = file.stat()
            entries.append((path_str, st.st_size, st.st_mtime_ns))
        else:
            entries.append((path_str, -1, -1))
    return hashlib.sha256(json.dumps(entries).encode("utf-8")).hexdigest()


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
    parser.add_argument(
        "--state",
        type=Path,
        default=None,
        metavar="FILE",
        help="path to batch state file (default: <out>/scan_state.json)",
    )
    args = parser.parse_args(argv)
    OUT = args.out

    OUT.mkdir(parents=True, exist_ok=True)
    report_path = OUT / "artifact_report.json"
    state_file = args.state or (OUT / "scan_state.json")

    findings: list[dict] = []

    def process_batch(batch: list[dict]) -> None:
        batch_jobs = []
        for job in batch:
            if job.get("asset", {}).get("kind") == "image":
                batch_jobs.append((job["asset"]["path"], tuple(job["rect"]), job["tag"]))
        if batch_jobs:
            print(f"judging {len(batch_jobs)} tiles...")
            with ThreadPoolExecutor(max_workers=8) as pool:
                for res in pool.map(judge_tile, batch_jobs):
                    if res:
                        findings.append(res)
                        print(f"  FLAG {res['asset']} tile {res.get('rect')}")
        report_path.write_text(json.dumps(findings, indent=2), encoding="utf-8")

    plan_data = json.loads(args.plan.read_text(encoding="utf-8"))
    asset_seed = compute_asset_fingerprint_seed(plan_data, ROOT)
    executor = BatchExecutor(
        args.plan,
        state_file,
        process_batch,
        fingerprint_seed=asset_seed,
    )
    completed_index = executor.get_completed_index()
    if completed_index >= 0:
        findings = json.loads(report_path.read_text(encoding="utf-8"))
        resume_batch = completed_index + 1
        if resume_batch > 0:
            print(f"resuming at batch {resume_batch} of {len(executor.plan)}")
    else:
        report_path.write_text(json.dumps(findings, indent=2), encoding="utf-8")

    executor.execute()
    state_file.unlink(missing_ok=True)

    report_path.write_text(json.dumps(findings, indent=2), encoding="utf-8")
    try:
        report_display = report_path.resolve().relative_to(ROOT.resolve())
    except ValueError:
        report_display = report_path
    print(f"\n{len(findings)} findings -> {report_display}")


if __name__ == "__main__":
    main()
