"""Gate self-test suite for verify_escape_chain.py.

Eight synthetic defective fixtures, each asserted to FAIL its check:
  (a) sheet with blank last frame
  (b) itemBbox outside game frame
  (c) non-converging tail
  (d) unchanged object pixels inside SAM mask (alpha-core)
  (e) object-at-rest doubles in mid-anim composite (mocked Gemini)
  (f) sprite.rest without sheet (manifest defect)
  (g) rest layer with alpha hole exposing plate (pen defect class)
  (h) baseline regression — above-baseline fails, within-baseline passes

Plus all-real-assets smoke expecting the current honest reds.
"""
from __future__ import annotations

import importlib.util
import json
import textwrap
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from PIL import Image

# ---------------------------------------------------------------------------
# Module loader — import verify_escape_chain.py by file path
# ---------------------------------------------------------------------------
_VEC_PATH = Path(__file__).resolve().parent.parent / "verify_escape_chain.py"


def _load_vec():
    spec = importlib.util.spec_from_file_location("verify_escape_chain", str(_VEC_PATH))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# Load once; tests patch module-level constants per case
vec = _load_vec()

# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------
SCENE_W, SCENE_H = 128, 96
FRAME_W, FRAME_H = 32, 32


def _make_rgb(w: int, h: int, color: tuple = (128, 128, 128)) -> Image.Image:
    arr = np.full((h, w, 3), color, dtype=np.uint8)
    return Image.fromarray(arr, "RGB")


def _make_rgba(w: int, h: int, color: tuple = (128, 128, 128), alpha: int = 255) -> Image.Image:
    arr = np.full((h, w, 4), (*color, alpha), dtype=np.uint8)
    return Image.fromarray(arr, "RGBA")


def _save_rgb(path: Path, w: int, h: int, color: tuple = (128, 128, 128)):
    _make_rgb(w, h, color).save(path)


def _save_rgba(path: Path, w: int, h: int, color: tuple = (128, 128, 128), alpha: int = 255):
    _make_rgba(w, h, color, alpha).save(path)


def _make_sheet(cols: int, frame_count: int, fw: int, fh: int,
                last_alpha: int = 255, color: tuple = (200, 50, 50),
                vary: bool = False) -> Image.Image:
    """Build a sprite sheet.  If vary=True, each frame gets a different
    color to produce tail-convergence failures."""
    rows = (frame_count + cols - 1) // cols
    sheet = np.zeros((rows * fh, cols * fw, 4), dtype=np.uint8)
    for idx in range(frame_count):
        r, c = divmod(idx, cols)
        if vary:
            fc = ((color[0] + idx * 40) % 256, (color[1] + idx * 60) % 256, color[2])
        else:
            fc = color
        a = last_alpha if idx == frame_count - 1 else 255
        sheet[r * fh:(r + 1) * fh, c * fw:(c + 1) * fw, :3] = fc
        sheet[r * fh:(r + 1) * fh, c * fw:(c + 1) * fw, 3] = a
    return Image.fromarray(sheet, "RGBA")


# ---------------------------------------------------------------------------
# Scaffold: build a minimal synthetic room in tmp_path
# ---------------------------------------------------------------------------
def _build_room(
    tmp_path: Path,
    room_id: str = "testroom",
    hotspot_id: str = "widget",
    *,
    obj_color: tuple = (200, 50, 50),
    plate_color: tuple = (80, 80, 80),
    after_color: tuple | None = None,
    frame_count: int = 8,
    cols: int = 4,
    last_alpha: int = 255,
    vary_frames: bool = False,
    item_layer: bool = False,
    item_bbox: dict | None = None,
    rest_alpha_hole: bool = False,
    small_hole: bool = False,
    omit_sheet: bool = False,
    sam_mask_coverage: float = 1.0,
    scene_size: tuple[int, int] | None = None,
    obj_size: tuple[int, int] | None = None,
    extra_hotspots: list[dict] | None = None,
) -> dict:
    """Create a minimal room fixture and return the manifest dict.

    Returns the full escape room entry (id + hotspots) ready to insert
    into a manifest.  Also creates the files on disk under tmp_path.
    """
    scenes_dir = tmp_path / "assets" / "game" / "escape"
    sam_dir = scenes_dir / "sam_masks"
    sprites_dir = tmp_path / "public" / "escape-sprites"
    sam_dir.mkdir(parents=True, exist_ok=True)
    sprites_dir.mkdir(parents=True, exist_ok=True)

    if after_color is None:
        after_color = obj_color

    sw = scene_size[0] if scene_size else SCENE_W
    sh = scene_size[1] if scene_size else SCENE_H
    fw = obj_size[0] if obj_size else FRAME_W
    fh = obj_size[1] if obj_size else FRAME_H

    obj_y, obj_x = 20, 30

    # Original scene: plate_color background with obj_color block
    orig = np.full((sh, sw, 3), plate_color, dtype=np.uint8)
    orig[obj_y:obj_y + fh, obj_x:obj_x + fw] = obj_color
    Image.fromarray(orig, "RGB").save(scenes_dir / f"{room_id}.png")

    # Clean plate: plate_color everywhere (object removed)
    _save_rgb(scenes_dir / f"{room_id}_clean.png", sw, sh, plate_color)

    # Before scene = original
    before_rel = f"escape/{room_id}.png"

    # After scene: plate_color background + after_color block at anim bbox
    after = np.full((sh, sw, 3), plate_color, dtype=np.uint8)
    after[obj_y:obj_y + fh, obj_x:obj_x + fw] = after_color
    if item_layer:
        ib = item_bbox or {"x": 10, "y": 10, "w": 20, "h": 20}
        ix, iy, iw, ih = ib["x"], ib["y"], ib["w"], ib["h"]
        if ix >= 0 and iy >= 0 and ix + iw <= sw and iy + ih <= sh:
            after[iy:iy + ih, ix:ix + iw] = (255, 215, 0)
    after_name = f"{room_id}_{hotspot_id}_after.png"
    Image.fromarray(after, "RGB").save(scenes_dir / after_name)
    after_rel = f"escape/{after_name}"

    # SAM mask: covers the object region
    sam = np.zeros((sh, sw), dtype=np.uint8)
    if sam_mask_coverage > 0:
        mask_h = int(fh * sam_mask_coverage)
        mask_w = int(fw * sam_mask_coverage)
        sam[obj_y:obj_y + mask_h, obj_x:obj_x + mask_w] = 255
    Image.fromarray(sam, "L").save(sam_dir / f"{room_id}_{hotspot_id}.png")

    # Rest layer (RGBA at restBbox size)
    rest_arr = np.full((fh, fw, 4), (*obj_color, 255), dtype=np.uint8)
    if rest_alpha_hole:
        hole_y, hole_x = fh // 4, fw // 4
        hole_h, hole_w = fh // 2, fw // 2
        rest_arr[hole_y:hole_y + hole_h, hole_x:hole_x + hole_w, 3] = 0
    elif small_hole:
        # ~5% of bbox area — small enough for whole-mean to miss,
        # large enough for windowed metric to catch
        hole_size = max(4, int((fw * fh * 0.05) ** 0.5))
        hole_y = fh // 2 - hole_size // 2
        hole_x = fw // 2 - hole_size // 2
        rest_arr[hole_y:hole_y + hole_size, hole_x:hole_x + hole_size, 3] = 0
    rest_name = f"{room_id}_{hotspot_id}_rest.png"
    Image.fromarray(rest_arr, "RGBA").save(sprites_dir / rest_name)

    # Sprite sheet (PNG to preserve RGBA in synthetic tests)
    sheet_name = f"{room_id}_{hotspot_id}.png"
    sprite_block: dict = {
        "bbox": {"x": obj_x, "y": obj_y, "w": fw, "h": fh},
        "restBbox": {"x": obj_x, "y": obj_y, "w": fw, "h": fh},
        "rest": f"escape-sprites/{rest_name}",
        "beforeScene": before_rel,
        "afterScene": after_rel,
        "cols": cols,
        "frameCount": frame_count,
        "fps": 12,
    }

    if not omit_sheet:
        sheet_img = _make_sheet(cols, frame_count, fw, fh,
                                last_alpha=last_alpha, color=after_color,
                                vary=vary_frames)
        sheet_img.save(sprites_dir / sheet_name)
        sprite_block["sheet"] = f"escape-sprites/{sheet_name}"

    if item_layer:
        ib = item_bbox or {"x": 10, "y": 10, "w": 20, "h": 20}
        item_name = f"{room_id}_{hotspot_id}_item.png"
        _save_rgba(sprites_dir / item_name, ib["w"], ib["h"], (255, 215, 0), 255)
        sprite_block["itemLayer"] = f"escape-sprites/{item_name}"
        sprite_block["itemBbox"] = ib

    hotspots = [{"id": hotspot_id, "sprite": sprite_block}]
    if extra_hotspots:
        hotspots.extend(extra_hotspots)

    room_entry = {"id": room_id, "hotspots": hotspots}

    # Write manifest
    manifest = {"escape": [room_entry]}
    manifest_path = tmp_path / "src" / "assets" / "manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2))

    return room_entry


def _patch_paths(tmp_path: Path):
    """Return attr→value pairs for patch.object on the vec module."""
    return {
        "ROOT": tmp_path,
        "SCENES": tmp_path / "assets" / "game",
        "SPRITES": tmp_path / "public",
        "MANIFEST": tmp_path / "src" / "assets" / "manifest.json",
        "SAM_MASKS_DIR": tmp_path / "assets" / "game" / "escape" / "sam_masks",
        "REMNANT_BASELINES_PATH": tmp_path / "tools" / "remnant_baselines.json",
    }


# ===================================================================
# Fixture (a): sheet with blank last frame
# ===================================================================
class TestBlankLastFrame:
    def test_blank_last_frame_fails_sheet_consistency(self, tmp_path):
        room = _build_room(tmp_path, last_alpha=0)
        sp = room["hotspots"][0]["sprite"]
        with _apply_patches(tmp_path):
            result, _ = vec.check_sheet_consistency(sp)
        assert "FAIL" in result, f"Expected FAIL for blank last frame, got: {result}"

    def test_nonblank_last_frame_passes(self, tmp_path):
        room = _build_room(tmp_path, last_alpha=255)
        sp = room["hotspots"][0]["sprite"]
        with _apply_patches(tmp_path):
            result, _ = vec.check_sheet_consistency(sp)
        assert result == "PASS"


# ===================================================================
# Fixture (b): itemBbox outside game frame
# ===================================================================
class TestItemBboxOutside:
    def test_itembbox_outside_frame_fails(self, tmp_path):
        """itemBbox extends beyond 1280x720 → FAIL."""
        room = _build_room(
            tmp_path,
            item_layer=True,
            item_bbox={"x": 1200, "y": 650, "w": 200, "h": 200},
        )
        with _apply_patches(tmp_path):
            # verify_item_layers checks against GAME_W/GAME_H (1280x720)
            fails = vec.verify_item_layers("testroom", room["hotspots"])
        assert fails > 0, "Expected itemBbox-outside-frame to FAIL"

    def test_no_item_layer_passes(self, tmp_path):
        """Hotspot with no item layer → item-layer check trivially passes."""
        room = _build_room(tmp_path)
        with _apply_patches(tmp_path):
            fails = vec.verify_item_layers("testroom", room["hotspots"])
        assert fails == 0


# ===================================================================
# Fixture (c): non-converging tail
# ===================================================================
class TestNonConvergingTail:
    def test_nonconverging_tail_fails(self, tmp_path):
        room = _build_room(tmp_path, frame_count=24, vary_frames=True)
        sp = room["hotspots"][0]["sprite"]
        with _apply_patches(tmp_path):
            result, mean_half, mean_quarter = vec.verify_tail_convergence(
                "testroom", "widget", sp
            )
        assert result in ("FAIL", "FAIL-NONMONO"), (
            f"Expected tail FAIL, got: {result} "
            f"(half={mean_half:.2f}, quarter={mean_quarter:.2f})"
        )

    def test_converging_tail_passes(self, tmp_path):
        room = _build_room(tmp_path, frame_count=24, vary_frames=False)
        sp = room["hotspots"][0]["sprite"]
        with _apply_patches(tmp_path):
            result, _, _ = vec.verify_tail_convergence("testroom", "widget", sp)
        assert result == "PASS"


# ===================================================================
# Fixture (d): unchanged pixels in alpha-core
# ===================================================================
class TestUnchangedAlphaCore:
    def test_unchanged_pixels_fail_remnant_check(self, tmp_path):
        """Clean plate identical to original in the object region:
        100% unchanged within alpha-core → FAIL."""
        obj_color = (200, 50, 50)
        # plate_color == obj_color means clean plate still has the object pixels
        room = _build_room(tmp_path, obj_color=obj_color, plate_color=obj_color)
        with _apply_patches(tmp_path):
            fails = vec.verify_plate_remnants("testroom", room["hotspots"])
        assert fails > 0, "Expected remnant FAIL when plate == original"

    def test_changed_pixels_pass_remnant_check(self, tmp_path):
        """Clean plate differs from original everywhere in alpha-core → PASS."""
        room = _build_room(
            tmp_path, obj_color=(200, 50, 50), plate_color=(80, 80, 80)
        )
        with _apply_patches(tmp_path):
            fails = vec.verify_plate_remnants("testroom", room["hotspots"])
        assert fails == 0


# ===================================================================
# Fixture (e): doubles in mid-anim composite (mocked Gemini)
# ===================================================================
class TestDoubles:
    def test_doubles_fail_with_gemini_yes(self, tmp_path):
        """Mock Gemini to always say YES (object appears twice) → FAIL."""
        room = _build_room(tmp_path)
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.text = "YES"
        mock_client.models.generate_content.return_value = mock_resp

        with _apply_patches(tmp_path):
            with patch.object(vec, "_get_gemini_client", return_value=mock_client):
                with patch.object(vec, "HOTSPOT_OBJECTS", {("testroom", "widget"): "test widget"}):
                    fails = vec.verify_no_doubles("testroom", room["hotspots"])
        assert fails > 0, "Expected doubles FAIL with Gemini YES"

    def test_doubles_pass_with_gemini_no(self, tmp_path):
        """Mock Gemini to always say NO → PASS."""
        room = _build_room(tmp_path)
        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.text = "NO"
        mock_client.models.generate_content.return_value = mock_resp

        with _apply_patches(tmp_path):
            with patch.object(vec, "_get_gemini_client", return_value=mock_client):
                with patch.object(vec, "HOTSPOT_OBJECTS", {("testroom", "widget"): "test widget"}):
                    fails = vec.verify_no_doubles("testroom", room["hotspots"])
        assert fails == 0


# ===================================================================
# Fixture (f): rest without sheet
# ===================================================================
class TestRestWithoutSheet:
    def test_rest_without_sheet_fails(self, tmp_path):
        room = _build_room(tmp_path, omit_sheet=True)
        with _apply_patches(tmp_path):
            fails = vec.verify_rest_sheet_integrity("testroom", room["hotspots"])
        assert fails > 0, "Expected FAIL for rest-without-sheet"

    def test_rest_with_sheet_passes(self, tmp_path):
        room = _build_room(tmp_path)
        with _apply_patches(tmp_path):
            fails = vec.verify_rest_sheet_integrity("testroom", room["hotspots"])
        assert fails == 0


# ===================================================================
# Fixture (g): rest layer alpha hole exposing plate
# ===================================================================
class TestRestAlphaHole:
    def test_alpha_hole_fails_rest_plate_match(self, tmp_path):
        """Rest layer with alpha hole: plate texture bleeds through,
        composite differs from original → FAIL."""
        room = _build_room(
            tmp_path,
            obj_color=(200, 50, 50),
            plate_color=(20, 20, 20),
            rest_alpha_hole=True,
        )
        with _apply_patches(tmp_path):
            fails = vec.verify_rest_plate_match("testroom", room["hotspots"])
        assert fails > 0, "Expected REST-HOLE FAIL for alpha-holed rest layer"

    def test_small_hole_caught_by_windowed_metric(self, tmp_path):
        """Small hole (~5% of bbox) misses whole-mean but triggers the
        interior-window metric.  Uses a larger bbox (64x64) so the
        32x32 window can find an interior region."""
        room = _build_room(
            tmp_path,
            obj_color=(240, 60, 60),
            plate_color=(10, 10, 10),
            small_hole=True,
            scene_size=(192, 160),
            obj_size=(64, 64),
        )
        with _apply_patches(tmp_path):
            fails = vec.verify_rest_plate_match("testroom", room["hotspots"])
        assert fails > 0, "Expected REST-HOLE FAIL for small interior hole"

    def test_solid_rest_passes(self, tmp_path):
        """Rest layer with no holes → composite matches original → PASS."""
        room = _build_room(
            tmp_path,
            obj_color=(200, 50, 50),
            plate_color=(80, 80, 80),
        )
        with _apply_patches(tmp_path):
            fails = vec.verify_rest_plate_match("testroom", room["hotspots"])
        assert fails == 0


# ===================================================================
# Fixture (h): baseline regression
# ===================================================================
class TestBaselineRegression:
    def _setup_baseline_room(self, tmp_path, unchanged_frac: float):
        """Build a room where the clean plate has `unchanged_frac` of
        the alpha-core region matching the original."""
        obj_color = (200, 50, 50)
        plate_color = (20, 20, 20)

        # Build base room
        room = _build_room(tmp_path, obj_color=obj_color, plate_color=plate_color)

        # Now modify the clean plate so a fraction of alpha-core pixels
        # are unchanged (= same as original)
        scenes = tmp_path / "assets" / "game" / "escape"
        clean = np.array(Image.open(scenes / "testroom_clean.png").convert("RGB"))
        orig = np.array(Image.open(scenes / "testroom.png").convert("RGB"))

        sam = np.array(Image.open(scenes / "sam_masks" / "testroom_widget.png").convert("L")) > 127
        rest = np.array(Image.open(tmp_path / "public" / "escape-sprites" / "testroom_widget_rest.png"))
        alpha_canvas = np.zeros((SCENE_H, SCENE_W), dtype=np.uint8)
        rb = room["hotspots"][0]["sprite"]["restBbox"]
        ry, rx = rb["y"], rb["x"]
        alpha_canvas[ry:ry + FRAME_H, rx:rx + FRAME_W] = rest[:, :, 3]
        core = sam & (alpha_canvas > 200)
        core_ys, core_xs = np.where(core)
        n_unchanged = int(len(core_ys) * unchanged_frac)
        # Copy original pixels to clean at the first n_unchanged core pixels
        for i in range(n_unchanged):
            y, x = core_ys[i], core_xs[i]
            clean[y, x] = orig[y, x]
        Image.fromarray(clean, "RGB").save(scenes / "testroom_clean.png")

        return room

    def test_within_baseline_margin_passes(self, tmp_path):
        """Object has 15% unchanged, baseline=0.16 → within 1pp margin → PASS."""
        room = self._setup_baseline_room(tmp_path, unchanged_frac=0.15)
        baselines_path = tmp_path / "tools" / "remnant_baselines.json"
        baselines_path.parent.mkdir(parents=True, exist_ok=True)
        baselines_path.write_text(json.dumps({
            "testroom/widget": {
                "baseline": 0.16,
                "justification": "test fixture — translucent object",
            }
        }))
        with _apply_patches(tmp_path):
            fails = vec.verify_plate_remnants("testroom", room["hotspots"])
        assert fails == 0, "Expected PASS: 15% unchanged within baseline 16%+1pp"

    def test_above_baseline_margin_fails(self, tmp_path):
        """Object has 20% unchanged, baseline=0.16 → above 1pp margin → FAIL."""
        room = self._setup_baseline_room(tmp_path, unchanged_frac=0.20)
        baselines_path = tmp_path / "tools" / "remnant_baselines.json"
        baselines_path.parent.mkdir(parents=True, exist_ok=True)
        baselines_path.write_text(json.dumps({
            "testroom/widget": {
                "baseline": 0.16,
                "justification": "test fixture — translucent object",
            }
        }))
        with _apply_patches(tmp_path):
            fails = vec.verify_plate_remnants("testroom", room["hotspots"])
        assert fails > 0, "Expected FAIL: 20% unchanged above baseline 16%+1pp"

    def test_no_baseline_uses_absolute(self, tmp_path):
        """Object with 5% unchanged and no baseline → FAIL at absolute 2%."""
        room = self._setup_baseline_room(tmp_path, unchanged_frac=0.05)
        with _apply_patches(tmp_path):
            fails = vec.verify_plate_remnants("testroom", room["hotspots"])
        assert fails > 0, "Expected FAIL: 5% unchanged with no baseline, absolute <2%"


# ===================================================================
# All-real-assets smoke: expect current honest reds
# ===================================================================
class TestRealAssetsSmoke:
    """Run D.1-PRE on the actual escape room assets and verify the
    two known failures (net, rocket) are reported.  Crate passes via
    baseline (tan-wood coincidence, team-lead verified 2026-07-19)."""

    def test_real_remnant_failures(self):
        m = json.loads(vec.MANIFEST.read_text())
        results: dict[str, int] = {}
        for room in m.get("escape", []):
            results[room["id"]] = vec.verify_plate_remnants(
                room["id"], room.get("hotspots", [])
            )

        total = sum(results.values())
        assert total == 2, (
            f"Expected 2 D.1-PRE failures (net, rocket), got {total}: "
            + ", ".join(f"{k}={v}" for k, v in results.items() if v > 0)
        )

    def test_real_rest_sheet_integrity(self):
        m = json.loads(vec.MANIFEST.read_text())
        total = sum(
            vec.verify_rest_sheet_integrity(r["id"], r.get("hotspots", []))
            for r in m.get("escape", [])
        )
        assert total == 0, f"Unexpected rest-without-sheet failures: {total}"

    def test_real_rest_plate_match(self):
        m = json.loads(vec.MANIFEST.read_text())
        total = sum(
            vec.verify_rest_plate_match(r["id"], r.get("hotspots", []))
            for r in m.get("escape", [])
        )
        assert total == 1, (
            f"Expected 1 rest-hole failure (pen), got {total}"
        )

    def test_real_sheet_consistency(self):
        m = json.loads(vec.MANIFEST.read_text())
        total = 0
        for room in m.get("escape", []):
            for h in room.get("hotspots", []):
                sp = h.get("sprite")
                if sp:
                    result, _ = vec.check_sheet_consistency(sp)
                    if result not in ("PASS", "SKIP"):
                        total += 1
        assert total == 0, f"Unexpected sheet-consistency failures: {total}"


# ===================================================================
# Helpers
# ===================================================================
import contextlib


@contextlib.contextmanager
def _apply_patches(tmp_path: Path):
    """Context manager that patches all module-level path constants."""
    attrs = _patch_paths(tmp_path)
    ctx_managers = [patch.object(vec, attr, value) for attr, value in attrs.items()]
    for cm in ctx_managers:
        cm.__enter__()
    try:
        yield
    finally:
        for cm in reversed(ctx_managers):
            cm.__exit__(None, None, None)
