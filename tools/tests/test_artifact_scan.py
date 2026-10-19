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
    manifest_file = tmp_path / "manifest.json"

    # Create dummy images
    img_a_path = assets_dir / "a.png"
    img_b_path = assets_dir / "b.png"
    img_hidden_path = assets_dir / "h.png"

    # Make them solid colors so check_pair_identity doesn't flag them outside diffs
    img_a = Image.new("RGB", (100, 100), color=(255, 0, 0))
    # Draw a single blue pixel at (10, 10), which is inside the diff rect (so check_pair_identity ignores it),
    # but it will be picked up by the tile (0, 0, 41, 62) during judge_tile.
    img_a.putpixel((10, 10), (0, 0, 255))
    img_a.save(img_a_path)
    
    Image.new("RGB", (100, 100), color=(255, 0, 0)).save(img_b_path)
    Image.new("RGB", (100, 100), color=(0, 255, 0)).save(img_hidden_path)

    manifest_data = {
        "diff": [
            {
                "id": "diff1",
                "imageA": "a.png",
                "imageB": "b.png",
                "diffs": [{"x": 10, "y": 10, "w": 20, "h": 20}]
            }
        ],
        "hidden": [
            {
                "id": "hid1",
                "image": "h.png"
            }
        ]
    }
    manifest_file.write_text(json.dumps(manifest_data))

    def mock_ask_yes_no(q, crops, attempts=3):
        # crops[0] is the PIL Image of the crop
        # Check if it has the blue pixel to simulate returning True for a specific tile
        colors = crops[0].getcolors(maxcolors=1024)
        if colors:
            for count, color in colors:
                if color == (0, 0, 255):
                    return True
        return False

    with patch("artifact_scan.MANIFEST", manifest_file), \
         patch("artifact_scan.ASSETS", assets_dir), \
         patch("gen.judge.ask_yes_no", side_effect=mock_ask_yes_no):
        
        artifact_scan.main(["--out", str(out_dir)])

    report_path = out_dir / "artifact_report.json"
    assert report_path.exists()
    findings = json.loads(report_path.read_text())
    
    assert len(findings) == 1
    finding = findings[0]
    assert finding["asset"] == "a.png"
    assert finding["kind"] == "judged-artifact"
    assert isinstance(finding["rect"], list)
    assert len(finding["rect"]) == 4
    assert isinstance(finding["crop"], str)
    assert finding["crop"].endswith(".png")
    
    # Check if the crop was saved
    crop_path = out_dir / finding["crop"]
    assert crop_path.exists()
