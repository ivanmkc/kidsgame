import importlib.util
import json
import sys
import types as pytypes
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

# Ensure tools dir is in sys.path so we can import artifact_scan and gen.judge
sys.path.insert(0, str(Path(__file__).parent.parent))

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

import artifact_scan
from batch_executor import BatchExecutor


def test_check_pair_identity(tmp_path):
    assets_dir = tmp_path / "assets" / "game"
    assets_dir.mkdir(parents=True)
    img_a_path = assets_dir / "diff_a.png"
    img_b_path = assets_dir / "diff_b.png"

    Image.new("RGB", (100, 100), color=(128, 128, 128)).save(img_a_path)
    Image.new("RGB", (100, 100), color=(128, 128, 128)).save(img_b_path)

    entry = {
        "id": "test_diff",
        "imageA": "diff_a.png",
        "imageB": "diff_b.png",
        "diffs": [{"x": 10, "y": 10, "w": 20, "h": 20}],
    }
    with patch("artifact_scan.ROOT", tmp_path), patch("artifact_scan.ASSETS", assets_dir):
        # Perfect match outside diffs -> no findings
        assert artifact_scan.check_pair_identity(entry) == []

        # Mismatch outside diffs -> flag finding with repo-relative path prepended
        diff_b = Image.new("RGB", (100, 100), color=(0, 255, 0))
        diff_b.save(img_b_path)
        findings = artifact_scan.check_pair_identity(entry)
        assert len(findings) == 1
        assert findings[0]["asset"] == "assets/game/diff_b.png"
        assert findings[0]["kind"] == "pair-identity"
        assert "differ" in findings[0]["detail"]

        # Already repo-relative path in imageB is not double-prefixed
        entry_repo_rel = {
            "id": "test_diff",
            "imageA": "diff_a.png",
            "imageB": "assets/game/diff_b.png",
            "diffs": [{"x": 10, "y": 10, "w": 20, "h": 20}],
        }
        findings_rel = artifact_scan.check_pair_identity(entry_repo_rel)
        assert len(findings_rel) == 1
        assert findings_rel[0]["asset"] == "assets/game/diff_b.png"


def test_process_scan_batches(tmp_path):
    assets_dir = tmp_path / "assets"
    assets_dir.mkdir()
    img_path = assets_dir / "item.png"
    Image.new("RGB", (100, 100), color=(10, 20, 30)).save(img_path)

    batches = [
        [
            {
                "asset": {"path": "assets/item.png", "kind": "image"},
                "rect": [0, 0, 50, 50],
                "tag": "item_tile_0",
            },
            {
                "asset": {"path": "audio.mp3", "kind": "audio"},
                "rect": [0, 0, 0, 0],
                "tag": "ignored",
            },
        ],
        [
            {
                "asset": {"path": "assets/item.png", "kind": "image"},
                "rect": [50, 50, 100, 100],
                "tag": "item_tile_1",
            }
        ],
    ]

    calls = []

    def fake_judge(q, crops, attempts=3):
        calls.append(crops)
        # Flag only the second image crop
        return len(calls) == 2

    out_dir = tmp_path / "out"
    with patch("artifact_scan.ROOT", tmp_path), \
         patch("artifact_scan.OUT", out_dir), \
         patch("gen.judge.ask_yes_no", side_effect=fake_judge):
        findings = artifact_scan.process_scan_batches(batches, max_workers=2)

    assert len(findings) == 1
    assert findings[0]["asset"] == "assets/item.png"
    assert findings[0]["kind"] == "judged-artifact"
    assert findings[0]["crop"] == "item_tile_1.png"
    assert (out_dir / "item_tile_1.png").exists()


def test_main(tmp_path):
    assets_dir = tmp_path / "assets"
    assets_dir.mkdir()
    game_assets_dir = tmp_path / "assets" / "game"
    game_assets_dir.mkdir(parents=True)
    out_dir = tmp_path / "out"
    plan_file = tmp_path / "scan_plan.json"
    manifest_file = tmp_path / "manifest.json"

    # Create dummy diff pair in manifest for deterministic check
    diff_a_path = game_assets_dir / "diff_a.png"
    diff_b_path = game_assets_dir / "diff_b.png"
    Image.new("RGB", (100, 100), color=(255, 0, 0)).save(diff_a_path)
    Image.new("RGB", (100, 100), color=(0, 255, 0)).save(diff_b_path)

    manifest_data = {
        "diff": [
            {
                "id": "diff1",
                "imageA": "diff_a.png",
                "imageB": "diff_b.png",
                "diffs": [{"x": 10, "y": 10, "w": 20, "h": 20}],
            }
        ]
    }
    manifest_file.write_text(json.dumps(manifest_data))

    # Create dummy images for scan plan
    img_a_path = assets_dir / "a.png"
    img_b_path = assets_dir / "b.png"

    img_a = Image.new("RGB", (100, 100), color=(255, 0, 0))
    # Draw a single blue pixel at (10, 10), which will be picked up during judge_tile.
    img_a.putpixel((10, 10), (0, 0, 255))
    img_a.save(img_a_path)

    Image.new("RGB", (100, 100), color=(255, 0, 0)).save(img_b_path)

    plan_data = [
        [
            {
                "asset": {
                    "path": "assets/a.png",
                    "kind": "image",
                    "width": 100,
                    "height": 100,
                },
                "rect": [0, 0, 50, 50],
                "tag": "a_tile_0",
            },
            {
                "asset": {
                    "path": "dummy.mp4",
                    "kind": "video",
                    "width": 100,
                    "height": 100,
                },
                "rect": [0, 0, 100, 100],
                "tag": "vid_tile_0",
            },
        ],
        [
            {
                "asset": {
                    "path": "assets/b.png",
                    "kind": "image",
                    "width": 100,
                    "height": 100,
                },
                "rect": [0, 0, 50, 50],
                "tag": "b_tile_0",
            }
        ],
    ]
    plan_file.write_text(json.dumps(plan_data))

    def mock_ask_yes_no(q, crops, attempts=3):
        # crops[0] is the PIL Image of the crop
        # Check if it has the blue pixel to simulate returning True for a specific tile
        colors = crops[0].getcolors(maxcolors=1024)
        if colors:
            for count, color in colors:
                if color == (0, 0, 255):
                    return True
        return False

    with patch("artifact_scan.ROOT", tmp_path), \
         patch("artifact_scan.ASSETS", game_assets_dir), \
         patch("artifact_scan.MANIFEST", manifest_file), \
         patch("artifact_scan.PLAN", plan_file), \
         patch("gen.judge.ask_yes_no", side_effect=mock_ask_yes_no):

        artifact_scan.main(["--plan", str(plan_file), "--out", str(out_dir)])

    report_path = out_dir / "artifact_report.json"
    assert report_path.exists()
    findings = json.loads(report_path.read_text())

    assert len(findings) == 2

    # Deterministic pair-identity finding
    pair_finding = findings[0]
    assert pair_finding["kind"] == "pair-identity"
    assert pair_finding["asset"] == "assets/game/diff_b.png"
    assert "differ" in pair_finding["detail"]

    # Judged-artifact finding
    judged_finding = findings[1]
    assert judged_finding["asset"] == "assets/a.png"
    assert judged_finding["kind"] == "judged-artifact"
    assert isinstance(judged_finding["rect"], list)
    assert len(judged_finding["rect"]) == 4
    assert judged_finding["rect"] == [0, 0, 50, 50]
    assert isinstance(judged_finding["crop"], str)
    assert judged_finding["crop"] == "a_tile_0.png"

    # Check if the crop was saved
    crop_path = out_dir / judged_finding["crop"]
    assert crop_path.exists()


def test_main_default_plan(tmp_path):
    plan_file = tmp_path / "scan_plan.json"
    plan_file.write_text("[]")
    out_dir = tmp_path / "out"

    with patch("artifact_scan.PLAN", plan_file):
        artifact_scan.main(["--out", str(out_dir)])

    report_path = out_dir / "artifact_report.json"
    assert report_path.exists()
    findings = json.loads(report_path.read_text())
    assert findings == []


def test_main_checkpoint_and_resume(tmp_path):
    assets_dir = tmp_path / "assets"
    assets_dir.mkdir()
    out_dir = tmp_path / "out"
    plan_file = tmp_path / "scan_plan.json"

    img_a_path = assets_dir / "a.png"
    img_b_path = assets_dir / "b.png"
    Image.new("RGB", (100, 100), color=(255, 0, 0)).save(img_a_path)
    Image.new("RGB", (100, 100), color=(0, 255, 0)).save(img_b_path)

    plan_data = [
        [
            {
                "asset": {"path": "assets/a.png", "kind": "image", "width": 100, "height": 100},
                "rect": [0, 0, 50, 50],
                "tag": "a_tile_0",
            }
        ],
        [
            {
                "asset": {"path": "assets/b.png", "kind": "image", "width": 100, "height": 100},
                "rect": [0, 0, 50, 50],
                "tag": "b_tile_0",
            }
        ],
    ]
    plan_file.write_text(json.dumps(plan_data))

    call_count = {"count": 0}

    def failing_ask_yes_no(q, crops, attempts=3):
        call_count["count"] += 1
        if call_count["count"] == 2:
            raise RuntimeError("Vertex API transient error")
        return True

    with (
        patch("artifact_scan.ROOT", tmp_path),
        patch("artifact_scan.PLAN", plan_file),
        patch("gen.judge.ask_yes_no", side_effect=failing_ask_yes_no),
        pytest.raises(RuntimeError, match="Vertex API transient error"),
    ):
        artifact_scan.main(["--plan", str(plan_file), "--out", str(out_dir)])

    state_file = out_dir / "scan_state.json"
    assert state_file.exists()
    state = json.loads(state_file.read_text())
    assert state["completed_index"] == 0

    report_path = out_dir / "artifact_report.json"
    assert report_path.exists()
    findings_run1 = json.loads(report_path.read_text())
    assert len(findings_run1) == 1
    assert findings_run1[0]["asset"] == "assets/a.png"

    # Second run without error resumes from batch 1
    resumed_calls = []

    def resume_ask_yes_no(q, crops, attempts=3):
        resumed_calls.append(crops)
        return True

    with patch("artifact_scan.ROOT", tmp_path), \
         patch("artifact_scan.PLAN", plan_file), \
         patch("gen.judge.ask_yes_no", side_effect=resume_ask_yes_no):
        artifact_scan.main(["--plan", str(plan_file), "--out", str(out_dir)])

    # Batch 0 should have been skipped, only 1 call for batch 1
    assert len(resumed_calls) == 1

    # State file must be unlinked after successful completion
    assert not state_file.exists()

    findings_final = json.loads(report_path.read_text())
    assert len(findings_final) == 2
    assert findings_final[0]["asset"] == "assets/a.png"
    assert findings_final[1]["asset"] == "assets/b.png"


def test_main_different_plan_resets_completed_and_overwrites_report(tmp_path):
    assets_dir = tmp_path / "assets"
    assets_dir.mkdir()
    out_dir = tmp_path / "out"
    out_dir.mkdir()

    # Pre-existing state from an earlier, completed plan
    state_file = out_dir / "scan_state.json"
    state_file.write_text(json.dumps({
        "completed_index": 5,
        "plan_fingerprint": "old_plan_hash",
    }))

    # Pre-existing report from an earlier run
    report_path = out_dir / "artifact_report.json"
    report_path.write_text(json.dumps([{
        "asset": "assets/stale.png",
        "kind": "judged-artifact",
        "rect": [0, 0, 50, 50],
        "crop": "stale_0.png",
    }]))

    # New plan with 2 batches
    img_c_path = assets_dir / "c.png"
    img_d_path = assets_dir / "d.png"
    Image.new("RGB", (100, 100), color=(10, 20, 30)).save(img_c_path)
    Image.new("RGB", (100, 100), color=(40, 50, 60)).save(img_d_path)

    plan_data = [
        [
            {
                "asset": {"path": "assets/c.png", "kind": "image", "width": 100, "height": 100},
                "rect": [0, 0, 50, 50],
                "tag": "c_tile_0",
            }
        ],
        [
            {
                "asset": {"path": "assets/d.png", "kind": "image", "width": 100, "height": 100},
                "rect": [0, 0, 50, 50],
                "tag": "d_tile_0",
            }
        ],
    ]
    plan_file = tmp_path / "new_scan_plan.json"
    plan_file.write_text(json.dumps(plan_data))

    batches_executed = []

    def judge_callback(q, crops, attempts=3):
        batches_executed.append(crops)
        return True

    with patch("artifact_scan.ROOT", tmp_path), \
         patch("artifact_scan.PLAN", plan_file), \
         patch("gen.judge.ask_yes_no", side_effect=judge_callback):
        artifact_scan.main(["--plan", str(plan_file), "--out", str(out_dir)])

    # Every batch of the new plan must run (not skipped by old state)
    assert len(batches_executed) == 2

    # Old report must NOT be seeded into findings; only new findings present
    findings = json.loads(report_path.read_text())
    assert len(findings) == 2
    assert findings[0]["asset"] == "assets/c.png"
    assert findings[1]["asset"] == "assets/d.png"

    # State file must be unlinked after successful completion
    assert not state_file.exists()


def test_main_runs_fresh_on_subsequent_invocations(tmp_path):
    assets_dir = tmp_path / "assets"
    assets_dir.mkdir()
    out_dir = tmp_path / "out"
    plan_file = tmp_path / "scan_plan.json"

    img_path = assets_dir / "tile.png"
    Image.new("RGB", (100, 100), color=(100, 150, 200)).save(img_path)

    plan_data = [
        [
            {
                "asset": {"path": "assets/tile.png", "kind": "image", "width": 100, "height": 100},
                "rect": [0, 0, 50, 50],
                "tag": "tile_0",
            }
        ],
    ]
    plan_file.write_text(json.dumps(plan_data))

    call_count = {"count": 0}

    def judge_tile_mock(q, crops, attempts=3):
        call_count["count"] += 1
        return False

    with patch("artifact_scan.ROOT", tmp_path), \
         patch("artifact_scan.PLAN", plan_file), \
         patch("gen.judge.ask_yes_no", side_effect=judge_tile_mock):
        # First complete run
        artifact_scan.main(["--plan", str(plan_file), "--out", str(out_dir)])
        assert call_count["count"] == 1
        state_file = out_dir / "scan_state.json"
        assert not state_file.exists()

        # Second complete run with same plan runs freshly and judges all tiles again
        artifact_scan.main(["--plan", str(plan_file), "--out", str(out_dir)])
        assert call_count["count"] == 2
        assert not state_file.exists()


def test_main_fresh_run_with_empty_first_batch_clears_stale_report(tmp_path):
    assets_dir = tmp_path / "assets"
    assets_dir.mkdir()
    Image.new("RGB", (100, 100), color=(100, 100, 100)).save(assets_dir / "test.png")
    out_dir = tmp_path / "out"
    out_dir.mkdir()
    plan_file = tmp_path / "scan_plan.json"

    # Pre-existing stale report
    report_path = out_dir / "artifact_report.json"
    report_path.write_text(json.dumps([{"asset": "stale.png", "kind": "judged-artifact"}]))

    # First batch is empty (or has non-image), second batch fails
    plan_data = [
        [],  # empty first batch
        [
            {
                "asset": {"path": "assets/test.png", "kind": "image", "width": 100, "height": 100},
                "rect": [0, 0, 50, 50],
                "tag": "test_0",
            }
        ],
    ]
    plan_file.write_text(json.dumps(plan_data))

    def failing_judge(q, crops, attempts=3):
        raise RuntimeError("simulated error on batch 1")

    with (
        patch("artifact_scan.ROOT", tmp_path),
        patch("artifact_scan.PLAN", plan_file),
        patch("gen.judge.ask_yes_no", side_effect=failing_judge),
        pytest.raises(RuntimeError, match="simulated error on batch 1"),
    ):
        artifact_scan.main(["--plan", str(plan_file), "--out", str(out_dir)])

    # State file must show batch 0 was completed
    state_file = out_dir / "scan_state.json"
    assert state_file.exists()
    state = json.loads(state_file.read_text())
    assert state["completed_index"] == 0

    # Old stale report must NOT be preserved
    findings = json.loads(report_path.read_text())
    assert findings == []


def test_main_resume_missing_report_fails_loudly(tmp_path):
    assets_dir = tmp_path / "assets"
    assets_dir.mkdir()
    Image.new("RGB", (100, 100), color=(100, 100, 100)).save(assets_dir / "test.png")

    out_dir = tmp_path / "out"
    out_dir.mkdir()
    plan_file = tmp_path / "scan_plan.json"

    plan_data = [
        [
            {
                "asset": {"path": "assets/test.png", "kind": "image", "width": 100, "height": 100},
                "rect": [0, 0, 50, 50],
                "tag": "test_0",
            }
        ]
    ]
    plan_file.write_text(json.dumps(plan_data))

    seed = artifact_scan.compute_asset_fingerprint_seed(plan_data, tmp_path)
    state_file = out_dir / "scan_state.json"
    executor = BatchExecutor(plan_file, state_file, lambda b: None, fingerprint_seed=seed)
    state_file.write_text(json.dumps({
        "completed_index": 0,
        "plan_fingerprint": executor.fingerprint,
    }))

    # Ensure report file does NOT exist
    report_path = out_dir / "artifact_report.json"
    if report_path.exists():
        report_path.unlink()

    with (
        patch("artifact_scan.ROOT", tmp_path),
        patch("artifact_scan.PLAN", plan_file),
        patch("gen.judge.ask_yes_no", return_value=True),
        pytest.raises(FileNotFoundError, match=r"artifact_report\.json"),
    ):
        artifact_scan.main(["--plan", str(plan_file), "--out", str(out_dir)])


def test_main_replaced_asset_same_plan_invalidates_checkpoint(tmp_path):
    import time

    assets_dir = tmp_path / "assets"
    assets_dir.mkdir()
    out_dir = tmp_path / "out"
    plan_file = tmp_path / "scan_plan.json"

    img_a_path = assets_dir / "a.png"
    img_b_path = assets_dir / "b.png"
    Image.new("RGB", (100, 100), color=(255, 0, 0)).save(img_a_path)
    Image.new("RGB", (100, 100), color=(0, 255, 0)).save(img_b_path)

    plan_data = [
        [
            {
                "asset": {"path": "assets/a.png", "kind": "image", "width": 100, "height": 100},
                "rect": [0, 0, 50, 50],
                "tag": "a_tile_0",
            }
        ],
        [
            {
                "asset": {"path": "assets/b.png", "kind": "image", "width": 100, "height": 100},
                "rect": [0, 0, 50, 50],
                "tag": "b_tile_0",
            }
        ],
    ]
    plan_file.write_text(json.dumps(plan_data))

    call_count = {"count": 0}

    def failing_ask_yes_no(q, crops, attempts=3):
        call_count["count"] += 1
        if call_count["count"] == 2:
            raise RuntimeError("API quota error on batch 1")
        return True

    with (
        patch("artifact_scan.ROOT", tmp_path),
        patch("artifact_scan.PLAN", plan_file),
        patch("gen.judge.ask_yes_no", side_effect=failing_ask_yes_no),
        pytest.raises(RuntimeError, match="API quota error on batch 1"),
    ):
        artifact_scan.main(["--plan", str(plan_file), "--out", str(out_dir)])

    state_file = out_dir / "scan_state.json"
    assert state_file.exists()
    state = json.loads(state_file.read_text())
    assert state["completed_index"] == 0

    # Sleep slightly or advance mtime to ensure different mtime on replacement
    time.sleep(0.05)
    # Replace assets/a.png with new contents and touch mtime
    Image.new("RGB", (100, 100), color=(0, 0, 255)).save(img_a_path)

    judged_tiles = []

    def resume_ask_yes_no(q, crops, attempts=3):
        judged_tiles.append(crops)
        return True

    with patch("artifact_scan.ROOT", tmp_path), \
         patch("artifact_scan.PLAN", plan_file), \
         patch("gen.judge.ask_yes_no", side_effect=resume_ask_yes_no):
        artifact_scan.main(["--plan", str(plan_file), "--out", str(out_dir)])

    # Because a.png was replaced, checkpoint must have been invalidated!
    # Both batch 0 and batch 1 must be judged (2 calls, not 1)
    assert len(judged_tiles) == 2
    assert not state_file.exists()


