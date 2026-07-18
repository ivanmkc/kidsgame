"""Generate reveal/collect grammar scenes for escape rooms.

For each gives-hotspot in chain order, generates:
  - revealScene: container open, item visible (NBP edit on previous state)
  - takenScene: container open, item GONE (NBP edit on revealScene)
  - itemBox: SAM-located bounding box of the item in revealScene

For search gives-hotspots that lack animVideo, generates a Veo reveal clip.
Win and no-gives-lock hotspots keep their existing afterScene + animVideo.

Usage:
  source ~/.profile  # or set CLOUDSDK_AUTH_ACCESS_TOKEN
  python3 tools/gen_escape_grammar.py dragoncave
"""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from gen.chroma import key_out_magenta  # noqa: E402
from gen.judge import ask_yes_no  # noqa: E402
from gen.nbp import _call, edit, generate  # noqa: E402
from gen.escape_specs import ESCAPE_ROOMS, ESCAPE_STYLE, ESCAPE_TRANSLATIONS  # noqa: E402
from gen_stories import _locate_scare  # noqa: E402
from google.genai import types  # noqa: E402
from PIL import Image  # noqa: E402

ROOT = Path(__file__).parent.parent
OUT = ROOT / "assets" / "game" / "escape"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"

# Prompts for reveal/taken scenes per room/hotspot.
# reveal: what the scene looks like with container open AND item visible.
# taken: what the scene looks like with container open but item GONE.
# anim: Veo prompt for the reveal clip (container opening).
GRAMMAR_PROMPTS: dict[str, dict[str, dict[str, str]]] = {
    "dragoncave": {
        "haystack": {
            "reveal": "the golden haystack is parted open in the middle, revealing a big white speckled egg nestled in the straw",
            "taken": "the golden haystack is parted open in the middle, showing only straw inside — the egg is gone",
            "anim": "the golden haystack splits open and a big white speckled egg rolls into view, nestled in the straw",
        },
        "stove": {
            "reveal": "the copper stove is now lit with warm orange flames through the grate, a golden pancake sizzling in a pan on top",
            "taken": "the copper stove is lit with warm orange flames through the grate, the pan on top is empty — the pancake is gone",
        },
    },
    "rocketpad": {
        "toolbox": {
            "reveal": None,  # toolbox already open in base scene; use base as reveal
            "taken": None,   # toolbox stays open; visual feedback via glow + fly animation
        },
        "crate": {
            "reveal": "the brown wooden supply crate with its green lid popped wide open, a chunky green battery with a bright yellow lightning bolt sitting inside on top of packing straw",
            "taken": "the brown wooden supply crate with its green lid popped wide open, showing only packing straw inside — the battery is gone",
            "anim": "the brown supply crate's green lid pops open, revealing a chunky green battery with a lightning bolt inside",
        },
    },
    "piratecove": {
        "net": {
            "reveal": "the green fishing net is pulled back from the grey rock, revealing a colorful blue fish flopping on the sand next to the rock",
            "taken": "the green fishing net is pulled back from the grey rock, the sand next to it is empty — the fish is gone",
            "anim": "the fishing net lifts off the rock and a colorful blue fish flops out onto the sand",
        },
        "pelican": {
            "reveal": "a large shiny rainbow seashell sparkling with light sitting on the sand in front of the wooden post, near the pelican's feet",
            "taken": "the sand in front of the wooden post is clear and empty — the shell is gone",
        },
    },
}


def _expanded_mask(box: tuple[int, int, int, int], w_img: int, h_img: int,
                   growth: float = 1.6) -> np.ndarray:
    x, y, w, h = box
    cx, cy = x + w / 2, y + h / 2
    nw, nh = int(w * growth), int(h * growth)
    nx = max(0, int(cx - nw / 2))
    ny = max(0, int(cy - nh / 2))
    nx1 = min(w_img, nx + nw)
    ny1 = min(h_img, ny + nh)
    mask = np.zeros((h_img, w_img), bool)
    mask[ny:ny1, nx:nx1] = True
    return mask


def gen_scene(prev: Image.Image, fname: str, box: tuple[int, int, int, int],
              prompt: str, max_attempts: int = 3, growth: float = 1.6,
              drift_max: float = 0.12, inside_min: float = 0.05,
              judge_pad: float = 0.3, judge_q: str | None = None) -> Image.Image | None:
    """Generate a scene edit, judge-gated. Returns the edited image or None."""
    if (OUT / fname).exists():
        print(f"  {fname}: exists, reusing")
        return Image.open(OUT / fname)

    w_img, h_img = prev.size
    mask = _expanded_mask(box, w_img, h_img, growth)

    for attempt in range(max_attempts):
        try:
            out, inside_ch, drift = edit(prev, mask, prompt)
        except Exception as e:
            print(f"  {fname}: attempt {attempt + 1} error: {str(e)[:120]}")
            continue
        if drift > drift_max:
            print(f"  {fname}: drift {drift:.2f}, retry {attempt + 1}")
            continue
        if inside_ch < inside_min:
            print(f"  {fname}: no change ({inside_ch:.2f}), retry {attempt + 1}")
            continue
        x, y, w, h = box
        pad = int(max(w, h) * judge_pad)
        cx0, cy0 = max(0, x - pad), max(0, y - pad)
        cx1, cy1 = min(w_img, x + w + pad), min(h_img, y + h + pad)
        before_crop = prev.crop((cx0, cy0, cx1, cy1))
        after_crop = out.crop((cx0, cy0, cx1, cy1))
        q = judge_q or (
            f"Two images: BEFORE and AFTER an edit. "
            f"Does the second show '{prompt}'? "
            f"Natural look, no rectangular seam, no clipped parts."
        )
        if ask_yes_no(q, [before_crop, after_crop]):
            out.save(OUT / fname)
            print(f"  {fname}: saved (ch={inside_ch:.2f} drift={drift:.2f})")
            return out
        print(f"  {fname}: judge rejected, retry {attempt + 1}")

    # Retry with relaxed gates
    print(f"  {fname}: retrying with relaxed gates")
    for attempt in range(3):
        try:
            out, inside_ch, drift = edit(prev, _expanded_mask(box, w_img, h_img, growth=2.0), prompt)
        except Exception as e:
            print(f"  {fname}: relaxed attempt {attempt + 1} error: {str(e)[:120]}")
            continue
        if drift > 0.15 or inside_ch < 0.03:
            print(f"  {fname}: relaxed drift={drift:.2f} ch={inside_ch:.2f}, retry {attempt + 1}")
            continue
        x, y, w, h = box
        pad = int(max(w, h) * 0.5)
        cx0, cy0 = max(0, x - pad), max(0, y - pad)
        cx1, cy1 = min(w_img, x + w + pad), min(h_img, y + h + pad)
        before_crop = prev.crop((cx0, cy0, cx1, cy1))
        after_crop = out.crop((cx0, cy0, cx1, cy1))
        q = judge_q or f"Does the second image show '{prompt}'? Minor differences elsewhere are fine."
        if ask_yes_no(q, [before_crop, after_crop]):
            out.save(OUT / fname)
            print(f"  {fname}: saved (relaxed, ch={inside_ch:.2f} drift={drift:.2f})")
            return out
        print(f"  {fname}: relaxed judge rejected, retry {attempt + 1}")
    print(f"  {fname}: FAILED")
    return None


def gen_room_grammar(spec: dict) -> bool:
    """Generate reveal/collect grammar scenes for a room. Returns True on success."""
    rid = spec["id"]
    prompts = GRAMMAR_PROMPTS.get(rid, {})
    if not prompts:
        print(f"{rid}: no grammar prompts defined, skipping")
        return False

    manifest = json.loads(MANIFEST.read_text())
    room_entry = next((r for r in manifest.get("escape", []) if r["id"] == rid), None)
    if not room_entry:
        print(f"{rid}: not in manifest, run gen_escape.py first")
        return False

    base_scene = Image.open(OUT / f"{rid}.png")
    gives_hotspots = [h for h in spec["hotspots"] if h.get("gives")]
    hotspot_boxes = {h["id"]: h["box"] for h in room_entry["hotspots"]
                     if "box" in h}

    current_scene = base_scene
    updates: dict[str, dict] = {}  # hotspot_id → {revealScene, takenScene, itemBox}

    for h in gives_hotspots:
        hid = h["id"]
        hp = prompts.get(hid, {})
        if not hp:
            print(f"  {rid}/{hid}: no grammar prompts, skipping")
            continue

        box_dict = hotspot_boxes.get(hid)
        if not box_dict:
            print(f"  {rid}/{hid}: no box in manifest, skipping")
            continue
        box = (box_dict["x"], box_dict["y"], box_dict["w"], box_dict["h"])

        # Generate revealScene (or skip if reveal prompt is None — item already visible)
        reveal_fname = f"{rid}_{hid}_reveal.png"
        reveal_prompt = hp.get("reveal")
        if reveal_prompt is None:
            # Item already visible in current scene; use it as-is
            import shutil
            if not (OUT / reveal_fname).exists():
                current_scene.save(OUT / reveal_fname)
                print(f"  {reveal_fname}: copied from current scene (item already visible)")
            reveal_img = Image.open(OUT / reveal_fname)
        elif (OUT / reveal_fname).exists():
            reveal_img = Image.open(OUT / reveal_fname)
            print(f"  {reveal_fname}: exists, reusing")
        else:
            reveal_img = gen_scene(current_scene, reveal_fname, box, reveal_prompt)

        if reveal_img is None:
            print(f"  {rid}/{hid}: revealScene FAILED")
            return False

        # Locate itemBox via SAM on the revealScene
        item_label = next(
            (i["label"] for i in spec["items"] if i["id"] == h["gives"]),
            h["gives"])
        item_pop = h.get("pop", item_label)
        print(f"  {rid}/{hid}: locating itemBox for '{item_pop}'")
        item_box = _locate_scare(reveal_img, item_pop, f"{rid}/{hid}_item")
        if item_box is None:
            # Fallback: use a sub-region of the hotspot box
            print(f"  {rid}/{hid}: SAM failed for itemBox, using center of hotspot box")
            bx, by, bw, bh = box
            item_box = (bx + bw // 4, by + bh // 4, bw // 2, bh // 2)

        # Generate takenScene (or copy reveal if taken prompt is None)
        taken_fname = f"{rid}_{hid}_taken.png"
        taken_prompt = hp.get("taken")
        if taken_prompt is None:
            if not (OUT / taken_fname).exists():
                reveal_img.save(OUT / taken_fname)
                print(f"  {taken_fname}: copied from revealScene (no visible taken change)")
            taken_img = Image.open(OUT / taken_fname)
        else:
            taken_img = gen_scene(
                reveal_img, taken_fname, box, taken_prompt,
                judge_q=f"Is the item GONE from the container? The container should still be open but EMPTY. YES if the item is no longer visible. Minor differences elsewhere are fine."
            )
        if taken_img is None:
            print(f"  {rid}/{hid}: takenScene FAILED")
            return False

        updates[hid] = {
            "revealScene": f"escape/{reveal_fname}",
            "takenScene": f"escape/{taken_fname}",
            "itemBox": {"x": item_box[0], "y": item_box[1],
                        "w": item_box[2], "h": item_box[3]},
        }

        # Advance the chain: next hotspot sees the takenScene state
        current_scene = taken_img

    # Regenerate afterScene for win/no-gives-lock hotspots from the new chain
    for h in spec["hotspots"]:
        if h.get("gives") or not h.get("after"):
            continue
        hid = h["id"]
        box_dict = hotspot_boxes.get(hid)
        if not box_dict:
            continue
        box = (box_dict["x"], box_dict["y"], box_dict["w"], box_dict["h"])
        after_fname = f"{rid}_{hid}_after.png"
        after_img = gen_scene(current_scene, after_fname, box, h["after"])
        if after_img is not None:
            updates[hid] = {"afterScene": f"escape/{after_fname}"}
            current_scene = after_img

    # Update manifest
    manifest = json.loads(MANIFEST.read_text())
    room_entry = next(r for r in manifest["escape"] if r["id"] == rid)
    for mh in room_entry["hotspots"]:
        if mh["id"] in updates:
            mh.update(updates[mh["id"]])
            # Remove afterScene from gives-hotspots (replaced by revealScene/takenScene)
            if "revealScene" in updates[mh["id"]] and "afterScene" in mh:
                del mh["afterScene"]
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"\n{rid}: manifest updated with {len(updates)} hotspot changes")
    return True


def main() -> None:
    rooms = sys.argv[1:] if len(sys.argv) > 1 else [s["id"] for s in ESCAPE_ROOMS]
    for spec in ESCAPE_ROOMS:
        if spec["id"] not in rooms:
            continue
        print(f"\n{'='*60}")
        print(f"  Processing {spec['id']}")
        print(f"{'='*60}")
        ok = gen_room_grammar(spec)
        if ok:
            print(f"\n  {spec['id']}: SUCCESS")
        else:
            print(f"\n  {spec['id']}: FAILED")


if __name__ == "__main__":
    main()
