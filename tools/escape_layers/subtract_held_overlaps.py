"""Zero held-over-held painting: a later hotspot's settled frame must not
repaint an earlier sibling's held object — the earlier layer draws it.

Only the LAST frame (and the near-settled frame before it) is touched:
mid-animation content legitimately crosses sibling territory (a battery
lifting out of the crate). Shared-object pairs are exempt.

Usage: python3 tools/escape_layers/subtract_held_overlaps.py [room_id ...]
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
SPRITES = ROOT / "public"
SHARED_OBJECT = {("rocketpad", "panel"): "rocket", ("rocketpad", "slot"): "rocket"}
# Verified sheets that must never be rewritten (same set as reextract_room)
FROZEN = {("rocketpad", "toolbox"), ("dragoncave", "dragon")}


def last_frame_view(sheet: np.ndarray, sp: dict, back: int = 0) -> np.ndarray:
    cols, fc = sp["cols"], sp["frameCount"]
    rows = (fc + cols - 1) // cols
    fh, fw = sheet.shape[0] // rows, sheet.shape[1] // cols
    i = fc - 1 - back
    r, c = i // cols, i % cols
    return sheet[r * fh:(r + 1) * fh, c * fw:(c + 1) * fw]


def process_room(room: dict) -> None:
    room_id = room["id"]
    entries = [h for h in room["hotspots"] if h.get("sprite", {}).get("sheet")]
    cores: list[tuple[str, np.ndarray]] = []
    for h in entries:
        sp = h["sprite"]
        path = SPRITES / sp["sheet"]
        frozen = (room_id, h["id"]) in FROZEN
        sheet = np.array(Image.open(path))
        bb = sp["bbox"]
        lf = last_frame_view(sheet, sp)
        core = np.zeros((720, 1280), dtype=bool)
        core[bb["y"]:bb["y"] + bb["h"], bb["x"]:bb["x"] + bb["w"]] = lf[:, :, 3] >= 250

        my_obj = SHARED_OBJECT.get((room_id, h["id"]))
        zeroed = 0
        for earlier_id, earlier_core in cores:
            if my_obj and SHARED_OBJECT.get((room_id, earlier_id)) == my_obj:
                continue
            hit_scene = earlier_core[bb["y"]:bb["y"] + bb["h"], bb["x"]:bb["x"] + bb["w"]]
            if not hit_scene.any():
                continue
            for back in (0, 1):
                fr = last_frame_view(sheet, sp, back)
                sel = hit_scene & (fr[:, :, 3] > 0)
                fr[:, :, 3][sel] = 0
                zeroed += int(sel.sum())
        if zeroed and frozen:
            print(f"{room_id}/{h['id']}: FROZEN — would zero {zeroed} px, NOT saving")
        elif zeroed:
            Image.fromarray(sheet).save(path, "webp", lossless=True, method=6)
            print(f"{room_id}/{h['id']}: zeroed {zeroed} px of held-over-held")
        cores.append((h["id"], core))


def main() -> None:
    m = json.loads((ROOT / "src/assets/manifest.json").read_text())
    wanted = set(sys.argv[1:])
    for room in m.get("escape", []):
        if wanted and room["id"] not in wanted:
            continue
        process_room(room)


if __name__ == "__main__":
    main()
