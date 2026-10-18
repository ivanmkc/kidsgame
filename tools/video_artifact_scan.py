"""Runner to sample frames from story videos and run them through the dual judge.

Lists public video assets from tools/review/inventory.ts, selects representative
frames via tools/review/videoFrames.ts, extracts them via ffmpeg into a temporary
directory, evaluates them with the dual judge, persists flagged evidence frames,
and writes findings to video_findings.json.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from artifact_loop.judge import judge_image

ROOT = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class MediaAsset:
    path: str
    kind: str
    game: str
    group: str
    ledger_clean: bool


def _run_ts_helper(
    cmd: str,
    args: list[str] | None = None,
    stdin_input: str | None = None,
) -> str:
    jiti = ROOT / "node_modules" / ".bin" / "jiti"
    helper = ROOT / "tools" / "review" / "videoHelper.ts"
    cli_args = [str(jiti), str(helper), cmd] + (args or [])
    proc = subprocess.run(
        cli_args,
        input=stdin_input,
        capture_output=True,
        text=True,
        check=True,
        cwd=str(ROOT),
    )
    return proc.stdout.strip()


def list_public_video_assets(root: Path = ROOT) -> list[MediaAsset]:
    """List all public video assets from tools/review/inventory.ts."""
    out = _run_ts_helper("inventory", [str(root)])
    raw = json.loads(out)
    return [
        MediaAsset(
            path=item["path"],
            kind=item["kind"],
            game=item["game"],
            group=item["group"],
            ledger_clean=item["ledgerClean"],
        )
        for item in raw
    ]


def select_video_frames(
    frame_count: int,
    fps: float,
    diff_scores: list[float] | None = None,
    threshold: float = 0.3,
    min_gap_sec: float = 0.5,
    max_frames: int = 8,
) -> tuple[list[int], str]:
    """Select representative frames using tools/review/videoFrames.ts."""
    options: dict[str, object] = {
        "frameCount": frame_count,
        "fps": fps,
        "threshold": threshold,
        "minGapSec": min_gap_sec,
        "maxFrames": max_frames,
    }
    if diff_scores is not None:
        options["diffScores"] = diff_scores
    out = _run_ts_helper("select-frames", stdin_input=json.dumps(options))
    data = json.loads(out)
    return data["frames"], data["expr"]


def is_git_lfs_pointer(file_path: Path) -> bool:
    with open(file_path, "rb") as fp:
        header = fp.read(100)
        return header.startswith(b"version https://git-lfs.github.com/spec/v1")


def get_video_info(video_path: Path) -> tuple[int, float]:
    """Inspect video with ffprobe, returning (frame_count, fps)."""
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=nb_frames,r_frame_rate,duration",
        "-of",
        "json",
        str(video_path),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
    info = json.loads(proc.stdout)
    streams = info.get("streams", [])
    if not streams:
        raise ValueError(f"No video streams found in {video_path}")
    st = streams[0]
    r_fps = st.get("r_frame_rate", "30/1")
    if "/" in r_fps:
        num, den = r_fps.split("/", 1)
        fps = float(num) / float(den) if float(den) != 0 else 30.0
    else:
        fps = float(r_fps) if r_fps else 30.0

    nb_frames = st.get("nb_frames")
    if nb_frames and nb_frames.isdigit() and int(nb_frames) > 0:
        frame_count = int(nb_frames)
    else:
        duration = float(st.get("duration", 0))
        if duration > 0:
            frame_count = max(1, round(duration * fps))
        else:
            raise ValueError(f"Could not determine frame count for {video_path}")

    return frame_count, fps


def compute_diff_scores(video_path: Path) -> list[float]:
    """Compute frame-to-frame scene difference scores using ffprobe."""
    escaped_path = video_path.as_posix().replace("'", r"\'")
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_frames",
        "-show_entries",
        "frame_tags=lavfi.scene_score",
        "-of",
        "json",
        "-f",
        "lavfi",
        f"movie='{escaped_path}',select=gte(scene\\,0)",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
    data = json.loads(proc.stdout)
    scores: list[float] = []
    for f in data.get("frames", []):
        score_val = f.get("tags", {}).get("lavfi.scene_score", "0")
        scores.append(float(score_val))
    return scores


def extract_frames(
    video_path: Path,
    dest_dir: Path,
    diff_scores: list[float] | None = None,
    max_frames: int = 8,
) -> list[tuple[int, Path, float]]:
    """Extract representative frames using videoFrames.ts to dest_dir.

    Returns list of (frame_number, frame_path, fps).
    """
    dest_dir.mkdir(parents=True, exist_ok=True)
    frame_count, fps = get_video_info(video_path)
    if diff_scores is None:
        diff_scores = compute_diff_scores(video_path)

    frames, select_expr = select_video_frames(
        frame_count=frame_count,
        fps=fps,
        diff_scores=diff_scores,
        max_frames=max_frames,
    )
    if not frames:
        return []

    out_pattern = str(dest_dir / "f_%d.png")
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(video_path),
            "-vf",
            f"select='{select_expr}'",
            "-vsync",
            "vfr",
            out_pattern,
        ],
        check=True,
    )

    results: list[tuple[int, Path, float]] = []
    for idx, fnum in enumerate(frames, start=1):
        fpath = dest_dir / f"f_{idx}.png"
        if fpath.exists():
            results.append((fnum, fpath, fps))
    return results


def scan_video_artifacts(
    assets: list[MediaAsset] | None = None,
    output_path: Path | str = "video_findings.json",
    root: Path = ROOT,
    max_frames: int = 8,
    max_workers: int = 4,
) -> list[dict]:
    """Scan video assets: sample frames, judge them, and write findings JSON."""
    out_file = Path(output_path)
    evidence_dir = out_file.parent / f"{out_file.name}.frames"

    if assets is None:
        assets = list_public_video_assets(root)

    findings: list[dict] = []
    with tempfile.TemporaryDirectory() as td:
        temp_dir = Path(td)
        tasks: list[tuple[MediaAsset, int, Path, float]] = []

        for idx, asset in enumerate(assets):
            if asset.ledger_clean:
                continue
            video_file = root / asset.path
            if not video_file.is_file():
                raise FileNotFoundError(f"Video file not found: {video_file}")
            if is_git_lfs_pointer(video_file):
                raise RuntimeError(
                    f"Video asset is an unpulled Git LFS pointer: {video_file}. "
                    "Run 'git lfs pull' to check it out."
                )

            asset_dir = temp_dir / f"video_{idx}"
            extracted = extract_frames(
                video_file, asset_dir, max_frames=max_frames
            )
            for fnum, fpath, fps in extracted:
                tasks.append((asset, fnum, fpath, fps))

        def judge_task(item: tuple[MediaAsset, int, Path, float]) -> list[dict]:
            asset, fnum, fpath, fps = item
            surface_id = f"{asset.path}:{fnum}"
            raw = judge_image(surface_id, str(fpath))
            if not raw:
                return []

            # Findings detected: persist evidence frame next to output JSON
            evidence_dir.mkdir(parents=True, exist_ok=True)
            video_prefix = (
                str(Path(asset.path).with_suffix(""))
                .replace("/", "_")
                .replace("\\", "_")
            )
            persisted_filename = f"{video_prefix}_f{fnum}.png"
            persisted_path = evidence_dir / persisted_filename
            shutil.copy2(str(fpath), str(persisted_path))
            rel_screenshot = f"{out_file.name}.frames/{persisted_filename}"

            out = []
            for item_finding in raw:
                f = dict(item_finding)
                f.setdefault("surface", surface_id)
                f["owning_asset"] = asset.path
                f["frame"] = fnum
                f["frame_time"] = round(fnum / fps, 3)
                f["screenshot"] = rel_screenshot
                out.append(f)
            return out

        if max_workers > 1 and len(tasks) > 1:
            with ThreadPoolExecutor(max_workers=max_workers) as pool:
                for res in pool.map(judge_task, tasks):
                    findings.extend(res)
        else:
            for t in tasks:
                findings.extend(judge_task(t))

    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(findings, indent=2), encoding="utf-8")
    return findings


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sample frames from public videos and judge for artifacts"
    )
    parser.add_argument(
        "-o",
        "--output",
        default="video_findings.json",
        help="Path to output findings JSON",
    )
    parser.add_argument(
        "-w",
        "--workers",
        type=int,
        default=4,
        help="Concurrency workers for judge calls",
    )
    parser.add_argument(
        "--max-frames",
        type=int,
        default=8,
        help="Maximum frames per video",
    )
    parser.add_argument(
        "--filter",
        type=str,
        default=None,
        help="Substring filter for video asset paths",
    )
    args = parser.parse_args()

    assets = list_public_video_assets(ROOT)
    if args.filter:
        assets = [a for a in assets if args.filter in a.path]

    print(f"Scanning {len(assets)} video asset(s)...")
    findings = scan_video_artifacts(
        assets=assets,
        output_path=args.output,
        root=ROOT,
        max_frames=args.max_frames,
        max_workers=args.workers,
    )
    print(f"{len(findings)} findings -> {args.output}")


if __name__ == "__main__":
    main()
