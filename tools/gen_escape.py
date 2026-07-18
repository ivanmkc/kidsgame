"""Generate Little Escapes rooms: solvability lint, scene, SAM hotspots, pops.

Per room (specs in gen/escape_specs.py):
1. LINT (fail closed): every `needs` has exactly one giver, every item is
   used exactly once, one win spot, greedy trace reaches the win, tray <= 3.
2. Scene render (NBP) — judge-gated, retried.
3. SAM locates every hotspot box (reuses gen_stories._locate_scare ladder).
   Escape hotspots are MANDATORY: any miss fails the room (unlike stories
   there is no tile-button fallback — the picture IS the game).
4. Pop sprites on magenta -> chroma-keyed RGBA (found-item reveal beat).
5. Manifest `escape` section written atomically (fresh read-modify-write —
   other generators own other sections concurrently).

Usage: python3 tools/gen_escape.py [room_id ...]   (resumes from files)
"""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gen.chroma import key_out_magenta  # noqa: E402
from gen.judge import ask_yes_no  # noqa: E402
from gen.nbp import _call, generate  # noqa: E402
from gen.escape_specs import ESCAPE_ROOMS, ESCAPE_STYLE  # noqa: E402
from gen_stories import _locate_scare, _spots_distinct  # noqa: E402
from google.genai import types  # noqa: E402
from PIL import Image  # noqa: E402

ROOT = Path(__file__).parent.parent
OUT = ROOT / "assets" / "game" / "escape"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"


def lint_room(spec: dict) -> list[str]:
    """Mirror of src/games/escape/logic.ts lintRoom — must stay in sync."""
    errs: list[str] = []
    hs = spec["hotspots"]
    gives = [h["gives"] for h in hs if h.get("gives")]
    needs = [h["needs"] for h in hs if h.get("needs")]
    items = [i["id"] for i in spec["items"]]
    for g in gives:
        if g not in items:
            errs.append(f"gives unknown item '{g}'")
    for n in needs:
        if n not in gives:
            errs.append(f"needs '{n}' but nothing gives it")
    for i in items:
        if i not in gives:
            errs.append(f"item '{i}' never given")
        if i not in needs:
            errs.append(f"item '{i}' never used")
    if len(set(gives)) != len(gives):
        errs.append("an item is given twice")
    wins = [h for h in hs if h["kind"] == "win"]
    if len(wins) != 1:
        errs.append(f"expected exactly 1 win hotspot, got {len(wins)}")
    if len(items) > 3:
        errs.append(f"{len(items)} items exceeds tray size 3")
    # Greedy trace: search-with-gives first, then any lock/win whose need is held.
    held: set[str] = set()
    used: set[str] = set()
    for _ in range(50):
        done = False
        for h in hs:
            if h["id"] in used:
                continue
            if h["kind"] == "search" and h.get("gives"):
                held.add(h["gives"]); used.add(h["id"]); done = True; break
            if h["kind"] in ("lock", "win") and (not h.get("needs") or h["needs"] in held):
                if h.get("needs"):
                    held.discard(h["needs"])
                if h.get("gives"):
                    held.add(h["gives"])
                used.add(h["id"])
                if h["kind"] == "win":
                    return errs
                done = True; break
        if not done:
            break
    errs.append("greedy trace never reaches the win")
    return errs


def _gen_pop(room_id: str, hid: str, prompt: str) -> str | None:
    fname = f"{room_id}_{hid}_pop.png"
    if (OUT / fname).exists():
        return f"escape/{fname}"
    for attempt in range(3):
        data = _call([types.Content(role="user", parts=[
            types.Part(text=(
                f"Draw {prompt}, in a bright cheerful children's picture-book style with bold "
                "clean outlines, as a single centered object filling most of the frame, "
                "bouncing joyfully toward the viewer, on a plain solid bright magenta "
                "background (#FF00FF). Nothing else in the image. No text.")),
        ])])
        sprite, coverage = key_out_magenta(Image.open(io.BytesIO(data)).convert("RGB"), out_size=512)
        if 0.10 <= coverage <= 0.95 and ask_yes_no(
            f"Is this a single clean cutout of {prompt} on a transparent background — complete, cheerful, no leftover background?",
            [sprite],
        ):
            sprite.save(OUT / fname)
            return f"escape/{fname}"
        print(f"  {room_id}/{hid}: pop retry {attempt + 1} (cov={coverage:.2f})")
    return None


def gen_room(spec: dict) -> dict | None:
    rid = spec["id"]
    errs = lint_room(spec)
    if errs:
        print(f"{rid}: LINT FAILED — {'; '.join(errs)}")
        return None

    OUT.mkdir(parents=True, exist_ok=True)
    scene_path = OUT / f"{rid}.png"
    for attempt in range(4):
        if scene_path.exists():
            print(f"  {rid}: scene exists, reusing")
        else:
            img = generate(f"{spec['scene']} {ESCAPE_STYLE}", (1280, 720))
            if not ask_yes_no(
                "Is this a charming, artifact-free children's book illustration with no text, "
                "where every described object is clearly visible and separated?",
                [img],
            ):
                print(f"  {rid}: scene judge rejected, retry {attempt + 1}")
                continue
            img.save(scene_path)

        # Hotspots are mandatory — locate every spot or re-render the scene.
        scene = Image.open(scene_path)
        boxes = {}
        for h in spec["hotspots"]:
            box = _locate_scare(scene, h["spot"], f"{rid}/{h['id']}")
            if box is None:
                break
            boxes[h["id"]] = box
        if len(boxes) == len(spec["hotspots"]) and _spots_distinct(list(boxes.values())):
            break
        print(f"  {rid}: {len(boxes)}/{len(spec['hotspots'])} spots located — re-render {attempt + 1}")
        scene_path.unlink(missing_ok=True)
    else:
        print(f"{rid}: FAILED — could not compose a fully-locatable scene")
        return None

    hotspots = []
    for h in spec["hotspots"]:
        x, y, w, hgt = boxes[h["id"]]
        entry: dict = {"id": h["id"], "box": {"x": x, "y": y, "w": w, "h": hgt}, "kind": h["kind"]}
        for k in ("gives", "needs", "sayFound", "saySearch", "sayLocked"):
            if h.get(k):
                entry[k] = h[k]
        if h.get("pop"):
            pop = _gen_pop(rid, h["id"], h["pop"])
            if pop:
                entry["pop"] = pop
        hotspots.append(entry)

    print(f"  room {rid} OK ({len(hotspots)} hotspots)")
    return {
        "id": rid, "name": spec["name"], "level": spec.get("level", "easy"),
        "image": f"escape/{rid}.png", "intro": spec["intro"], "winText": spec["winText"],
        "items": spec["items"], "hotspots": hotspots,
    }


def main() -> None:
    only = set(sys.argv[1:])
    built = []
    for spec in ESCAPE_ROOMS:
        if only and spec["id"] not in only:
            continue
        cur = json.loads(MANIFEST.read_text())
        if any(r["id"] == spec["id"] for r in cur.get("escape", [])):
            print(f"{spec['id']}: already present, skipping")
            continue
        room = gen_room(spec)
        if room is None:
            continue
        # Atomic section update: manifest is shared with concurrent generators.
        cur = json.loads(MANIFEST.read_text())
        cur.setdefault("escape", [])
        cur["escape"] = [r for r in cur["escape"] if r["id"] != room["id"]] + [room]
        MANIFEST.write_text(json.dumps(cur, indent=2) + "\n")
        built.append(spec["id"])
        print(f"room {spec['id']} saved")
    print(f"done: {built or 'nothing new'}")


if __name__ == "__main__":
    main()
