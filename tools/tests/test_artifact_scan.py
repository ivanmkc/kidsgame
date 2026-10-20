import json
import sys
import types as pytypes
import importlib.util
from pathlib import Path
from unittest.mock import patch, MagicMock

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


def test_check_pair_identity(tmp_path):
    assets_dir = tmp_path / "assets" / "game"
    assets_dir.mkdir(parents=True)

    img_a_path = assets_dir / "a.png"
    img_b_path = assets_dir / "b.png"

    img_a = Image.new("RGB", (100, 100), color=(255, 0, 0))
    img_b = Image.new("RGB", (100, 100), color=(255, 0, 0))
    for x in range(50, 70):
        for y in range(50, 70):
            img_b.putpixel((x, y), (0, 255, 0))

    img_a.save(img_a_path)
    img_b.save(img_b_path)

    entry = {
        "id": "diff1",
        "imageA": "a.png",
        "imageB": "b.png",
        "diffs": [{"x": 10, "y": 10, "w": 20, "h": 20}],
    }

    with patch("artifact_scan.ASSETS", assets_dir):
        findings = artifact_scan.check_pair_identity(entry)
        assert len(findings) == 1
        assert findings[0]["kind"] == "pair-identity"
        assert findings[0]["asset"] == "b.png"

        matching_entry = {
            "id": "diff2",
            "imageA": "a.png",
            "imageB": "a.png",
            "diffs": [{"x": 10, "y": 10, "w": 20, "h": 20}],
        }
        assert artifact_scan.check_pair_identity(matching_entry) == []


def test_main(tmp_path):
    assets_dir = tmp_path / "assets" / "game"
    assets_dir.mkdir(parents=True)
    out_dir = tmp_path / "tools" / "audit_out" / "artifact_scan"
    scan_plan_file = tmp_path / "tools" / "audit_out" / "scan_plan.json"
    manifest_file = tmp_path / "src" / "assets" / "manifest.json"
    manifest_file.parent.mkdir(parents=True)

    # Create dummy images
    img_a_path = assets_dir / "a.png"
    img_b_path = assets_dir / "b.png"

    img_a = Image.new("RGB", (100, 100), color=(255, 0, 0))
    # Draw a single blue pixel at (10, 10), which will be picked up by the tile (0, 0, 50, 50).
    img_a.putpixel((10, 10), (0, 0, 255))
    img_a.save(img_a_path)

    Image.new("RGB", (100, 100), color=(255, 0, 0)).save(img_b_path)

    manifest_data = {
        "diff": [
            {
                "id": "diff1",
                "imageA": "a.png",
                "imageB": "b.png",
                "diffs": [{"x": 10, "y": 10, "w": 20, "h": 20}],
            }
        ]
    }
    manifest_file.write_text(json.dumps(manifest_data))

    scan_plan_data = [
        [
            {
                "asset": {"path": "assets/game/a.png", "kind": "image", "width": 100, "height": 100},
                "rect": [0, 0, 50, 50],
                "tag": "diff1_imageA_0",
            },
            {
                "asset": {"path": "assets/game/b.png", "kind": "image", "width": 100, "height": 100},
                "rect": [0, 0, 50, 50],
                "tag": "diff1_imageB_0",
            },
        ]
    ]
    scan_plan_file.parent.mkdir(parents=True, exist_ok=True)
    scan_plan_file.write_text(json.dumps(scan_plan_data))

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
         patch("artifact_scan.ASSETS", assets_dir), \
         patch("artifact_scan.MANIFEST", manifest_file), \
         patch("gen.judge.ask_yes_no", side_effect=mock_ask_yes_no):

        artifact_scan.main(["--out", str(out_dir)])

    report_path = out_dir / "artifact_report.json"
    assert report_path.exists()
    findings = json.loads(report_path.read_text())

    assert len(findings) == 1
    finding = findings[0]
    assert finding["asset"] == "assets/game/a.png"
    assert finding["kind"] == "judged-artifact"
    assert isinstance(finding["rect"], list)
    assert len(finding["rect"]) == 4
    assert isinstance(finding["crop"], str)
    assert finding["crop"].endswith(".png")

    # Check if the crop was saved
    crop_path = out_dir / finding["crop"]
    assert crop_path.exists()
