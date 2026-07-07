"""Generate Story Path content: scenes, identity references, jump scares.

Specs live in gen/story_specs.py (data, not code). Per story:
- identity anchor: explicit `ref` (e.g. cast lineup portrait) or the start
  scene; every other node is reference-conditioned on it.
- optional `style` override (e.g. moody nighttime for The Whispering House).
- per-node `scare`: SAM locates the dare-region bbox in the rendered scene;
  the pop sprite renders on magenta with the story reference attached and
  is chroma-keyed. SAM miss => the node ships without a scare (never with a
  misplaced one).

Usage: python3 tools/gen_stories.py [story_id ...]   (resumes from files)
"""

from __future__ import annotations

import io
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gen.chroma import key_out_magenta  # noqa: E402
from gen.judge import ask_yes_no  # noqa: E402
from gen.nbp import _call, generate, generate_with_ref  # noqa: E402
from gen.sam_batch import sam_segment_batch  # noqa: E402
from gen.scenes import SCENE_STYLE  # noqa: E402
from gen.story_specs import (  # noqa: E402
    DEEP_SEA,
    NIGHT_MARKET,
    RAINBOW_DOORS,
    SCARE_SCHOOL,
    SKY_RACE,
    TREASURE_TRAIL,
    WHISPERING_HOUSE,
)
from gen.story_lint import lint_spec  # noqa: E402
from google.genai import types  # noqa: E402
from PIL import Image  # noqa: E402

ROOT = Path(__file__).parent.parent
OUT = ROOT / "assets" / "game" / "story"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"

STORIES = [WHISPERING_HOUSE, SCARE_SCHOOL, RAINBOW_DOORS, TREASURE_TRAIL,
           NIGHT_MARKET, DEEP_SEA, SKY_RACE]


def _story_style(spec: dict) -> str:
    return spec.get("style") or SCENE_STYLE


def _ref_path(spec: dict) -> Path:
    if "ref" in spec:
        return OUT / spec["ref"]["file"]
    return OUT / f"{spec['id']}_start.png"


def _gen_ref(spec: dict) -> None:
    """Render the identity anchor (cast lineup) if the story declares one."""
    if "ref" not in spec:
        return
    path = _ref_path(spec)
    if path.exists():
        print(f"  {spec['id']}/ref: exists, reusing")
        return
    img = None
    for attempt in range(3):
        img = generate(f"{spec['ref']['prompt']}. {_story_style(spec)}", (1280, 720))
        if ask_yes_no(
            "Does this lineup show several DISTINCT cartoon monsters, each fully visible, in a clean artifact-free children's book style with no text?",
            [img],
        ):
            img.save(path)
            print(f"  {spec['id']}/ref: cast lineup OK")
            return
        print(f"  {spec['id']}/ref: judge rejected, retry {attempt + 1}")
    img.save(path)
    print(f"  {spec['id']}/ref: accepting best attempt")


def _gen_pop(spec: dict, nid: str, prompt: str) -> str | None:
    """Transparent pop sprite: magenta render conditioned on the story ref."""
    fname = f"{spec['id']}_{nid}_pop.png"
    if (OUT / fname).exists():
        return f"story/{fname}"
    ref = _ref_path(spec)
    ref_parts = []
    if ref.exists():
        b = io.BytesIO()
        Image.open(ref).convert("RGB").save(b, "PNG")
        ref_parts = [types.Part(text="Reference image (character designs to match exactly):"),
                     types.Part(inline_data=types.Blob(mime_type="image/png", data=b.getvalue()))]
    for attempt in range(3):
        data = _call([types.Content(role="user", parts=[
            *ref_parts,
            types.Part(text=(
                f"Draw {prompt}, matching the reference art style and character designs, as a "
                "single centered figure filling most of the frame, mid-jump-scare pose bursting "
                "toward the viewer, on a plain solid bright magenta background (#FF00FF). "
                "Nothing else in the image. No text.")),
        ])])
        sprite, coverage = key_out_magenta(Image.open(io.BytesIO(data)).convert("RGB"), out_size=512)
        if 0.15 <= coverage <= 0.98 and ask_yes_no(
            f"Is this a single clean cutout of {prompt} on a transparent background — complete, dynamic, no leftover background?",
            [sprite],
        ):
            sprite.save(OUT / fname)
            return f"story/{fname}"
        print(f"  {spec['id']}/{nid}: pop sprite retry {attempt + 1} (cov={coverage:.2f})")
    return None


def _locate_scare(img: Image.Image, spot: str, tag: str) -> tuple[int, int, int, int] | None:
    """SAM finds the dare region; loose gates. Cartoon phrasing often misses
    ("the wobbling supply closet"), so retry with progressively simpler
    noun phrases (last two words, then last word)."""
    words = spot.replace("the ", "").split()
    prompts = [spot]
    if len(words) >= 2:
        prompts.append(" ".join(words[-2:]))
    prompts.append(words[-1])
    try:
        segs = sam_segment_batch(img, list(dict.fromkeys(prompts)), tag=tag)
    except Exception as e:  # noqa: BLE001
        print(f"  {tag}: SAM failed ({str(e)[:100]})")
        return None
    cands = []
    for pr in prompts:
        got = segs.get(pr, [])
        if got and got[0]["score"] >= 0.3:
            cands = got
            break
    if not cands:
        return None
    x0, y0, x1, y1 = cands[0]["bbox"]
    if (x1 - x0) * (y1 - y0) < 2500:
        return None
    pad = 12
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(1280, x1 + pad), min(720, y1 + pad)
    return (x0, y0, x1 - x0, y1 - y0)


def _spots_distinct(boxes: list) -> bool:
    """Hotspots must be separately tappable: no overlap (16px pad), centers
    well apart, and neither so huge it swallows the scene."""
    for bx in boxes:
        if bx[2] * bx[3] > 0.30 * 1280 * 720:
            return False
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            (ax, ay, aw, ah), (bx, by, bw, bh) = boxes[i], boxes[j]
            pad = 16
            if not (ax - pad > bx + bw or bx - pad > ax + aw or ay - pad > by + bh or by - pad > ay + ah):
                return False
            acx, acy = ax + aw / 2, ay + ah / 2
            bcx, bcy = bx + bw / 2, by + bh / 2
            if ((acx - bcx) ** 2 + (acy - bcy) ** 2) ** 0.5 < 240:
                return False
    return True


def _gen_node(spec: dict, nid: str, n: dict) -> dict:
    fname = f"{spec['id']}_{nid}.png"
    ref = _ref_path(spec)
    if (OUT / fname).exists():
        print(f"  {spec['id']}/{nid}: scene exists, reusing")
    else:
        best = None
        use_ref = ref.exists() and not (nid == "start" and "ref" not in spec)
        for attempt in range(3):
            if use_ref:
                img = generate_with_ref(
                    f"{n['scene']}. Characters must look IDENTICAL to the reference image — "
                    f"same faces, colors, markings, proportions. The hero appears EXACTLY "
                    f"ONCE in the scene — never duplicated. {_story_style(spec)}",
                    ref, (1280, 720))
            else:
                img = generate(f"{n['scene']}. {_story_style(spec)}", (1280, 720))
            best = img
            if ask_yes_no(
                f"Is this a charming, artifact-free children's book illustration with no text, showing {spec['character'].split(',')[0]} exactly ONCE (a single hero, not duplicated)?",
                [img],
            ):
                break
            print(f"  {spec['id']}/{nid}: judge rejected, retry {attempt + 1}")
        else:
            print(f"  {spec['id']}/{nid}: accepting best attempt despite judge")
        best.save(OUT / fname)

    entry: dict = {"image": f"story/{fname}", "text": n["text"]}
    if "choices" in n:
        chs = [{"label": c["label"], "next": c["next"], **({"icon": c["icon"]} if c.get("icon") else {})}
               for c in n["choices"]]
        # hotspot choices: SAM locates each declared spot IN the scene so the
        # kid taps the door itself. All-or-nothing per node — one missing or
        # ambiguous spot means the node falls back to buttons, never to a
        # lopsided half-hotspot UI.
        spots = [c.get("spot") for c in n["choices"]]
        if all(spots):
            scene_img = Image.open(OUT / fname)
            boxes = [_locate_scare(scene_img, s, f"{spec['id']}/{nid}/c{i}")
                     for i, s in enumerate(spots)]
            if all(boxes) and _spots_distinct(boxes):
                for c, b in zip(chs, boxes):
                    c["hot"] = {"x": b[0], "y": b[1], "w": b[2], "h": b[3]}
                print(f"  {spec['id']}/{nid}: hotspots wired {boxes}")
            else:
                print(f"  {spec['id']}/{nid}: hotspots DROPPED (missing/overlapping) — buttons fallback")
        entry["choices"] = chs

    if "scare" in n:
        sc = n["scare"]
        scene_img = Image.open(OUT / fname)
        box = _locate_scare(scene_img, sc["spot"], f"{spec['id']}/{nid}")
        pop = _gen_pop(spec, nid, sc["pop"]) if box else None
        if box and pop:
            entry["scare"] = {"x": box[0], "y": box[1], "w": box[2], "h": box[3],
                              "pop": pop, "sting": sc["sting"],
                              "reveal": sc["reveal"], "delay": sc["delay"]}
            print(f"  {spec['id']}/{nid}: scare wired at {box}")
        else:
            print(f"  {spec['id']}/{nid}: scare DROPPED (spot not locatable) — node ships without it")
    print(f"  story {spec['id']}/{nid} OK")
    return entry


def gen_story(spec: dict) -> dict:
    OUT.mkdir(parents=True, exist_ok=True)
    _gen_ref(spec)
    # the anchor scene renders first, everything else fans out
    entries = {"start": _gen_node(spec, "start", spec["nodes"]["start"])}
    rest = [(nid, n) for nid, n in spec["nodes"].items() if nid != "start"]
    with ThreadPoolExecutor(3) as ex:
        results = list(ex.map(lambda kv: (kv[0], _gen_node(spec, kv[0], kv[1])), rest))
    entries.update(dict(results))
    return {"id": spec["id"], "title": spec["title"], "nodes": entries}


def main() -> None:
    only = set(sys.argv[1:])
    for spec in STORIES:
        if only and spec["id"] not in only:
            continue
        cur = json.loads(MANIFEST.read_text())
        if any(s["id"] == spec["id"] for s in cur.get("stories", [])):
            print(f"{spec['id']}: already present, skipping")
            continue
        hard = [e for e in lint_spec(spec) if not e.startswith("warn:")]
        if hard:
            print(f"{spec['id']}: SPEC LINT FAILED — fix before generating:")
            for e in hard:
                print(f"  - {e}")
            continue
        got = gen_story(spec)
        cur = json.loads(MANIFEST.read_text())
        cur.setdefault("stories", [])
        cur["stories"] = [s for s in cur["stories"] if s["id"] != got["id"]] + [got]
        MANIFEST.write_text(json.dumps(cur, indent=2) + "\n")
        print(f"story {spec['id']} saved ({len(got['nodes'])} nodes)")


if __name__ == "__main__":
    main()
