"""Spot It icon sprites: 31 stickers, chroma-keyed to transparent RGBA.

Order MUST match the game's symbol indices (src/games/spotit/logic.ts).
"""

from __future__ import annotations

from pathlib import Path

from .chroma import key_out_magenta
from .judge import ask_yes_no
from .nbp import generate

# index-aligned with the emoji list the game logic was built on
ICONS = [
    ("dog", "a happy puppy dog face"),
    ("cat", "a cute cat face"),
    ("lion", "a friendly lion face with a fluffy mane"),
    ("frog", "a smiling green frog face"),
    ("panda", "a panda bear face"),
    ("fox", "an orange fox face"),
    ("monkey", "a cheeky monkey face"),
    ("pig", "a pink pig face"),
    ("rabbit", "a white rabbit face with long ears"),
    ("koala", "a grey koala face"),
    ("unicorn", "a magical unicorn head with rainbow mane"),
    ("octopus", "a friendly teal-blue octopus"),
    ("crab", "a red crab with big claws"),
    ("fish", "a colorful tropical fish"),
    ("butterfly", "a butterfly with orange wings"),
    ("ladybug", "a red ladybug with black dots"),
    ("blossom", "a pink cherry blossom flower"),
    ("sunflower", "a bright yellow sunflower"),
    ("apple", "a shiny red apple"),
    ("banana", "a yellow banana"),
    ("strawberry", "a red strawberry"),
    ("pizza", "a slice of cheese pizza"),
    ("icecream", "an ice cream cone with a pink scoop"),
    ("balloon", "a red party balloon on a string"),
    ("car", "a little red car"),
    ("plane", "a small blue airplane"),
    ("rocket", "a cartoon space rocket"),
    ("soccer", "a black and white soccer ball"),
    ("rainbow", "a rainbow with two small clouds"),
    ("star", "a golden five-pointed star with a smiling face"),
    ("gift", "a wrapped gift box with a bow"),
]

STYLE = (
    "Cheerful cartoon sticker for a toddler's game, bold black outline, flat "
    "bright colors, thick white sticker border, centered, fills most of the "
    "frame, on a plain solid bright magenta background (#FF00FF). "
    "Children's book style. No text, no watermark, single object only."
)


def gen_icon(name: str, desc: str, out_dir: Path, attempts: int = 3) -> bool:
    out = out_dir / f"{name}.png"
    if out.exists():
        return True
    for i in range(attempts):
        img = generate(f"{desc}. {STYLE}", (768, 768))
        sprite, coverage = key_out_magenta(img, out_size=256)
        if not (0.15 <= coverage <= 0.98):
            print(f"  {name}: coverage {coverage:.2f} out of range, retry {i + 1}")
            continue
        if not ask_yes_no(
            f"Is this a single cartoon {desc.split(',')[0]} sticker on a transparent/plain background, suitable for a children's game?",
            [sprite],
        ):
            print(f"  {name}: judge rejected, retry {i + 1}")
            continue
        sprite.save(out)
        print(f"  icon OK: {name} (coverage {coverage:.2f})")
        return True
    print(f"  FAIL icon {name} after {attempts} attempts")
    return False
