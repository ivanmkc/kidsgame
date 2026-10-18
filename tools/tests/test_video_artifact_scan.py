"""Tests for video_artifact_scan.py runner and frame-selection logic."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from video_artifact_scan import (
    MediaAsset,
    compute_diff_scores,
    extract_frames,
    get_video_info,
    is_git_lfs_pointer,
    list_public_video_assets,
    scan_video_artifacts,
    select_video_frames,
)


def _make_sample_video(path: Path, duration_sec: int = 1, fps: int = 30) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"testsrc=duration={duration_sec}:size=160x120:rate={fps}",
            str(path),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def _make_transition_video(path: Path) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=red:duration=0.5:size=160x120:rate=30",
            "-f",
            "lavfi",
            "-i",
            "color=c=blue:duration=0.5:size=160x120:rate=30",
            "-filter_complex",
            "[0:v][1:v]concat=n=2:v=1[v]",
            "-map",
            "[v]",
            str(path),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def test_media_asset_and_inventory(tmp_path: Path) -> None:
    pub = tmp_path / "public" / "story-video"
    pub.mkdir(parents=True)
    (pub / "luna_start_0.mp4").write_bytes(b"dummy")
    (pub / "rex_scene_1.webm").write_bytes(b"dummy")
    (pub / "notes.txt").write_bytes(b"dummy")

    tools_dir = tmp_path / "tools"
    tools_dir.mkdir(parents=True)
    (tools_dir / "quality_ledger.json").write_text(
        json.dumps({"clean": ["luna"]}), encoding="utf-8"
    )

    assets = list_public_video_assets(tmp_path)
    assert len(assets) == 2

    luna = next(a for a in assets if "luna" in a.path)
    assert luna.path == "public/story-video/luna_start_0.mp4"
    assert luna.kind == "video"
    assert luna.game == "story-video"
    assert luna.group == "luna"
    assert luna.ledger_clean is True

    rex = next(a for a in assets if "rex" in a.path)
    assert rex.path == "public/story-video/rex_scene_1.webm"
    assert rex.kind == "video"
    assert rex.group == "rex"
    assert rex.ledger_clean is False


def test_inventory_fails_loudly_on_corrupt_ledger(tmp_path: Path) -> None:
    tools_dir = tmp_path / "tools"
    tools_dir.mkdir(parents=True)
    (tools_dir / "quality_ledger.json").write_text(
        '{"clean": "not-a-list"}', encoding="utf-8"
    )
    with pytest.raises(subprocess.CalledProcessError):
        list_public_video_assets(tmp_path)


def test_frame_selection_delegation() -> None:
    frames, expr = select_video_frames(120, 30.0)
    assert frames == [0, 60, 119]
    assert expr == "eq(n\\,0)+eq(n\\,60)+eq(n\\,119)"

    frames, expr = select_video_frames(1, 30.0)
    assert frames == [0]
    assert expr == "eq(n\\,0)"

    diffs = [0.0] * 120
    diffs[20] = 0.95
    diffs[40] = 0.70
    diffs[80] = 0.85
    diffs[100] = 0.60
    selected, _ = select_video_frames(120, 30.0, diff_scores=diffs, max_frames=5)
    assert selected == [0, 20, 60, 80, 119]


def test_get_video_info_and_extract_frames(tmp_path: Path) -> None:
    video_path = tmp_path / "test.mp4"
    _make_sample_video(video_path, duration_sec=1, fps=30)

    frame_count, fps = get_video_info(video_path)
    assert frame_count == 30
    assert fps == 30.0

    frames_dir = tmp_path / "frames"
    extracted = extract_frames(video_path, frames_dir)
    assert len(extracted) == 3
    # Anchors for 30 frames: 0, 15, 29
    fnums = [fnum for fnum, _, _ in extracted]
    assert fnums == [0, 15, 29]
    for _, fpath, _ in extracted:
        assert fpath.exists()
        assert fpath.stat().st_size > 0


def test_compute_diff_scores_and_scene_detection(tmp_path: Path) -> None:
    video_path = tmp_path / "cut,scene.mp4"
    _make_transition_video(video_path)

    scores = compute_diff_scores(video_path)
    assert len(scores) == 30
    assert scores[15] > 0.3

    frames_dir = tmp_path / "frames"
    extracted = extract_frames(video_path, frames_dir)
    fnums = [fnum for fnum, _, _ in extracted]
    # Frame 15 has the scene transition and is selected
    assert 15 in fnums


def test_compute_diff_scores_fails_loudly_on_non_numeric(tmp_path: Path) -> None:
    video_path = tmp_path / "dummy.mp4"
    fake_output = json.dumps(
        {"frames": [{"tags": {"lavfi.scene_score": "not-a-number"}}]}
    )
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = subprocess.CompletedProcess(
            args=[], returncode=0, stdout=fake_output, stderr=""
        )
        with pytest.raises(ValueError):
            compute_diff_scores(video_path)


def test_lfs_pointer_detection(tmp_path: Path) -> None:
    lfs_file = tmp_path / "lfs.mp4"
    lfs_file.write_text(
        "version https://git-lfs.github.com/spec/v1\n"
        "oid sha256:1234567890abcdef\n"
        "size 12345\n",
        encoding="utf-8",
    )
    assert is_git_lfs_pointer(lfs_file) is True

    normal_file = tmp_path / "normal.mp4"
    normal_file.write_bytes(b"\x00\x00\x00\x18ftypisom")
    assert is_git_lfs_pointer(normal_file) is False

    with pytest.raises(OSError):
        is_git_lfs_pointer(tmp_path / "nonexistent.mp4")


def test_scan_video_artifacts_with_mocked_judge_and_persisted_evidence(
    tmp_path: Path,
) -> None:
    root = tmp_path / "repo"
    pub = root / "public" / "story-video"
    pub.mkdir(parents=True)

    video_path = pub / "clip.mp4"
    _make_sample_video(video_path, duration_sec=1, fps=30)

    asset = MediaAsset(
        path="public/story-video/clip.mp4",
        kind="video",
        game="story-video",
        group="clip",
        ledger_clean=False,
    )

    def mock_judge(surface_id: str, screenshot_path: str) -> list[dict]:
        if ":15" in surface_id:
            return [
                {
                    "class": "rectangular_seam",
                    "where": "middle frame seam",
                    "severity": 2,
                    "description": "visible artifact on frame 15",
                    "source": "judge_a",
                }
            ]
        return []

    output_path = tmp_path / "video_findings.json"
    with patch("video_artifact_scan.judge_image", side_effect=mock_judge):
        findings = scan_video_artifacts(
            assets=[asset],
            output_path=output_path,
            root=root,
            max_workers=1,
        )

    assert len(findings) == 1
    finding = findings[0]
    assert finding["owning_asset"] == "public/story-video/clip.mp4"
    assert "video" not in finding
    assert "asset" not in finding
    assert finding["frame"] == 15
    assert finding["frame_time"] == 0.5
    assert finding["class"] == "rectangular_seam"
    assert finding["severity"] == 2

    # Evidence screenshot must be persisted next to output JSON and exist
    persisted_evidence = output_path.parent / finding["screenshot"]
    assert persisted_evidence.exists()
    assert persisted_evidence.stat().st_size > 0
    assert persisted_evidence.name == "public_story-video_clip_f15.png"

    # Verify output JSON file was written
    assert output_path.exists()
    saved = json.loads(output_path.read_text(encoding="utf-8"))
    assert saved == findings


def test_scan_video_artifacts_fails_loudly_on_lfs_pointer(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    pub = root / "public" / "story-video"
    pub.mkdir(parents=True)

    lfs_file = pub / "lfs.mp4"
    lfs_file.write_text(
        "version https://git-lfs.github.com/spec/v1\n"
        "oid sha256:1234567890abcdef\n"
        "size 12345\n",
        encoding="utf-8",
    )
    asset = MediaAsset(
        path="public/story-video/lfs.mp4",
        kind="video",
        game="story-video",
        group="lfs",
        ledger_clean=False,
    )
    with pytest.raises(RuntimeError, match="unpulled Git LFS pointer"):
        scan_video_artifacts(
            assets=[asset],
            output_path=tmp_path / "findings.json",
            root=root,
        )


def test_scan_video_artifacts_fails_loudly_on_missing_file(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    pub = root / "public" / "story-video"
    pub.mkdir(parents=True)

    asset = MediaAsset(
        path="public/story-video/missing.mp4",
        kind="video",
        game="story-video",
        group="missing",
        ledger_clean=False,
    )
    with pytest.raises(FileNotFoundError, match="Video file not found"):
        scan_video_artifacts(
            assets=[asset],
            output_path=tmp_path / "findings.json",
            root=root,
        )


def test_scan_video_artifacts_skips_clean(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    pub = root / "public" / "story-video"
    pub.mkdir(parents=True)

    video_path = pub / "clean.mp4"
    _make_sample_video(video_path, duration_sec=1, fps=30)

    asset = MediaAsset(
        path="public/story-video/clean.mp4",
        kind="video",
        game="story-video",
        group="clean",
        ledger_clean=True,
    )

    output_path = tmp_path / "video_findings.json"
    with patch("video_artifact_scan.judge_image") as mock_judge:
        findings = scan_video_artifacts(
            assets=[asset],
            output_path=output_path,
            root=root,
            max_workers=1,
        )

    mock_judge.assert_not_called()
    assert findings == []
    assert output_path.exists()
    assert json.loads(output_path.read_text(encoding="utf-8")) == []


def test_scan_video_artifacts_unclean_judged_clean(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    pub = root / "public" / "story-video"
    pub.mkdir(parents=True)

    video_path = pub / "unclean.mp4"
    _make_sample_video(video_path, duration_sec=1, fps=30)

    asset = MediaAsset(
        path="public/story-video/unclean.mp4",
        kind="video",
        game="story-video",
        group="unclean",
        ledger_clean=False,
    )

    output_path = tmp_path / "video_findings.json"
    with patch("video_artifact_scan.judge_image", return_value=[]) as mock_judge:
        findings = scan_video_artifacts(
            assets=[asset],
            output_path=output_path,
            root=root,
            max_workers=1,
        )

    mock_judge.assert_called()
    assert findings == []
    assert output_path.exists()
    assert json.loads(output_path.read_text(encoding="utf-8")) == []


def test_scan_video_artifacts_fails_loudly_on_extraction_error(
    tmp_path: Path,
) -> None:
    root = tmp_path / "repo"
    pub = root / "public" / "story-video"
    pub.mkdir(parents=True)

    # Write an invalid video file that is NOT an LFS pointer
    video_path = pub / "corrupt.mp4"
    video_path.write_bytes(b"\x00\x00\x00\x18corrupt_header_bytes")

    asset = MediaAsset(
        path="public/story-video/corrupt.mp4",
        kind="video",
        game="story-video",
        group="corrupt",
        ledger_clean=False,
    )

    output_path = tmp_path / "video_findings.json"
    with pytest.raises(subprocess.CalledProcessError):
        scan_video_artifacts(
            assets=[asset],
            output_path=output_path,
            root=root,
            max_workers=1,
        )
