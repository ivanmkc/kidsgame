"""Targeted artifact repairs found by the artifact-detection phase.

- Diff scenes: revert a bad diff's rect in B to A's pixels (erasing that
  difference), then add a fresh verified object in an unused grid cell and
  update the manifest entry.
- Hidden scenes: imagen-remove a badly drawn target, re-add it in place,
  regenerate its cutout thumb. Hitbox rect stays identical.
"""

from __future__ import annotations

import json
import random
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))

from gen.judge import ask_yes_no  # noqa: E402
from gen.nbp import imagen_remove  # noqa: E402
from gen.scenes import (  # noqa: E402
    DIFF_THEMES, _crop, _grid_rects, _try_edit, object_cutout,
)

ROOT = Path(__file__).parent.parent
ASSETS = ROOT / "assets" / "game"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"


def repair_diff(m: dict, scene_id: str, bad_indices: list[int]) -> bool:
    entry = next(d for d in m["diff"] if d["id"] == scene_id)
    theme = next(t for t in DIFF_THEMES if t["id"] == scene_id)
    a = Image.open(ASSETS / entry["imageA"]).convert("RGB")
    b = Image.open(ASSETS / entry["imageB"]).convert("RGB")

    used_whats = " ".join(d["what"] for d in entry["diffs"]).lower()
    pool = [o for o in theme["adds"] if o.lower() not in used_whats]
    random.shuffle(pool)
    rng = random.Random(1234 + hash(scene_id) % 1000)
    avoid = [dict(x=d["x"], y=d["y"], w=d["w"], h=d["h"]) for d in entry["diffs"]]
    free = _grid_rects(4, 3, 6, rng, avoid=avoid)

    for idx in sorted(bad_indices, reverse=True):
        d = entry["diffs"][idx]
        patch = a.crop((d["x"], d["y"], d["x"] + d["w"], d["y"] + d["h"]))
        b.paste(patch, (d["x"], d["y"]))  # exact revert — A pixels back into B
        print(f"  {scene_id}: reverted diff {idx} ({d['what']!r})")
        replaced = False
        while pool and free and not replaced:
            obj = pool.pop(0)
            rect = free.pop(0)
            edited = _try_edit(
                scene_id, b, rect,
                f"Add {obj} INTO the existing scenery. Keep the marked area's "
                "current background, colors and objects exactly as they are — "
                "just draw the new object on top of them, naturally placed ON "
                "the ground or a surface (never floating in the sky), bold and "
                "clearly visible, matching the art style. Do NOT repaint the "
                "backdrop.",
                "These two crops are from a spot-the-difference game for young children. Is there a clearly visible new object in the second crop?",
                "Does the newly added object look naturally drawn into the illustration — standing on something (not floating), no pasted-on box, no white patch behind it, no style clash?",
                base_for_judge=a, tag=f"repair add '{obj}'",
            )
            if edited is not None:
                b = edited
                entry["diffs"][idx] = {"x": rect[0], "y": rect[1], "w": rect[2], "h": rect[3],
                                       "what": f"{obj} appeared"}
                print(f"  {scene_id}: replacement diff = '{obj}' at {rect}")
                replaced = True
        if not replaced:
            print(f"  {scene_id}: FAILED to place replacement for diff {idx}")
            return False

    b.save(ASSETS / entry["imageB"], "JPEG", quality=85, optimize=True)
    return True


def repair_hidden_target(m: dict, scene_id: str, target_id: str) -> bool:
    entry = next(h for h in m["hidden"] if h["id"] == scene_id)
    t = next(x for x in entry["targets"] if x["id"] == target_id)
    img = Image.open(ASSETS / entry["image"]).convert("RGB")
    rect = (t["x"], t["y"], t["w"], t["h"])

    cleared, _, _ = imagen_remove(img, rect)
    print(f"  {scene_id}/{target_id}: old target removed")
    for attempt in range(3):
        edited = _try_edit(
            scene_id, cleared, rect,
            f"Add {t['label']} INTO the existing scenery — the COMPLETE animal/"
            "object with its full body visible, sitting or standing naturally "
            "on a surface, medium-sized, clearly drawn, matching the art "
            "style. Do NOT repaint the backdrop.",
            f"Does this image crop contain {t['label']} shown as a complete, well-drawn figure (not just a head, not cut off)?",
            f"Does {t['label']} look naturally placed in the scene — resting on something, not floating, not pasted on?",
            base_for_judge=cleared, tag=f"re-add '{target_id}'", judge_images="after",
        )
        if edited is None:
            continue
        cut = object_cutout(cleared, edited, rect)
        if cut is None:
            continue
        white = Image.new("RGB", cut.size, (255, 255, 255))
        white.paste(cut, mask=cut.split()[3])
        if not ask_yes_no(
            f"Is this a single complete image of {t['label']} — whole figure, recognizable, no scenery chunks?",
            [white],
        ):
            print(f"    cutout judge rejected, retry {attempt + 1}")
            continue
        edited.save(ASSETS / entry["image"], "JPEG", quality=85, optimize=True)
        cut.save(ASSETS / t["thumb"])
        print(f"  {scene_id}/{target_id}: repaired + new cutout")
        return True
    return False


def main() -> None:
    m = json.loads(MANIFEST.read_text())
    ok = True
    # princess diff idx of the crown-in-sky; party robot + sailboat
    for scene_id, indices in (("princess", [3]), ("party", [0, 2])):
        entry = next(d for d in m["diff"] if d["id"] == scene_id)
        print(f"repairing {scene_id}: {[entry['diffs'][i]['what'] for i in indices]}")
        ok &= repair_diff(m, scene_id, indices)
    ok &= repair_hidden_target(m, "ballroom", "kitten")
    MANIFEST.write_text(json.dumps(m, indent=2) + "\n")
    print("ALL REPAIRS OK" if ok else "SOME REPAIRS FAILED")


if __name__ == "__main__":
    main()
