"""Generate Little Escapes rooms: solvability lint, scene, SAM hotspots, pops, state scenes.

Per room (specs in gen/escape_specs.py):
1. LINT (fail closed): every `needs` has exactly one giver, every item is
   used exactly once, one win spot, greedy trace reaches the win, tray <= 3.
2. Scene render (NBP) — judge-gated, retried.
3. SAM locates every hotspot box (reuses gen_stories._locate_scare ladder).
   Escape hotspots are MANDATORY: any miss fails the room (unlike stories
   there is no tile-button fallback — the picture IS the game).
4. Pop sprites on magenta -> chroma-keyed RGBA (found-item reveal beat).
5. State scenes: for each state-changing hotspot k in chain order, generate
   scene_state_k.png = NBP edit on scene_state_{k-1} with a mask EXPANDED
   1.6x the hotspot box. Full-scene images; pixels outside the mask stay
   byte-identical by construction (no seams, no clipped lids).
6. Manifest `escape` section written atomically (fresh read-modify-write —
   other generators own other sections concurrently).

Usage: python3 tools/gen_escape.py [room_id ...]   (resumes from files)
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


def _escape_spots_ok(boxes: list[tuple[int, int, int, int]]) -> bool:
    """Escape-specific distinctness: stories' 240px center rule can't fit
    4-5 spots in one scene and isn't needed — escape taps are deliberate.
    Require: no box hogs the frame, and every pair of boxes keeps a
    finger-width gap so one tap can never land on two spots. The SAM
    boxes already include 12px padding per side (_locate_scare), so any
    remaining gap here is on top of that 24px total."""
    for (x, y, w, h) in boxes:
        if w * h > 0.35 * 1280 * 720:
            return False
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            ax, ay, aw, ah = boxes[i]
            bx, by, bw, bh = boxes[j]
            gap = 4
            if not (ax + aw + gap <= bx or bx + bw + gap <= ax or
                    ay + ah + gap <= by or by + bh + gap <= ay):
                return False
    return True


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
    # State-change chain: scenes generated in spec order, each from previous.
    # Independent searches are fine in reveal/collect grammar.
    return errs


def _semantic_chain_gate(spec: dict) -> list[str]:
    """Gemini judge per chain step: does this step follow everyday cause-and-
    effect a preschooler knows? Fail closed on NO.

    Example passing steps: "key OPENS chest", "battery POWERS rocket",
    "egg COOKS on stove". Example failing: "star powers button" (abstract).
    """
    errs: list[str] = []
    hs = spec["hotspots"]
    item_labels = {i["id"]: i["label"] for i in spec["items"]}
    for h in hs:
        if not h.get("needs"):
            continue
        need_label = item_labels.get(h["needs"], h["needs"])
        spot_label = h.get("spot", h["id"])
        gives_label = item_labels.get(h.get("gives", ""), "") if h.get("gives") else ""
        hint = h.get("sayLocked", "")
        result = h.get("sayFound", "")
        description = (
            f"A child has '{need_label}'. They bring it to '{spot_label}'."
            + (f" The clue was: '{hint}'" if hint else "")
            + (f" Result: '{result}'" if result else "")
            + (f" This produces '{gives_label}'." if gives_label else "")
        )
        ok = ask_yes_no(
            f"Does this puzzle step follow everyday cause-and-effect that a "
            f"preschooler (age 3-6) already knows from real life?\n\n"
            f"REAL cause-and-effect examples (answer YES for these patterns):\n"
            f"- Keys open locks\n"
            f"- Batteries power machines\n"
            f"- Tools (wrench, screwdriver) open stuck panels/bolts\n"
            f"- Food feeds hungry animals\n"
            f"- Eggs cook into pancakes on a stove\n"
            f"- Shaped pieces fit into matching shaped slots\n"
            f"- Fish feeds a pelican\n\n"
            f"ABSTRACT/MAGICAL (answer NO):\n"
            f"- A star powers a button (what does that even mean?)\n"
            f"- A crystal activates a portal\n\n"
            f"Step: {description}",
            [],
        )
        if not ok:
            errs.append(f"semantic gate: '{h['needs']}' → '{h['id']}' failed cause-and-effect check")
            print(f"  SEMANTIC GATE FAIL: {h['needs']} → {h['id']} ({description})")
        else:
            print(f"  semantic gate OK: {h['needs']} → {h['id']}")
    return errs


VALID_LANGS = {"ja", "cmn", "yue"}


def _merge_translations(room: dict, rid: str) -> None:
    """Merge ESCAPE_TRANSLATIONS into the generated room dict.

    Room-level nameT and t are copied directly (already lang-first).
    Item t is copied directly ({lang: label}).
    Hotspot t needs transposition from spec shape {field: {lang: value}}
    to manifest shape {lang: {field: value}}.
    """
    trans = ESCAPE_TRANSLATIONS.get(rid)
    if not trans:
        return
    if "nameT" in trans:
        room["nameT"] = trans["nameT"]
    if "t" in trans:
        room["t"] = trans["t"]
    if "items" in trans:
        for item in room["items"]:
            if item["id"] in trans["items"]:
                item["t"] = trans["items"][item["id"]]
    if "hotspots" in trans:
        for hotspot in room["hotspots"]:
            if hotspot["id"] in trans["hotspots"]:
                field_first = trans["hotspots"][hotspot["id"]]
                lang_first: dict[str, dict[str, str]] = {}
                for field, lang_map in field_first.items():
                    for lang, value in lang_map.items():
                        lang_first.setdefault(lang, {})[field] = value
                hotspot["t"] = lang_first


def _assert_t_shape(room: dict) -> None:
    """Validate all t-tables use lang-first shape with keys in VALID_LANGS."""
    if "t" in room:
        bad = set(room["t"].keys()) - VALID_LANGS
        assert not bad, f"room '{room['id']}' t keys {bad} not in {VALID_LANGS}"
    for item in room.get("items", []):
        if "t" in item:
            bad = set(item["t"].keys()) - VALID_LANGS
            assert not bad, f"item '{item['id']}' t keys {bad} not in {VALID_LANGS}"
    for h in room.get("hotspots", []):
        if "t" in h:
            bad = set(h["t"].keys()) - VALID_LANGS
            assert not bad, f"hotspot '{h['id']}' t keys {bad} not in {VALID_LANGS}"


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


def _expanded_mask(box: tuple[int, int, int, int], w_img: int, h_img: int,
                   growth: float = 1.6) -> np.ndarray:
    """Create a boolean mask array expanded to growth × the hotspot box.

    The expansion gives room for open lids, swung gates, steam, and shadow
    skirts that extend beyond the closed-state bounding box.
    """
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


def _gen_state_scene(
    prev_scene: Image.Image,
    room_id: str,
    state_idx: int,
    hid: str,
    box: tuple[int, int, int, int],
    prompt: str,
) -> Image.Image | None:
    """Generate a full-scene state image by editing the previous state.

    Uses nbp.edit with an expanded mask (1.6x box). The result is a full
    1280x720 image where pixels outside the mask are byte-identical to
    prev_scene. Returns the edited Image or None on failure.
    """
    fname = f"{room_id}_s{state_idx}.png"
    if (OUT / fname).exists():
        return Image.open(OUT / fname)

    w_img, h_img = prev_scene.size
    mask = _expanded_mask(box, w_img, h_img, growth=1.6)

    for attempt in range(3):
        try:
            out, inside_ch, drift = edit(prev_scene, mask, prompt)
        except Exception as e:
            print(f"  {room_id}/s{state_idx} ({hid}): state scene attempt {attempt + 1} error: {str(e)[:120]}")
            continue
        if drift > 0.12:
            print(f"  {room_id}/s{state_idx} ({hid}): drift {drift:.2f}, retry {attempt + 1}")
            continue
        if inside_ch < 0.05:
            print(f"  {room_id}/s{state_idx} ({hid}): no change ({inside_ch:.2f}), retry {attempt + 1}")
            continue
        x, y, w, h = box
        pad = int(max(w, h) * 0.3)
        cx0, cy0 = max(0, x - pad), max(0, y - pad)
        cx1, cy1 = min(w_img, x + w + pad), min(h_img, y + h + pad)
        before_crop = prev_scene.crop((cx0, cy0, cx1, cy1))
        after_crop = out.crop((cx0, cy0, cx1, cy1))
        if ask_yes_no(
            f"Two images: the first is BEFORE, the second is AFTER an edit. "
            f"Does the second show a believable '{prompt}'? "
            f"It must look natural with NO rectangular seam, NO clipped/cut-off parts, "
            f"and the area OUTSIDE the edited object must be identical to the first image.",
            [before_crop, after_crop],
        ):
            out.save(OUT / fname)
            print(f"  {room_id}/s{state_idx} ({hid}): state scene saved (ch={inside_ch:.2f} drift={drift:.2f})")
            return out
        print(f"  {room_id}/s{state_idx} ({hid}): judge rejected, retry {attempt + 1}")
    print(f"  {room_id}/s{state_idx} ({hid}): FAILED after 3 attempts")
    return None


def gen_room(spec: dict) -> dict | None:
    rid = spec["id"]
    errs = lint_room(spec)
    if errs:
        print(f"{rid}: LINT FAILED — {'; '.join(errs)}")
        return None

    sem_errs = _semantic_chain_gate(spec)
    if sem_errs:
        print(f"{rid}: SEMANTIC GATE FAILED — {'; '.join(sem_errs)}")
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
        # Some hotspots share a box with another (e.g. a battery slot inside
        # an opened panel) — skip SAM for those and copy later.
        scene = Image.open(scene_path)
        boxes = {}
        share_map = {}
        for h in spec["hotspots"]:
            if h.get("shareBox"):
                share_map[h["id"]] = h["shareBox"]
                continue
            box = _locate_scare(scene, h["spot"], f"{rid}/{h['id']}")
            if box is None:
                break
            boxes[h["id"]] = box
        for hid, src_id in share_map.items():
            if src_id in boxes:
                boxes[hid] = boxes[src_id]
        # Overlap check: exclude pairs that share a box (they're never both
        # interactive at the same time — one is used before the other appears).
        shared_pairs = {(hid, src_id) for hid, src_id in share_map.items()}
        unique_boxes = [boxes[h["id"]] for h in spec["hotspots"]
                        if h["id"] in boxes and h["id"] not in share_map]
        if len(boxes) == len(spec["hotspots"]) and _escape_spots_ok(unique_boxes):
            break
        print(f"  {rid}: {len(boxes)}/{len(spec['hotspots'])} spots located — re-render {attempt + 1}")
        scene_path.unlink(missing_ok=True)
    else:
        print(f"{rid}: FAILED — could not compose a fully-locatable scene")
        return None

    # State-scene chain: generate full-scene images for each state-changing
    # hotspot in chain order. State 0 = base scene; state k = edit of state k-1.
    state_hotspots = [(h, boxes[h["id"]]) for h in spec["hotspots"] if h.get("after")]
    state_scenes: dict[str, str] = {}  # hotspot id → 'escape/<room>_s<k>.png'
    current_scene = scene
    for si, (sh, sbox) in enumerate(state_hotspots, 1):
        result = _gen_state_scene(current_scene, rid, si, sh["id"], sbox, sh["after"])
        if result is not None:
            state_scenes[sh["id"]] = f"escape/{rid}_s{si}.png"
            current_scene = result

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
        if h["id"] in state_scenes:
            entry["afterScene"] = state_scenes[h["id"]]
        hotspots.append(entry)

    print(f"  room {rid} OK ({len(hotspots)} hotspots, {len(state_scenes)} state scenes)")
    room = {
        "id": rid, "name": spec["name"], "level": spec.get("level", "easy"),
        "image": f"escape/{rid}.png", "intro": spec["intro"], "winText": spec["winText"],
        "items": spec["items"], "hotspots": hotspots,
    }
    _merge_translations(room, rid)
    _assert_t_shape(room)
    return room


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
