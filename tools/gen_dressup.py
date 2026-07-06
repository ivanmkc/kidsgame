"""Dress-up sticker pack: clothes and accessories for Sticker Party.

Sticker Party had only game icons — no dresses, crowns, or wings. Each
item renders on magenta, chroma-keys to a transparent sticker, and is
judge-gated. Writes manifest['dressup'] = [names]. Idempotent.
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
from gen.nbp import _call  # noqa: E402
from google.genai import types  # noqa: E402
from PIL import Image  # noqa: E402

ROOT = Path(__file__).parent.parent
OUT = ROOT / "assets" / "game" / "dressup"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"

ITEMS = [
    ("dress_pink", "a sparkly pink princess ball gown"),
    ("dress_blue", "a flowing ice-blue princess dress"),
    ("tutu", "a fluffy purple ballet tutu"),
    ("crown", "a golden crown with colorful jewels"),
    ("tiara", "a delicate silver tiara with a pink gem"),
    ("wizard_hat", "a starry blue wizard hat"),
    ("sun_hat", "a floppy yellow sun hat with a ribbon"),
    ("wings_fairy", "shimmering fairy wings"),
    ("wings_butterfly", "colorful butterfly wings"),
    ("cape", "a red superhero cape"),
    ("sunglasses", "heart-shaped pink sunglasses"),
    ("bowtie", "a big red polka-dot bow tie"),
    ("necklace", "a pearl necklace with a heart pendant"),
    ("boots", "sparkly rainbow boots"),
    ("wand", "a star-tipped magic wand with ribbons"),
    ("umbrella", "a tiny rainbow umbrella"),
]


def gen_item(job: tuple[str, str]) -> str | None:
    name, desc = job
    fname = f"{name}.png"
    if (OUT / fname).exists():
        return name
    best = None
    for attempt in range(3):
        data = _call([types.Content(role="user", parts=[types.Part(text=(
            f"A single {desc}, drawn as a cute children's sticker in a bright storybook "
            "style, centered, filling most of the frame, on a plain solid bright magenta "
            "background (#FF00FF). Nothing else. No text, no characters wearing it — just "
            "the item itself."))])])
        sprite, coverage = key_out_magenta(Image.open(io.BytesIO(data)).convert("RGB"), out_size=256)
        if 0.12 <= coverage <= 0.95:
            best = sprite
        if best is not None and ask_yes_no(
            f"Is this a single clean sticker of {desc} on a transparent background, no text, no character?",
            [sprite],
        ):
            sprite.save(OUT / fname)
            print(f"  dressup OK: {name}")
            return name
        print(f"  dressup retry {attempt + 1}: {name} (cov={coverage:.2f})")
    if best is not None:
        best.save(OUT / fname)
        print(f"  dressup accepted-best: {name}")
        return name
    return None


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(4) as ex:
        results = [r for r in ex.map(gen_item, ITEMS) if r]
    m = json.loads(MANIFEST.read_text())
    m["dressup"] = [name for name, _ in ITEMS if name in set(results)]
    MANIFEST.write_text(json.dumps(m, indent=2) + "\n")
    print(f"dressup pack: {len(results)}/{len(ITEMS)}")


if __name__ == "__main__":
    main()
