"""Gate self-test suite for verify_escape_chain.py.

Thirteen synthetic defective fixtures, each asserted to FAIL its check:
  (a) sheet with blank last frame
  (b) itemBbox outside game frame
  (c) non-converging tail
  (d) unchanged object pixels inside SAM mask (alpha-core)
  (e) object-at-rest doubles in mid-anim composite (mocked Gemini)
  (f) sprite.rest without sheet (manifest defect)
  (g) rest layer with alpha hole exposing plate (pen defect class)
  (g2) rest layer with afterScene content (wrong pre-interaction state)
  (h) baseline regression — above-baseline fails, within-baseline passes
  (i) bbox-boundary seam from baked wrong-tone background
  (j) sibling isolation — baked sibling rest-layer pixels in sheet
  (k) rest-boundary seam — stale-lineage rest layer on current plate
  (l) alpha-contour seam — interior alpha cliff on current plate

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
        """Blank held frame while the afterScene still SHOWS the object at
        the bbox = a genuine dropout; the departed-object excuse must not
        fire (it only applies when the after state is plate-like there)."""
        room = _build_room(tmp_path, last_alpha=0)
        sp = room["hotspots"][0]["sprite"]
        _save_rgb(tmp_path / "assets" / "game" / sp["afterScene"],
                  SCENE_W, SCENE_H, (200, 50, 50))  # object-colored after
        with _apply_patches(tmp_path):
            result, _ = vec.check_sheet_consistency(sp)
        assert "FAIL" in result, f"Expected FAIL for blank last frame, got: {result}"

    def test_blank_last_frame_excused_when_departed(self, tmp_path):
        """Same blank held frame, but the afterScene matches the plate at
        the bbox (object left the scene) -> faithful low coverage, PASS."""
        room = _build_room(tmp_path, last_alpha=0)
        sp = room["hotspots"][0]["sprite"]
        _save_rgb(tmp_path / "assets" / "game" / sp["afterScene"],
                  SCENE_W, SCENE_H, (80, 80, 80))  # plate-colored after
        with _apply_patches(tmp_path):
            result, _ = vec.check_sheet_consistency(sp)
        assert result == "PASS", f"Expected departed-object PASS, got: {result}"

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
# Fixture (c3): rest-layer purity
# ===================================================================
class TestRestPurity:
    def test_background_slab_rest_fails(self, tmp_path):
        """Rest painted plate-colored across its full rect = background slab."""
        room = _build_room(tmp_path)
        sp = room["hotspots"][0]["sprite"]
        rb = sp["restBbox"]
        _save_rgba(tmp_path / "public" / sp["rest"], rb["w"], rb["h"], (80, 80, 80), 255)
        with _apply_patches(tmp_path):
            result, imp = vec.verify_rest_purity("testroom", sp)
        assert result == "FAIL" and imp > 90, f"{result} {imp}"

    def test_object_rest_passes(self, tmp_path):
        room = _build_room(tmp_path)
        sp = room["hotspots"][0]["sprite"]
        rb = sp["restBbox"]
        _save_rgba(tmp_path / "public" / sp["rest"], rb["w"], rb["h"], (200, 50, 50), 255)
        with _apply_patches(tmp_path):
            result, imp = vec.verify_rest_purity("testroom", sp)
        assert result == "PASS" and imp < 5, f"{result} {imp}"


# ===================================================================
# Fixture (c2): frame-drop vanish discrimination
# ===================================================================
class TestFrameDropVanish:
    """A coverage collapse is excused iff the lost region's RGB went
    plate-like (source-content vanish); a dropout with the object still
    visible in RGB keeps failing."""

    def _room_with_drop(self, tmp_path, after_color):
        room = _build_room(tmp_path, frame_count=8, cols=4)
        sp = room["hotspots"][0]["sprite"]
        _save_rgb(tmp_path / "assets" / "game" / sp["afterScene"], SCENE_W, SCENE_H, after_color)
        sheet_p = tmp_path / "public" / sp["sheet"]
        im = Image.open(sheet_p)
        cols, fc = sp["cols"], sp["frameCount"]
        rows = (fc + cols - 1) // cols
        fw, fh = im.width // cols, im.height // rows
        arr = np.zeros((im.height, im.width, 4), dtype=np.uint8)
        for i in range(fc):
            r, c = divmod(i, cols)
            blk = arr[r * fh:(r + 1) * fh, c * fw:(c + 1) * fw]
            if i < 4:
                blk[:, :, :3] = (200, 50, 50)
                blk[:, :, 3] = 255
            else:
                blk[:, :, 3] = 0
        Image.fromarray(arr, "RGBA").save(sheet_p)
        return room

    def test_vanish_vs_dropout(self, tmp_path):
        room_v = self._room_with_drop(tmp_path, (80, 80, 80))   # plate color -> vanish
        with _apply_patches(tmp_path):
            fails_vanish = vec.verify_frame_integrity("testroom", room_v["hotspots"])
        room_d = self._room_with_drop(tmp_path, (200, 50, 50))  # object color -> dropout
        with _apply_patches(tmp_path):
            fails_dropout = vec.verify_frame_integrity("testroom", room_d["hotspots"])
        assert fails_dropout == fails_vanish + 1, (
            f"vanish={fails_vanish} dropout={fails_dropout}: the vanish branch "
            f"must excuse exactly the FRAME-DROP failure")


# ===================================================================
# Fixture (c): non-converging tail
# ===================================================================
class TestNonConvergingTail:
    def _patch_after_solid(self, tmp_path, room, color):
        """Overwrite the afterScene with a solid fill so the held-vs-after
        check passes regardless of bbox position after 1280x720 resize."""
        sp = room["hotspots"][0]["sprite"]
        after_path = tmp_path / "assets" / "game" / sp["afterScene"]
        sw, sh = SCENE_W, SCENE_H
        _save_rgb(after_path, sw, sh, color)

    def test_nonconverging_tail_fails(self, tmp_path):
        room = _build_room(tmp_path, frame_count=24, vary_frames=True)
        self._patch_after_solid(tmp_path, room, (200, 50, 50))
        sp = room["hotspots"][0]["sprite"]
        with _apply_patches(tmp_path):
            result, mean_half, mean_quarter, _ = vec.verify_tail_convergence(
                "testroom", "widget", sp
            )
        assert result.startswith("FAIL"), (
            f"Expected tail FAIL, got: {result} "
            f"(half={mean_half:.2f}, quarter={mean_quarter:.2f})"
        )

    def test_converging_tail_passes(self, tmp_path):
        room = _build_room(tmp_path, frame_count=24, vary_frames=False)
        self._patch_after_solid(tmp_path, room, (200, 50, 50))
        sp = room["hotspots"][0]["sprite"]
        with _apply_patches(tmp_path):
            result, _, _, _ = vec.verify_tail_convergence("testroom", "widget", sp)
        assert result == "PASS"

    def test_held_vs_after_mismatch_fails(self, tmp_path):
        """After-scene filled with a different color than the sprite's held
        frame triggers FAIL-HELD (simulates a corrupted afterScene)."""
        room = _build_room(tmp_path, frame_count=24, vary_frames=False)
        self._patch_after_solid(tmp_path, room, (50, 200, 50))
        sp = room["hotspots"][0]["sprite"]
        with _apply_patches(tmp_path):
            result, _, _, mean_held_after = vec.verify_tail_convergence(
                "testroom", "widget", sp
            )
        assert result == "FAIL-HELD", (
            f"Expected FAIL-HELD, got: {result} "
            f"(held_vs_after={mean_held_after:.2f})"
        )


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
    def test_alpha_hole_fails_contour_check(self, tmp_path):
        """Rest layer with alpha hole: composite has a gradient where the
        original is smooth (hole exposes plate inside the object) → FAIL
        on alpha-contour.  Alpha-weighted rest-hole mean is zero because
        the hole pixels have alpha=0, so detection is delegated to the
        contour check."""
        room = _build_room(
            tmp_path,
            obj_color=(200, 50, 50),
            plate_color=(20, 20, 20),
            rest_alpha_hole=True,
            scene_size=(200, 200),
            obj_size=(80, 80),
        )
        with _apply_patches(tmp_path):
            fails = vec.verify_alpha_contour("testroom", room["hotspots"])
        assert fails > 0, "Expected ALPHA-CONTOUR FAIL for alpha-holed rest layer"

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

    def test_afterscene_derived_rest_fails(self, tmp_path):
        """Rest built from afterScene content (wrong state) must FAIL.

        A rest layer shows the PRE-interaction state (original scene).
        If its RGB comes from afterScene instead, clean + rest produces
        afterScene content where the original had different content —
        the composite diverges from the original and must be caught."""
        obj_color = (200, 50, 50)
        after_color = (50, 200, 50)
        plate_color = (80, 80, 80)
        room = _build_room(
            tmp_path,
            obj_color=obj_color,
            after_color=after_color,
            plate_color=plate_color,
        )
        # Overwrite rest layer with afterScene-derived content (wrong state)
        sp = room["hotspots"][0]["sprite"]
        rest_path = tmp_path / "public" / sp["rest"]
        rb = sp["restBbox"]
        rest_arr = np.full(
            (rb["h"], rb["w"], 4), (*after_color, 255), dtype=np.uint8
        )
        Image.fromarray(rest_arr, "RGBA").save(rest_path)
        with _apply_patches(tmp_path):
            fails = vec.verify_rest_plate_match("testroom", room["hotspots"])
        assert fails > 0, (
            "afterScene-derived rest must FAIL rest-hole — "
            "wrong state: original has obj_color, rest has after_color"
        )


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
    one known failure (rocket) is reported.  Crate passes via baseline
    (tan-wood coincidence, team-lead verified 2026-07-19).  Net passes
    via baseline (gray-on-gray coincidence, team-lead verified 2026-07-19)."""

    def test_real_remnant_failures(self):
        m = json.loads(vec.MANIFEST.read_text())
        results: dict[str, int] = {}
        for room in m.get("escape", []):
            results[room["id"]] = vec.verify_plate_remnants(
                room["id"], room.get("hotspots", [])
            )

        total = sum(results.values())
        assert total == 0, (
            f"Expected 0 D.1-PRE failures (all rooms pass via baselines), got {total}: "
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
        assert total == 0, (
            f"Expected 0 rest-hole failures (pen re-cut from SAM mask), got {total}"
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

    def test_real_bbox_seam_energy(self):
        m = json.loads(vec.MANIFEST.read_text())
        baselines = json.loads(vec.REMNANT_BASELINES_PATH.read_text())
        failures = []
        for room in m.get("escape", []):
            for h in room.get("hotspots", []):
                sp = h.get("sprite")
                if not sp or not sp.get("sheet"):
                    continue
                tag = f"{room['id']}/{h['id']}"
                result, excess = vec.verify_bbox_seam(room["id"], h["id"], sp)
                seam_key = f"{tag}.seam_energy"
                if seam_key in baselines:
                    limit = baselines[seam_key]["baseline"]
                    if excess > limit:
                        failures.append(f"{tag}: excess={excess:.2f} > baseline={limit}")
                else:
                    if result not in ("PASS", "SKIP"):
                        failures.append(f"{tag}: {result} excess={excess:.2f} > {vec.THRESH_SEAM_ENERGY}")
        assert not failures, "Seam energy failures:\n  " + "\n  ".join(failures)


# ===================================================================
# Fixture (i): bbox-boundary seam from baked wrong-tone background
# ===================================================================
class TestBboxSeamEnergy:
    def test_baked_background_fails_seam_check(self, tmp_path):
        """A sprite whose opaque pixels carry a different background tone
        than the clean plate should produce a rectangular seam at the bbox
        boundary — verify_bbox_seam must detect it."""
        plate_color = (80, 80, 80)
        baked_bg = (140, 100, 60)  # wrong tone baked into sprite
        obj_color = (200, 50, 50)

        room = _build_room(tmp_path, plate_color=plate_color,
                           obj_color=obj_color, after_color=obj_color,
                           frame_count=8, cols=4)
        sp = room["hotspots"][0]["sprite"]

        # Rebuild the sheet with baked wrong background in transparent areas
        fw, fh = sp["bbox"]["w"], sp["bbox"]["h"]
        cols_s = sp["cols"]
        fc = sp["frameCount"]
        rows_s = (fc + cols_s - 1) // cols_s
        sheet = np.full((rows_s * fh, cols_s * fw, 4), (*baked_bg, 255), dtype=np.uint8)
        for idx in range(fc):
            r, c = divmod(idx, cols_s)
            # Leave alpha fully opaque everywhere — simulating a sprite
            # that covers the full bbox with baked background
            sheet[r * fh:(r + 1) * fh, c * fw:(c + 1) * fw, :3] = baked_bg
            sheet[r * fh:(r + 1) * fh, c * fw:(c + 1) * fw, 3] = 255
        sheet_path = tmp_path / "public" / "escape-sprites" / "testroom_widget.png"
        Image.fromarray(sheet, "RGBA").save(sheet_path)

        with _apply_patches(tmp_path):
            result, excess = vec.verify_bbox_seam("testroom", "widget", sp)
        assert result == "FAIL", (
            f"Expected FAIL for baked wrong-tone background, got {result} "
            f"(excess={excess:.2f})"
        )

    def test_matching_background_passes_seam_check(self, tmp_path):
        """When sprite has transparent edges (object silhouette, not full
        rectangle), the gradient follows the object, not the bbox, so
        excess seam energy stays low."""
        plate_color = (80, 80, 80)
        obj_color = (200, 50, 50)
        room = _build_room(tmp_path, plate_color=plate_color,
                           obj_color=obj_color, after_color=obj_color)
        sp = room["hotspots"][0]["sprite"]

        # Rebuild sheet with a centered opaque circle and transparent edges
        fw, fh = sp["bbox"]["w"], sp["bbox"]["h"]
        cols_s = sp["cols"]
        fc = sp["frameCount"]
        rows_s = (fc + cols_s - 1) // cols_s
        sheet = np.zeros((rows_s * fh, cols_s * fw, 4), dtype=np.uint8)
        cy, cx = fh // 2, fw // 2
        radius = min(fw, fh) // 3
        yy, xx = np.ogrid[:fh, :fw]
        circle = ((yy - cy) ** 2 + (xx - cx) ** 2) <= radius ** 2
        for idx in range(fc):
            r, c = divmod(idx, cols_s)
            sheet[r * fh:(r + 1) * fh, c * fw:(c + 1) * fw, :3] = obj_color
            sheet[r * fh:(r + 1) * fh, c * fw:(c + 1) * fw, 3] = np.where(circle, 255, 0)
        sheet_path = tmp_path / "public" / "escape-sprites" / "testroom_widget.png"
        Image.fromarray(sheet, "RGBA").save(sheet_path)

        with _apply_patches(tmp_path):
            result, excess = vec.verify_bbox_seam("testroom", "widget", sp)
        assert result == "PASS", f"Expected PASS, got {result} (excess={excess:.2f})"

    def test_shared_object_rest_layer_changes_measurement(self, tmp_path):
        """For shared-object hotspots (HOTSPOT_OBJECT_MAP), the seam check
        must build the runtime stack with sibling rest layers.  Measuring
        without the sibling rest layer must yield a DIFFERENT (higher) value
        than with it, proving the stack matters."""
        plate_color = (80, 80, 80)
        obj_color = (200, 50, 50)

        # Build a room with the primary hotspot "panel_h"
        room = _build_room(
            tmp_path, room_id="sharedroom", hotspot_id="panel_h",
            plate_color=plate_color, obj_color=obj_color,
            after_color=obj_color, frame_count=8, cols=4,
            scene_size=(200, 200), obj_size=(60, 60),
        )
        sp = room["hotspots"][0]["sprite"]
        bbox = sp["bbox"]  # x=30, y=20, w=60, h=60

        # Create sibling "sibling_h" with a rest layer that covers the area
        # AROUND the panel's bbox (fills a band of distinctive color that
        # overlaps the panel bbox boundary region)
        sprites_dir = tmp_path / "public" / "escape-sprites"
        sib_rest_w, sib_rest_h = 120, 120
        sib_rest_x, sib_rest_y = 0, 0
        sib_rest = np.zeros((sib_rest_h, sib_rest_w, 4), dtype=np.uint8)
        sib_rest[:, :, :3] = (190, 60, 60)  # close to sprite color, far from plate
        sib_rest[:, :, 3] = 255
        sib_rest_name = "sharedroom_sibling_h_rest.png"
        Image.fromarray(sib_rest, "RGBA").save(sprites_dir / sib_rest_name)

        # Sibling sprite: a dummy sheet (not under test, just needs to exist
        # for the manifest to be valid)
        sib_sheet = np.zeros((60, 240, 4), dtype=np.uint8)
        sib_sheet_name = "sharedroom_sibling_h.png"
        Image.fromarray(sib_sheet, "RGBA").save(sprites_dir / sib_sheet_name)

        # Update manifest with sibling hotspot
        sib_sprite = {
            "bbox": {"x": 0, "y": 0, "w": 60, "h": 60},
            "restBbox": {"x": sib_rest_x, "y": sib_rest_y,
                         "w": sib_rest_w, "h": sib_rest_h},
            "rest": f"escape-sprites/{sib_rest_name}",
            "beforeScene": f"escape/sharedroom.png",
            "afterScene": f"escape/sharedroom_panel_h_after.png",
            "sheet": f"escape-sprites/{sib_sheet_name}",
            "cols": 4, "frameCount": 4, "fps": 12,
        }
        manifest_path = tmp_path / "src" / "assets" / "manifest.json"
        manifest = json.loads(manifest_path.read_text())
        manifest["escape"][0]["hotspots"].append(
            {"id": "sibling_h", "sprite": sib_sprite}
        )
        manifest_path.write_text(json.dumps(manifest, indent=2))

        # Rebuild the panel sheet with opaque content reaching bbox edges
        # (to create gradient energy at the boundary)
        fw, fh = bbox["w"], bbox["h"]
        cols_s, fc = sp["cols"], sp["frameCount"]
        rows_s = (fc + cols_s - 1) // cols_s
        sheet = np.zeros((rows_s * fh, cols_s * fw, 4), dtype=np.uint8)
        for idx in range(fc):
            r, c = divmod(idx, cols_s)
            sheet[r * fh:(r + 1) * fh, c * fw:(c + 1) * fw, :3] = obj_color
            sheet[r * fh:(r + 1) * fh, c * fw:(c + 1) * fw, 3] = 255
        sheet_path = sprites_dir / "sharedroom_panel_h.png"
        Image.fromarray(sheet, "RGBA").save(sheet_path)

        # Measure WITHOUT mapping (bare plate base)
        with _apply_patches(tmp_path):
            _, excess_without = vec.verify_bbox_seam(
                "sharedroom", "panel_h", sp
            )

        # Measure WITH mapping (plate + sibling rest layer)
        saved_map = dict(vec.HOTSPOT_OBJECT_MAP)
        vec.HOTSPOT_OBJECT_MAP[("sharedroom", "panel_h")] = "shared_obj"
        vec.HOTSPOT_OBJECT_MAP[("sharedroom", "sibling_h")] = "shared_obj"
        try:
            with _apply_patches(tmp_path):
                _, excess_with = vec.verify_bbox_seam(
                    "sharedroom", "panel_h", sp
                )
        finally:
            vec.HOTSPOT_OBJECT_MAP.clear()
            vec.HOTSPOT_OBJECT_MAP.update(saved_map)

        assert excess_without != excess_with, (
            f"Shared-object rest layer must change measurement: "
            f"without={excess_without:.2f}, with={excess_with:.2f}"
        )
        assert excess_with < excess_without, (
            f"With sibling rest layer should reduce excess: "
            f"without={excess_without:.2f}, with={excess_with:.2f}"
        )


# ===================================================================
# Fixture (j): sibling isolation — baked sibling pixels in sheet
# ===================================================================
class TestSiblingIsolation:
    def test_baked_sibling_fails(self, tmp_path):
        """A sprite sheet with opaque pixels inside a sibling's rest-layer
        mask must be flagged by verify_sibling_isolation."""
        sw, sh = 200, 200
        fw, fh = 60, 60
        obj_x, obj_y = 30, 20
        sib_x, sib_y = 60, 20  # overlaps with primary bbox
        plate_color = (80, 80, 80)
        obj_color = (200, 50, 50)
        sib_color = (50, 50, 200)

        scenes_dir = tmp_path / "assets" / "game" / "escape"
        sprites_dir = tmp_path / "public" / "escape-sprites"
        sam_dir = scenes_dir / "sam_masks"
        scenes_dir.mkdir(parents=True)
        sprites_dir.mkdir(parents=True)
        sam_dir.mkdir(parents=True)

        _save_rgb(scenes_dir / "sibroom_clean.png", sw, sh, plate_color)
        orig = np.full((sh, sw, 3), plate_color, dtype=np.uint8)
        orig[obj_y:obj_y+fh, obj_x:obj_x+fw] = obj_color
        Image.fromarray(orig, "RGB").save(scenes_dir / "sibroom.png")
        after = np.full((sh, sw, 3), plate_color, dtype=np.uint8)
        after[obj_y:obj_y+fh, obj_x:obj_x+fw] = obj_color
        Image.fromarray(after, "RGB").save(scenes_dir / "sibroom_primary_after.png")

        sam = np.zeros((sh, sw), dtype=np.uint8)
        sam[obj_y:obj_y+fh, obj_x:obj_x+fw] = 255
        Image.fromarray(sam, "L").save(sam_dir / "sibroom_primary.png")

        # Primary sheet: bbox overlaps sibling, has opaque pixels there
        cols, fc = 4, 4
        bbox = {"x": obj_x, "y": obj_y, "w": fw, "h": fh}
        rows = (fc + cols - 1) // cols
        sheet = np.zeros((rows * fh, cols * fw, 4), dtype=np.uint8)
        for idx in range(fc):
            r, c = divmod(idx, cols)
            sheet[r*fh:(r+1)*fh, c*fw:(c+1)*fw, :3] = obj_color
            sheet[r*fh:(r+1)*fh, c*fw:(c+1)*fw, 3] = 255
        Image.fromarray(sheet, "RGBA").save(sprites_dir / "sibroom_primary.png")

        # Primary rest layer
        rest = np.full((fh, fw, 4), (*obj_color, 255), dtype=np.uint8)
        Image.fromarray(rest, "RGBA").save(sprites_dir / "sibroom_primary_rest.png")

        # Sibling rest layer: positioned so it overlaps primary's bbox
        sib_rest = np.full((fh, fw, 4), (*sib_color, 255), dtype=np.uint8)
        Image.fromarray(sib_rest, "RGBA").save(sprites_dir / "sibroom_sibling_rest.png")

        primary_sprite = {
            "bbox": bbox,
            "restBbox": {"x": obj_x, "y": obj_y, "w": fw, "h": fh},
            "rest": "escape-sprites/sibroom_primary_rest.png",
            "beforeScene": "escape/sibroom.png",
            "afterScene": "escape/sibroom_primary_after.png",
            "sheet": "escape-sprites/sibroom_primary.png",
            "cols": cols, "frameCount": fc, "fps": 12,
        }
        sibling_sprite = {
            "bbox": {"x": sib_x, "y": sib_y, "w": fw, "h": fh},
            "restBbox": {"x": sib_x, "y": sib_y, "w": fw, "h": fh},
            "rest": "escape-sprites/sibroom_sibling_rest.png",
            "beforeScene": "escape/sibroom.png",
            "afterScene": "escape/sibroom_primary_after.png",
            "sheet": "escape-sprites/sibroom_primary.png",
            "cols": cols, "frameCount": fc, "fps": 12,
        }

        hotspots = [
            {"id": "primary", "sprite": primary_sprite},
            {"id": "sibling", "sprite": sibling_sprite},
        ]
        manifest = {"escape": [{"id": "sibroom", "hotspots": hotspots}]}
        manifest_path = tmp_path / "src" / "assets" / "manifest.json"
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(manifest, indent=2))

        with _apply_patches(tmp_path):
            fails = vec.verify_sibling_isolation("sibroom", hotspots)

        assert fails > 0, "Sheet with baked sibling pixels should fail isolation check"

    def test_clean_sheet_passes(self, tmp_path):
        """A sheet with no sibling overlap passes isolation."""
        room = _build_room(tmp_path, room_id="cleanroom")
        with _apply_patches(tmp_path):
            fails = vec.verify_sibling_isolation(
                "cleanroom", room["hotspots"]
            )
        assert fails == 0, "Sheet with no sibling overlap should pass"

    def test_shared_object_exemption(self, tmp_path):
        """Hotspots sharing a HOTSPOT_OBJECT_MAP entry are exempted."""
        sw, sh = 200, 200
        fw, fh = 60, 60
        obj_x, obj_y = 30, 20
        sib_x, sib_y = 60, 20
        plate_color = (80, 80, 80)
        obj_color = (200, 50, 50)
        sib_color = (50, 50, 200)

        scenes_dir = tmp_path / "assets" / "game" / "escape"
        sprites_dir = tmp_path / "public" / "escape-sprites"
        sam_dir = scenes_dir / "sam_masks"
        scenes_dir.mkdir(parents=True)
        sprites_dir.mkdir(parents=True)
        sam_dir.mkdir(parents=True)

        _save_rgb(scenes_dir / "maproom_clean.png", sw, sh, plate_color)
        _save_rgb(scenes_dir / "maproom.png", sw, sh, plate_color)
        _save_rgb(scenes_dir / "maproom_p_after.png", sw, sh, plate_color)
        sam = np.zeros((sh, sw), dtype=np.uint8)
        Image.fromarray(sam, "L").save(sam_dir / "maproom_p.png")

        cols, fc = 4, 4
        rows = (fc + cols - 1) // cols
        sheet = np.zeros((rows * fh, cols * fw, 4), dtype=np.uint8)
        for idx in range(fc):
            r, c = divmod(idx, cols)
            sheet[r*fh:(r+1)*fh, c*fw:(c+1)*fw, :3] = obj_color
            sheet[r*fh:(r+1)*fh, c*fw:(c+1)*fw, 3] = 255
        Image.fromarray(sheet, "RGBA").save(sprites_dir / "maproom_p.png")

        rest_p = np.full((fh, fw, 4), (*obj_color, 255), dtype=np.uint8)
        Image.fromarray(rest_p, "RGBA").save(sprites_dir / "maproom_p_rest.png")
        rest_s = np.full((fh, fw, 4), (*sib_color, 255), dtype=np.uint8)
        Image.fromarray(rest_s, "RGBA").save(sprites_dir / "maproom_s_rest.png")

        hotspots = [
            {"id": "p", "sprite": {
                "bbox": {"x": obj_x, "y": obj_y, "w": fw, "h": fh},
                "restBbox": {"x": obj_x, "y": obj_y, "w": fw, "h": fh},
                "rest": "escape-sprites/maproom_p_rest.png",
                "beforeScene": "escape/maproom.png",
                "afterScene": "escape/maproom_p_after.png",
                "sheet": "escape-sprites/maproom_p.png",
                "cols": cols, "frameCount": fc, "fps": 12,
            }},
            {"id": "s", "sprite": {
                "bbox": {"x": sib_x, "y": sib_y, "w": fw, "h": fh},
                "restBbox": {"x": sib_x, "y": sib_y, "w": fw, "h": fh},
                "rest": "escape-sprites/maproom_s_rest.png",
                "beforeScene": "escape/maproom.png",
                "afterScene": "escape/maproom_p_after.png",
                "sheet": "escape-sprites/maproom_p.png",
                "cols": cols, "frameCount": fc, "fps": 12,
            }},
        ]
        manifest = {"escape": [{"id": "maproom", "hotspots": hotspots}]}
        manifest_path = tmp_path / "src" / "assets" / "manifest.json"
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(manifest, indent=2))

        saved_map = dict(vec.HOTSPOT_OBJECT_MAP)
        vec.HOTSPOT_OBJECT_MAP[("maproom", "p")] = "shared"
        vec.HOTSPOT_OBJECT_MAP[("maproom", "s")] = "shared"
        try:
            with _apply_patches(tmp_path):
                fails = vec.verify_sibling_isolation("maproom", hotspots)
        finally:
            vec.HOTSPOT_OBJECT_MAP.clear()
            vec.HOTSPOT_OBJECT_MAP.update(saved_map)

        assert fails == 0, "Shared-object hotspots should be exempted"


# ===================================================================
# Fixture (k): rest-boundary seam — stale-lineage rest layer
# ===================================================================
class TestRestBoundary:
    def test_stale_lineage_rect_rest_fails(self, tmp_path):
        """A near-rectangular rest layer with old-lineage background that
        reaches the restBbox edges must produce elevated excess gradient
        energy — verify_rest_boundary must catch it (same methodology as
        verify_bbox_seam: composite energy minus bare-plate energy)."""
        plate_color = (80, 80, 80)
        old_bg = (140, 100, 60)  # stale-lineage background, far from plate
        obj_color = (200, 50, 50)

        room = _build_room(
            tmp_path, plate_color=plate_color,
            obj_color=obj_color, after_color=obj_color,
            scene_size=(200, 200), obj_size=(60, 60),
        )
        sp = room["hotspots"][0]["sprite"]
        bbox = sp["bbox"]

        # Rect-alpha rest layer with old background baked in —
        # fully opaque to the restBbox edges, old-lineage RGB
        rest_w, rest_h = bbox["w"], bbox["h"]
        rest = np.full((rest_h, rest_w, 4), (*old_bg, 255), dtype=np.uint8)
        # Object in center, old background at edges — the defect
        rest[10:-10, 10:-10, :3] = obj_color
        rest_name = "testroom_widget_rest.png"
        sprites_dir = tmp_path / "public" / "escape-sprites"
        Image.fromarray(rest, "RGBA").save(sprites_dir / rest_name)

        sp["rest"] = f"escape-sprites/{rest_name}"
        sp["restBbox"] = {"x": bbox["x"], "y": bbox["y"],
                          "w": rest_w, "h": rest_h}
        manifest_path = tmp_path / "src" / "assets" / "manifest.json"
        manifest_path.write_text(json.dumps(
            {"escape": [room]}, indent=2
        ))

        with _apply_patches(tmp_path):
            fails = vec.verify_rest_boundary("testroom", room["hotspots"])
        assert fails > 0, "Stale-lineage rect rest layer should FAIL rest-boundary check"

    def test_feathered_rest_passes(self, tmp_path):
        """A rest layer with feathered alpha (transparent at restBbox edges)
        must pass the rest-boundary check — no excess gradient at the
        restBbox perimeter."""
        plate_color = (80, 80, 80)
        obj_color = (200, 50, 50)

        room = _build_room(
            tmp_path, plate_color=plate_color,
            obj_color=obj_color, after_color=obj_color,
            scene_size=(200, 200), obj_size=(60, 60),
        )
        sp = room["hotspots"][0]["sprite"]
        bbox = sp["bbox"]

        rest_w, rest_h = bbox["w"], bbox["h"]
        rest = np.zeros((rest_h, rest_w, 4), dtype=np.uint8)
        # Object centered with feathered alpha — transparent at edges
        cy, cx = rest_h // 2, rest_w // 2
        for y in range(rest_h):
            for x in range(rest_w):
                dist = max(abs(y - cy) / (rest_h / 2), abs(x - cx) / (rest_w / 2))
                alpha = max(0, int(255 * (1 - dist * 1.2)))
                rest[y, x] = (*obj_color, alpha)
        rest_name = "testroom_widget_rest.png"
        sprites_dir = tmp_path / "public" / "escape-sprites"
        Image.fromarray(rest, "RGBA").save(sprites_dir / rest_name)

        sp["rest"] = f"escape-sprites/{rest_name}"
        sp["restBbox"] = {"x": bbox["x"], "y": bbox["y"],
                          "w": rest_w, "h": rest_h}
        manifest_path = tmp_path / "src" / "assets" / "manifest.json"
        manifest_path.write_text(json.dumps(
            {"escape": [room]}, indent=2
        ))

        with _apply_patches(tmp_path):
            fails = vec.verify_rest_boundary("testroom", room["hotspots"])
        assert fails == 0, "Feathered rest layer should PASS rest-boundary check"


class TestRealRestBoundary:
    def test_real_rest_boundary(self):
        m = json.loads(vec.MANIFEST.read_text())
        total = sum(
            vec.verify_rest_boundary(r["id"], r.get("hotspots", []))
            for r in m.get("escape", [])
        )
        assert total == 0, f"Rest-boundary failures: {total}"


class TestAlphaContour:
    def test_interior_cliff_rect_rest_fails(self, tmp_path):
        """Interior alpha cliff (sharp alpha=0→255 well inside bbox)
        produces high composite gradient where original is smooth → FAIL."""
        obj_color = (200, 50, 50)
        plate_color = (80, 80, 80)
        room = _build_room(
            tmp_path,
            obj_color=obj_color, after_color=obj_color,
            plate_color=plate_color,
            scene_size=(200, 200), obj_size=(80, 80),
        )
        sp = room["hotspots"][0]["sprite"]
        bbox = sp["bbox"]
        rw, rh = bbox["w"], bbox["h"]

        rest = np.full((rh, rw, 4), (*obj_color, 255), dtype=np.uint8)
        rest[:12, :, 3] = 0
        rest[-12:, :, 3] = 0
        rest[:, :12, 3] = 0
        rest[:, -12:, 3] = 0
        rest_name = "testroom_widget_rest.png"
        sprites_dir = tmp_path / "public" / "escape-sprites"
        Image.fromarray(rest, "RGBA").save(sprites_dir / rest_name)
        sp["rest"] = f"escape-sprites/{rest_name}"
        sp["restBbox"] = {"x": bbox["x"], "y": bbox["y"], "w": rw, "h": rh}
        manifest_path = tmp_path / "src" / "assets" / "manifest.json"
        manifest_path.write_text(json.dumps({"escape": [room]}, indent=2))

        with _apply_patches(tmp_path):
            fails = vec.verify_alpha_contour("testroom", room["hotspots"])
        assert fails > 0, (
            "Interior-cliff rect rest must FAIL alpha-contour — "
            "composite has gradient where original is smooth"
        )

    def test_feathered_silhouette_passes(self, tmp_path):
        """Feathered silhouette matching original object boundary → PASS."""
        obj_color = (200, 50, 50)
        plate_color = (80, 80, 80)
        room = _build_room(
            tmp_path,
            obj_color=obj_color, after_color=obj_color,
            plate_color=plate_color,
            scene_size=(200, 200), obj_size=(80, 80),
        )
        sp = room["hotspots"][0]["sprite"]
        bbox = sp["bbox"]
        rw, rh = bbox["w"], bbox["h"]

        rest = np.full((rh, rw, 4), (*obj_color, 255), dtype=np.uint8)
        from PIL import ImageFilter as IF
        alpha_img = Image.fromarray(
            np.full((rh, rw), 255, dtype=np.uint8), mode="L"
        ).filter(IF.GaussianBlur(radius=2.0))
        rest[:, :, 3] = np.array(alpha_img)
        rest_name = "testroom_widget_rest.png"
        sprites_dir = tmp_path / "public" / "escape-sprites"
        Image.fromarray(rest, "RGBA").save(sprites_dir / rest_name)
        sp["rest"] = f"escape-sprites/{rest_name}"
        sp["restBbox"] = {"x": bbox["x"], "y": bbox["y"], "w": rw, "h": rh}
        manifest_path = tmp_path / "src" / "assets" / "manifest.json"
        manifest_path.write_text(json.dumps({"escape": [room]}, indent=2))

        with _apply_patches(tmp_path):
            fails = vec.verify_alpha_contour("testroom", room["hotspots"])
        assert fails == 0, "Feathered silhouette should PASS alpha-contour"


class TestRealAlphaContour:
    def test_real_alpha_contour(self):
        m = json.loads(vec.MANIFEST.read_text())
        total = sum(
            vec.verify_alpha_contour(r["id"], r.get("hotspots", []))
            for r in m.get("escape", [])
        )
        assert total == 0, f"Alpha-contour failures: {total}"


class TestRealSiblingIsolation:
    def test_real_sibling_isolation(self):
        m = json.loads(vec.MANIFEST.read_text())
        total = sum(
            vec.verify_sibling_isolation(r["id"], r.get("hotspots", []))
            for r in m.get("escape", [])
        )
        assert total == 0, f"Sibling isolation failures: {total}"


# ===================================================================
# Fixture (m): plate infill quality — seam and color consistency
# ===================================================================
class TestInfillQuality:
    def test_bad_infill_seam_fails(self, tmp_path):
        """Clean plate with a sharp color discontinuity at the object
        boundary (simulating a bad inpaint seam) must FAIL."""
        plate_color = (80, 80, 80)
        obj_color = (200, 50, 50)
        sw, sh = 200, 200
        fw, fh = 60, 60
        obj_x, obj_y = 40, 40

        scenes_dir = tmp_path / "assets" / "game" / "escape"
        sam_dir = scenes_dir / "sam_masks"
        sprites_dir = tmp_path / "public" / "escape-sprites"
        sam_dir.mkdir(parents=True, exist_ok=True)
        sprites_dir.mkdir(parents=True, exist_ok=True)

        _save_rgb(scenes_dir / "seamroom.png", sw, sh, plate_color)

        clean = np.full((sh, sw, 3), plate_color, dtype=np.uint8)
        clean[obj_y:obj_y+fh, obj_x:obj_x+fw] = (200, 180, 50)
        Image.fromarray(clean, "RGB").save(scenes_dir / "seamroom_clean.png")

        sam = np.zeros((sh, sw), dtype=np.uint8)
        sam[obj_y:obj_y+fh, obj_x:obj_x+fw] = 255
        Image.fromarray(sam, "L").save(sam_dir / "seamroom_widget.png")

        rest = np.full((fh, fw, 4), (*obj_color, 255), dtype=np.uint8)
        Image.fromarray(rest, "RGBA").save(sprites_dir / "seamroom_widget_rest.png")

        hotspots = [{"id": "widget", "sprite": {
            "bbox": {"x": obj_x, "y": obj_y, "w": fw, "h": fh},
            "restBbox": {"x": obj_x, "y": obj_y, "w": fw, "h": fh},
            "rest": "escape-sprites/seamroom_widget_rest.png",
        }}]

        with _apply_patches(tmp_path):
            fails = vec.verify_plate_infill_quality("seamroom", hotspots)
        assert fails > 0, "Sharp color discontinuity at mask edge should FAIL"

    def test_smooth_infill_passes(self, tmp_path):
        """Clean plate where the infill region matches surrounding
        background color → smooth transition → PASS."""
        plate_color = (80, 80, 80)
        obj_color = (200, 50, 50)
        sw, sh = 200, 200
        fw, fh = 60, 60
        obj_x, obj_y = 40, 40

        scenes_dir = tmp_path / "assets" / "game" / "escape"
        sam_dir = scenes_dir / "sam_masks"
        sprites_dir = tmp_path / "public" / "escape-sprites"
        sam_dir.mkdir(parents=True, exist_ok=True)
        sprites_dir.mkdir(parents=True, exist_ok=True)

        _save_rgb(scenes_dir / "smoothroom.png", sw, sh, plate_color)
        _save_rgb(scenes_dir / "smoothroom_clean.png", sw, sh, plate_color)

        sam = np.zeros((sh, sw), dtype=np.uint8)
        sam[obj_y:obj_y+fh, obj_x:obj_x+fw] = 255
        Image.fromarray(sam, "L").save(sam_dir / "smoothroom_widget.png")

        rest = np.full((fh, fw, 4), (*obj_color, 255), dtype=np.uint8)
        Image.fromarray(rest, "RGBA").save(sprites_dir / "smoothroom_widget_rest.png")

        hotspots = [{"id": "widget", "sprite": {
            "bbox": {"x": obj_x, "y": obj_y, "w": fw, "h": fh},
            "restBbox": {"x": obj_x, "y": obj_y, "w": fw, "h": fh},
            "rest": "escape-sprites/smoothroom_widget_rest.png",
        }}]

        with _apply_patches(tmp_path):
            fails = vec.verify_plate_infill_quality("smoothroom", hotspots)
        assert fails == 0, "Matching infill color should PASS"

    def test_color_mismatch_infill_fails(self, tmp_path):
        """Clean plate where the infill region has visibly different color
        from surrounding background → FAIL on color consistency."""
        sw, sh = 200, 200
        fw, fh = 60, 60
        obj_x, obj_y = 60, 60

        scenes_dir = tmp_path / "assets" / "game" / "escape"
        sam_dir = scenes_dir / "sam_masks"
        sprites_dir = tmp_path / "public" / "escape-sprites"
        sam_dir.mkdir(parents=True, exist_ok=True)
        sprites_dir.mkdir(parents=True, exist_ok=True)

        _save_rgb(scenes_dir / "colorroom.png", sw, sh, (80, 80, 80))

        clean = np.full((sh, sw, 3), (80, 80, 80), dtype=np.uint8)
        clean[obj_y:obj_y+fh, obj_x:obj_x+fw] = (180, 60, 60)
        Image.fromarray(clean, "RGB").save(scenes_dir / "colorroom_clean.png")

        sam = np.zeros((sh, sw), dtype=np.uint8)
        sam[obj_y:obj_y+fh, obj_x:obj_x+fw] = 255
        Image.fromarray(sam, "L").save(sam_dir / "colorroom_widget.png")

        rest = np.full((fh, fw, 4), (200, 50, 50, 255), dtype=np.uint8)
        Image.fromarray(rest, "RGBA").save(sprites_dir / "colorroom_widget_rest.png")

        hotspots = [{"id": "widget", "sprite": {
            "bbox": {"x": obj_x, "y": obj_y, "w": fw, "h": fh},
            "restBbox": {"x": obj_x, "y": obj_y, "w": fw, "h": fh},
            "rest": "escape-sprites/colorroom_widget_rest.png",
        }}]

        with _apply_patches(tmp_path):
            fails = vec.verify_plate_infill_quality("colorroom", hotspots)
        assert fails > 0, "Color mismatch in infill should FAIL"


    def test_localized_seam_fails(self, tmp_path):
        """Clean plate where the infill has a localized hard edge that the
        global mean averages away — should FAIL on patch seam (p95)."""
        sw, sh = 200, 200
        fw, fh = 80, 80
        obj_x, obj_y = 60, 60

        scenes_dir = tmp_path / "assets" / "game" / "escape"
        sam_dir = scenes_dir / "sam_masks"
        sprites_dir = tmp_path / "public" / "escape-sprites"
        sam_dir.mkdir(parents=True, exist_ok=True)
        sprites_dir.mkdir(parents=True, exist_ok=True)

        plate_val = 120
        _save_rgb(scenes_dir / "seamroom.png", sw, sh, (plate_val,) * 3)

        clean = np.full((sh, sw, 3), plate_val, dtype=np.uint8)
        # Most of the infill matches the plate, but a 32px strip has a
        # sharp brightness jump — simulates a localized fill seam.
        clean[obj_y:obj_y + fh, obj_x:obj_x + fw] = plate_val
        clean[obj_y:obj_y + 32, obj_x:obj_x + fw] = plate_val + 60
        Image.fromarray(clean, "RGB").save(scenes_dir / "seamroom_clean.png")

        sam = np.zeros((sh, sw), dtype=np.uint8)
        sam[obj_y:obj_y + fh, obj_x:obj_x + fw] = 255
        Image.fromarray(sam, "L").save(sam_dir / "seamroom_widget.png")

        rest = np.full((fh, fw, 4), (200, 50, 50, 255), dtype=np.uint8)
        Image.fromarray(rest, "RGBA").save(sprites_dir / "seamroom_widget_rest.png")

        hotspots = [{"id": "widget", "sprite": {
            "bbox": {"x": obj_x, "y": obj_y, "w": fw, "h": fh},
            "restBbox": {"x": obj_x, "y": obj_y, "w": fw, "h": fh},
            "rest": "escape-sprites/seamroom_widget_rest.png",
        }}]

        with _apply_patches(tmp_path):
            fails = vec.verify_plate_infill_quality("seamroom", hotspots)
        assert fails > 0, "Localized hard seam should FAIL on patch_seam"

    def test_texture_mismatch_fails(self, tmp_path):
        """Clean plate where the infill is noisy while surroundings are
        smooth — should FAIL on texture ratio."""
        sw, sh = 200, 200
        fw, fh = 80, 80
        obj_x, obj_y = 60, 60

        scenes_dir = tmp_path / "assets" / "game" / "escape"
        sam_dir = scenes_dir / "sam_masks"
        sprites_dir = tmp_path / "public" / "escape-sprites"
        sam_dir.mkdir(parents=True, exist_ok=True)
        sprites_dir.mkdir(parents=True, exist_ok=True)

        _save_rgb(scenes_dir / "texroom.png", sw, sh, (128,) * 3)

        clean = np.full((sh, sw, 3), 128, dtype=np.uint8)
        # Infill region has high-variance noise; surroundings are flat.
        rng = np.random.RandomState(42)
        noisy = rng.randint(60, 200, (fh, fw, 3)).astype(np.uint8)
        clean[obj_y:obj_y + fh, obj_x:obj_x + fw] = noisy
        Image.fromarray(clean, "RGB").save(scenes_dir / "texroom_clean.png")

        sam = np.zeros((sh, sw), dtype=np.uint8)
        sam[obj_y:obj_y + fh, obj_x:obj_x + fw] = 255
        Image.fromarray(sam, "L").save(sam_dir / "texroom_widget.png")

        rest = np.full((fh, fw, 4), (200, 50, 50, 255), dtype=np.uint8)
        Image.fromarray(rest, "RGBA").save(sprites_dir / "texroom_widget_rest.png")

        hotspots = [{"id": "widget", "sprite": {
            "bbox": {"x": obj_x, "y": obj_y, "w": fw, "h": fh},
            "restBbox": {"x": obj_x, "y": obj_y, "w": fw, "h": fh},
            "rest": "escape-sprites/texroom_widget_rest.png",
        }}]

        with _apply_patches(tmp_path):
            fails = vec.verify_plate_infill_quality("texroom", hotspots)
        assert fails > 0, "Noisy infill on smooth background should FAIL on texture_ratio"


class TestRealInfillQuality:
    """Run infill quality on real assets. All plates should pass after
    re-inpainting and with baselines for inherent cases."""

    def test_real_infill_quality(self):
        m = json.loads(vec.MANIFEST.read_text())
        results: dict[str, int] = {}
        for room in m.get("escape", []):
            results[room["id"]] = vec.verify_plate_infill_quality(
                room["id"], room.get("hotspots", [])
            )
        total = sum(results.values())
        assert total == 0, (
            f"Expected 0 infill quality failures, got {total}: "
            + ", ".join(f"{k}={v}" for k, v in results.items() if v > 0)
        )


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


# ===================================================================
# Fixture: all-held stack — held-over-held painting
# ===================================================================
class TestAllHeld:
    def _room(self, tmp_path, bake_sibling: bool):
        """Two overlapping hotspots; B's last frame optionally bakes A's
        object (the double-draw / stale-sibling-state class)."""
        scenes_dir = tmp_path / "assets" / "game" / "escape"
        sprites_dir = tmp_path / "public" / "escape-sprites"
        scenes_dir.mkdir(parents=True, exist_ok=True)
        sprites_dir.mkdir(parents=True, exist_ok=True)

        plate = np.full((200, 200, 3), (80, 80, 80), dtype=np.uint8)
        Image.fromarray(plate).save(scenes_dir / "stackroom_clean.png")

        def sheet_for(obj_rects, size=60, cols=2, fc=4):
            frame = np.zeros((size, size, 4), dtype=np.uint8)
            for (y0, y1, x0, x1, color) in obj_rects:
                frame[y0:y1, x0:x1, :3] = color
                frame[y0:y1, x0:x1, 3] = 255
            rows = (fc + cols - 1) // cols
            sheet = np.zeros((rows * size, cols * size, 4), dtype=np.uint8)
            for i in range(fc):
                r, c = i // cols, i % cols
                sheet[r*size:(r+1)*size, c*size:(c+1)*size] = frame
            return sheet

        # A at (20,20): red core at local 15..45
        Image.fromarray(sheet_for([(15, 45, 15, 45, (200, 50, 50))]), "RGBA").save(
            sprites_dir / "stackroom_a.webp", "webp", lossless=True)
        # B at (50,50): blue core at local 30..55; A's red core in scene
        # coords 35..65 = B-local -15..15 → bake local 0..15 if requested
        b_rects = [(30, 55, 30, 55, (50, 50, 200))]
        if bake_sibling:
            b_rects.append((0, 15, 0, 15, (200, 50, 50)))
        Image.fromarray(sheet_for(b_rects), "RGBA").save(
            sprites_dir / "stackroom_b.webp", "webp", lossless=True)

        def hs(hid, name, x, y):
            return {
                "id": hid,
                "sprite": {
                    "sheet": f"escape-sprites/{name}.webp",
                    "cols": 2, "frameCount": 4,
                    "bbox": {"x": x, "y": y, "w": 60, "h": 60},
                },
            }
        return {"id": "stackroom",
                "hotspots": [hs("a", "stackroom_a", 20, 20),
                             hs("b", "stackroom_b", 50, 50)]}

    def test_baked_sibling_state_fails(self, tmp_path):
        room = self._room(tmp_path, bake_sibling=True)
        with _apply_patches(tmp_path):
            fails = vec.verify_all_held("stackroom", room["hotspots"])
        assert fails > 0, "held-over-held painting must fail the all-held stack"

    def test_clean_stack_passes(self, tmp_path):
        room = self._room(tmp_path, bake_sibling=False)
        with _apply_patches(tmp_path):
            fails = vec.verify_all_held("stackroom", room["hotspots"])
        assert fails == 0, "non-overlapping held cores must pass"


class TestRealAllHeld:
    def test_real_all_held(self):
        m = json.loads(vec.MANIFEST.read_text())
        total = sum(
            vec.verify_all_held(r["id"], r.get("hotspots", []))
            for r in m.get("escape", [])
        )
        assert total == 0, f"All-held failures: {total}"


# ===================================================================
# Fixture: frame integrity — vanished bodies, mid-anim collapse
# ===================================================================
class TestFrameIntegrity:
    def _room(self, tmp_path, blank_f0=False, blank_mid=False):
        room = _build_room(tmp_path, scene_size=(200, 200), obj_size=(80, 80))
        sp = room["hotspots"][0]["sprite"]
        sheet_path = tmp_path / "public" / sp["sheet"]
        sheet = np.array(Image.open(sheet_path))
        cols, fc = sp["cols"], sp["frameCount"]
        rows = (fc + cols - 1) // cols
        fh, fw = sheet.shape[0] // rows, sheet.shape[1] // cols
        if blank_f0:
            sheet[0:fh, 0:fw, 3] = 0
        if blank_mid:
            i = fc // 2
            r, c = i // cols, i % cols
            sheet[r*fh:(r+1)*fh, c*fw:(c+1)*fw, 3] = 0
        Image.fromarray(sheet).save(sheet_path)
        manifest_path = tmp_path / "src" / "assets" / "manifest.json"
        manifest_path.write_text(json.dumps({"escape": [room]}, indent=2))
        return room

    def test_blank_frame0_fails(self, tmp_path):
        room = self._room(tmp_path, blank_f0=True)
        with _apply_patches(tmp_path):
            fails = vec.verify_frame_integrity("testroom", room["hotspots"])
        assert fails > 0, "empty frame 0 must fail frame-body coverage"

    def test_midframe_collapse_fails(self, tmp_path):
        room = self._room(tmp_path, blank_mid=True)
        with _apply_patches(tmp_path):
            fails = vec.verify_frame_integrity("testroom", room["hotspots"])
        assert fails > 0, "mid-animation coverage collapse must fail"

    def test_intact_sheet_passes(self, tmp_path):
        room = self._room(tmp_path)
        with _apply_patches(tmp_path):
            fails = vec.verify_frame_integrity("testroom", room["hotspots"])
        assert fails == 0


class TestRealFrameIntegrity:
    def test_real_frame_integrity(self):
        m = json.loads(vec.MANIFEST.read_text())
        total = sum(
            vec.verify_frame_integrity(r["id"], r.get("hotspots", []))
            for r in m.get("escape", [])
        )
        assert total == 0, f"Frame-integrity failures: {total}"
