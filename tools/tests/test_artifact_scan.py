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

def test_tiles():
    # tiles(w=100, h=100, cols=2, rows=2, overlap=0.25)
    # tw = 50, th = 50, ox = 12, oy = 12
    t = list(artifact_scan.tiles(100, 100, cols=2, rows=2, overlap=0.25))
    assert t == [
        (0, 0, 62, 62),
        (38, 0, 100, 62),
        (0, 38, 62, 100),
        (38, 38, 100, 100),
    ]

def test_main(tmp_path):
    assets_dir = tmp_path / "assets"
    assets_dir.mkdir()
    out_dir = tmp_path / "out"
    plan_file = tmp_path / "scan_plan.json"

    # Create dummy images
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
         patch("artifact_scan.PLAN", plan_file), \
         patch("gen.judge.ask_yes_no", side_effect=mock_ask_yes_no):

        artifact_scan.main(["--plan", str(plan_file), "--out", str(out_dir)])

    report_path = out_dir / "artifact_report.json"
    assert report_path.exists()
    findings = json.loads(report_path.read_text())

    assert len(findings) == 1
    finding = findings[0]
    assert finding["asset"] == "assets/a.png"
    assert finding["kind"] == "judged-artifact"
    assert isinstance(finding["rect"], list)
    assert len(finding["rect"]) == 4
    assert finding["rect"] == [0, 0, 50, 50]
    assert isinstance(finding["crop"], str)
    assert finding["crop"] == "a_tile_0.png"

    # Check if the crop was saved
    crop_path = out_dir / finding["crop"]
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
