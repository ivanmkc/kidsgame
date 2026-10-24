"""Artifact detection phase: sweep image tiles from a scan plan for editing artifacts.

Layer 1 (deterministic): a diff pair must be pixel-identical outside its
difference rects (+feather margin) — any violation is a pipeline bug.
Layer 2 (judged): image tiles from a scan plan go through an inverted
artifact-hunt question ("answer YES if you see ANY editing mistake"),
threaded for speed. Flags are saved as crops for human review.

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
ASSETS = ROOT / "assets" / "game"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"
PLAN = ROOT / "tools" / "audit_out" / "scan_plan.json"
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

    path_a = ASSETS / entry["imageA"]
    if not path_a.exists() and (ROOT / entry["imageA"]).exists():
        path_a = ROOT / entry["imageA"]
    path_b = ASSETS / entry["imageB"]
    if not path_b.exists() and (ROOT / entry["imageB"]).exists():
        path_b = ROOT / entry["imageB"]

    a = np.asarray(Image.open(path_a).convert("RGB"), np.int16)
    b = np.asarray(Image.open(path_b).convert("RGB"), np.int16)
    mask = np.zeros(a.shape[:2], bool)
    for d in entry.get("diffs", []):
        y0, y1 = max(0, d["y"] - 6), min(a.shape[0], d["y"] + d["h"] + 6)
        x0, x1 = max(0, d["x"] - 6), min(a.shape[1], d["x"] + d["w"] + 6)
        mask[y0:y1, x0:x1] = True
    outside = np.abs(a - b).sum(-1) > 60  # JPEG noise tolerance
    outside[mask] = False
    frac = float(outside.mean())
    if frac > 0.002:
        asset_path = entry["imageB"]
        if not asset_path.startswith("assets/game/"):
            asset_path = f"assets/game/{asset_path}"
        return [{"asset": asset_path, "kind": "pair-identity",
                 "detail": f"{frac:.3%} of out-of-rect pixels differ"}]
    return []


def judge_tile(args) -> dict | None:
    from gen.judge import ask_yes_no
    from PIL import Image

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


def process_scan_batches(batches: list[list[dict]], max_workers: int = 8) -> list[dict]:
    findings: list[dict] = []
    for batch in batches:
        batch_jobs = []
        for job in batch:
            if isinstance(job, dict) and job.get("asset", {}).get("kind") == "image":
                batch_jobs.append((job["asset"]["path"], tuple(job["rect"]), job["tag"]))
        if batch_jobs:
            print(f"judging {len(batch_jobs)} tiles...")
            with ThreadPoolExecutor(max_workers=max_workers) as pool:
                for res in pool.map(judge_tile, batch_jobs):
                    if res:
                        findings.append(res)
                        print(f"  FLAG {res['asset']} tile {res.get('rect')}")
    return findings


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
        batch_findings = process_scan_batches([batch])
        findings.extend(batch_findings)
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
        if MANIFEST.exists():
            m = json.loads(MANIFEST.read_text(encoding="utf-8"))
            for entry in m.get("diff", []):
                if "imageA" in entry and "imageB" in entry:
                    findings.extend(check_pair_identity(entry))
            print(f"deterministic pair checks done ({len(findings)} flags)")
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
