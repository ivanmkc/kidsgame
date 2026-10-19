"""Tests for artifact_scan.py runner and scan_plan consumption."""

from __future__ import annotations

import json
import sys
import types as pytypes
import importlib.util
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Stub google.genai if not installed in the sandbox environment
has_genai = (
    importlib.util.find_spec("google") is not None
    and importlib.util.find_spec("google.genai") is not None
)

if not has_genai:
    mock_google = pytypes.ModuleType("google")
    mock_genai = pytypes.ModuleType("google.genai")
    mock_types = pytypes.ModuleType("google.genai.types")

    mock_types.Part = MagicMock()
    mock_types.Blob = MagicMock()
    mock_types.Content = MagicMock()

    mock_genai.types = mock_types
    mock_google.genai = mock_genai

    sys.modules["google"] = mock_google
    sys.modules["google.genai"] = mock_genai
    sys.modules["google.genai.types"] = mock_types


from artifact_scan import (
    _resolve_image_path,
    judge_tile,
    load_scan_jobs,
    main,
    scan_artifacts,
)


def _create_test_image(
    path: Path, width: int = 100, height: int = 100, color=(128, 128, 128)
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (width, height), color=color)
    img.save(path)


def test_load_scan_jobs_flattens_batches(tmp_path: Path) -> None:
    plan_file = tmp_path / "scan_plan.json"
    batches = [
        [
            {
                "asset": {"path": "assets/game/spotit/dog.png"},
                "rect": [0, 0, 50, 50],
                "tag": "dog_0",
            },
            {
                "asset": {"path": "assets/game/spotit/cat.png"},
                "rect": [0, 0, 50, 50],
                "tag": "cat_0",
            },
        ],
        [
            {
                "asset": {"path": "assets/game/diff/beach_base.png"},
                "rect": [0, 0, 100, 100],
                "tag": "beach_0",
            },
        ],
    ]
    plan_file.write_text(json.dumps(batches), encoding="utf-8")

    jobs = load_scan_jobs(plan_file)
    assert len(jobs) == 3
    assert [j["tag"] for j in jobs] == ["dog_0", "cat_0", "beach_0"]


def test_load_scan_jobs_missing_file_raises(tmp_path: Path) -> None:
    non_existent = tmp_path / "missing_plan.json"
    try:
        load_scan_jobs(non_existent)
        assert False, "Expected FileNotFoundError"
    except FileNotFoundError as err:
        assert "Scan plan not found" in str(err)


def test_load_scan_jobs_empty_batches(tmp_path: Path) -> None:
    plan_file = tmp_path / "empty_plan.json"
    plan_file.write_text("[]", encoding="utf-8")
    jobs = load_scan_jobs(plan_file)
    assert jobs == []


def test_resolve_image_path(tmp_path: Path) -> None:
    # Absolute path
    abs_path = tmp_path / "img.png"
    assert _resolve_image_path(abs_path) == abs_path

    # Existing repo-relative path
    rel_path = "assets/game/spotit/dog.png"
    resolved = _resolve_image_path(rel_path)
    assert resolved.exists()
    assert resolved.name == "dog.png"


def test_judge_tile_flagged(tmp_path: Path) -> None:
    img_file = tmp_path / "test_scene.png"
    _create_test_image(img_file, 100, 100)

    out_dir = tmp_path / "out"
    job = {
        "asset": {"path": str(img_file), "kind": "scene"},
        "rect": [10, 10, 60, 60],
        "tag": "test_tag_0",
    }

    with (
        patch("artifact_scan.OUT", out_dir),
        patch("gen.judge.ask_yes_no", return_value=True),
    ):
        finding = judge_tile(job)

    assert finding is not None
    assert finding["asset"] == str(img_file)
    assert finding["kind"] == "judged-artifact"
    assert finding["rect"] == [10, 10, 60, 60]
    assert finding["crop"] == "test_tag_0.png"

    crop_path = out_dir / "test_tag_0.png"
    assert crop_path.exists()
    with Image.open(crop_path) as crop:
        assert crop.size == (50, 50)


def test_judge_tile_clean(tmp_path: Path) -> None:
    img_file = tmp_path / "clean_scene.png"
    _create_test_image(img_file, 80, 80)

    out_dir = tmp_path / "out"
    job = {
        "asset": {"path": str(img_file)},
        "rect": [0, 0, 40, 40],
        "tag": "clean_0",
    }

    with (
        patch("artifact_scan.OUT", out_dir),
        patch("gen.judge.ask_yes_no", return_value=False),
    ):
        finding = judge_tile(job)

    assert finding is None
    assert not (out_dir / "clean_0.png").exists()


def test_scan_artifacts_full_run(tmp_path: Path) -> None:
    img_file = tmp_path / "scene.png"
    _create_test_image(img_file, 120, 120)

    out_dir = tmp_path / "audit_out"
    jobs = [
        {
            "asset": {"path": str(img_file)},
            "rect": [0, 0, 60, 60],
            "tag": "scene_tile_0",
        },
        {
            "asset": {"path": str(img_file)},
            "rect": [60, 0, 120, 60],
            "tag": "scene_tile_1",
        },
    ]

    call_count = 0

    def mock_judge(question: str, images: list) -> bool:
        nonlocal call_count
        call_count += 1
        return call_count == 1

    with patch("gen.judge.ask_yes_no", side_effect=mock_judge):
        findings = scan_artifacts(jobs, out_dir=out_dir, max_workers=1)

    assert len(findings) == 1
    assert findings[0]["crop"] == "scene_tile_0.png"

    report_path = out_dir / "artifact_report.json"
    assert report_path.exists()
    saved = json.loads(report_path.read_text(encoding="utf-8"))
    assert len(saved) == 1
    assert saved[0]["crop"] == "scene_tile_0.png"
    assert (out_dir / "scene_tile_0.png").exists()
    assert not (out_dir / "scene_tile_1.png").exists()


def test_main_cli(tmp_path: Path) -> None:
    img_file = tmp_path / "cli_scene.png"
    _create_test_image(img_file, 80, 80)

    plan_file = tmp_path / "scan_plan.json"
    batches = [
        [
            {"asset": {"path": str(img_file)}, "rect": [0, 0, 40, 40], "tag": "cli_0"},
        ]
    ]
    plan_file.write_text(json.dumps(batches), encoding="utf-8")

    out_dir = tmp_path / "cli_out"
    with patch("gen.judge.ask_yes_no", return_value=False):
        main(["--plan", str(plan_file), "--out", str(out_dir), "--workers", "1"])

    report_path = out_dir / "artifact_report.json"
    assert report_path.exists()
    assert json.loads(report_path.read_text(encoding="utf-8")) == []

