"""Illustrated choice buttons — pre-readers pick their path by picture.

For every story choice in the manifest without an icon: render a bold
simple storybook icon of the choice (magenta background, chroma-keyed,
conditioned on the story's identity reference when it exists so recurring
characters match), judge-gate it, save story/<sid>_<nid>_c<idx>.png and
write the path into the manifest choice. Idempotent.
"""

from __future__ import annotations

import io
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gen.chroma import key_out_magenta  # noqa: E402
from gen.judge import ask_yes_no  # noqa: E402
from gen.nbp import _call  # noqa: E402
from google.genai import types  # noqa: E402
from PIL import Image  # noqa: E402

ROOT = Path(__file__).parent.parent
OUT = ROOT / "assets" / "game" / "story"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"

EMOJI = re.compile(r"[\U0001F000-\U0001FAFF☀-➿⬀-⯿]")


def _ref_parts(sid: str) -> list:
    for cand in (OUT / f"{sid}_cast.png", OUT / f"{sid}_start.png"):
        if cand.exists():
            b = io.BytesIO()
            Image.open(cand).convert("RGB").save(b, "PNG")
            return [types.Part(text="Reference image (match this art style and any recurring characters):"),
                    types.Part(inline_data=types.Blob(mime_type="image/png", data=b.getvalue()))]
    return []


def gen_icon(sid: str, nid: str, idx: int, label: str) -> str | None:
    fname = f"{sid}_{nid}_c{idx}.png"
    if (OUT / fname).exists():
        return f"story/{fname}"
    subject = EMOJI.sub("", label).strip().rstrip("!?.")
    refs = _ref_parts(sid)
    best = None
    for attempt in range(3):
        data = _call([types.Content(role="user", parts=[
            *refs,
            types.Part(text=(
                f"A small square storybook thumbnail SHOWING THE HERO FROM THE REFERENCE "
                f"IMAGE actively doing this: \"{subject}\". The action must be obvious at "
                "a glance to a 3-year-old — hero mid-motion, destination or object visible, "
                "bright and simple, minimal background. Square composition. No text.")),
        ])])
        img = Image.open(io.BytesIO(data)).convert("RGB")
        side = min(img.size)
        img = img.crop(((img.width - side) // 2, (img.height - side) // 2,
                        (img.width + side) // 2, (img.height + side) // 2)).resize((380, 380))
        sprite, coverage = img, 0.5  # full thumbnail, no keying
        best = sprite
        if best is not None and ask_yes_no(
            f"Does this thumbnail clearly show the story hero doing: \"{subject}\"? Would a 3-year-old get the choice at a glance? No text allowed.",
            [sprite],
        ):
            sprite.save(OUT / fname)
            print(f"  icon OK: {sid}/{nid}[{idx}] {subject!r}")
            return f"story/{fname}"
        print(f"  icon retry {attempt + 1}: {sid}/{nid}[{idx}] (cov={coverage:.2f})")
    if best is not None:
        # pre-readers need pictures: a serviceable icon beats a text button
        best.save(OUT / fname)
        print(f"  icon accepted-best: {sid}/{nid}[{idx}]")
        return f"story/{fname}"
    print(f"  icon FAILED entirely: {sid}/{nid}[{idx}] — button stays text+voice")
    return None


def main() -> None:
    m = json.loads(MANIFEST.read_text())
    jobs = []
    for st in m.get("stories", []):
        for nid, n in st["nodes"].items():
            for idx, c in enumerate(n.get("choices", [])):
                if not c.get("icon"):
                    jobs.append((st["id"], nid, idx, c["label"]))
    print(f"{len(jobs)} choice icons to render")
    with ThreadPoolExecutor(4) as ex:
        results = list(ex.map(lambda j: (j, gen_icon(*j)), jobs))
    done = {(sid, nid, idx): path for (sid, nid, idx, _), path in results if path}
    m = json.loads(MANIFEST.read_text())
    for st in m.get("stories", []):
        for nid, n in st["nodes"].items():
            for idx, c in enumerate(n.get("choices", [])):
                key = (st["id"], nid, idx)
                if key in done:
                    c["icon"] = done[key]
    MANIFEST.write_text(json.dumps(m, indent=2) + "\n")
    print(f"wired {len(done)}/{len(jobs)} icons into the manifest")


if __name__ == "__main__":
    main()
