"""Convert opaque scene PNGs to JPEG and rewrite manifest paths.

Icons and the logo keep PNG (they need alpha); scenes/thumbs/menu bg don't.
Run after generate_assets.py, before gen_images_ts.mjs.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).parent.parent
ASSETS = ROOT / "assets" / "game"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"
QUALITY = 85


def to_jpg(rel: str) -> str:
    """Convert one asset (manifest-relative path) to JPEG; return new rel path."""
    src = ASSETS / rel
    if not src.exists():  # already converted in a previous run
        return rel if rel.endswith(".jpg") else rel[: rel.rfind(".")] + ".jpg"
    dst = src.with_suffix(".jpg")
    Image.open(src).convert("RGB").save(dst, "JPEG", quality=QUALITY, optimize=True)
    src.unlink()
    return str(Path(rel).with_suffix(".jpg"))


def main() -> None:
    m = json.loads(MANIFEST.read_text())
    for d in m["diff"]:
        d["imageA"] = to_jpg(d["imageA"])
        d["imageB"] = to_jpg(d["imageB"])
    for h in m["hidden"]:
        h["image"] = to_jpg(h["image"])
        # thumbs are RGBA cutouts — they must stay PNG (alpha)
    MANIFEST.write_text(json.dumps(m, indent=2) + "\n")

    bg = ASSETS / "ui" / "menu_bg.png"
    if bg.exists():
        Image.open(bg).convert("RGB").save(bg.with_suffix(".jpg"), "JPEG", quality=QUALITY, optimize=True)
        bg.unlink()

    total = sum(f.stat().st_size for f in ASSETS.rglob("*") if f.is_file())
    print(f"compressed; assets/game total = {total / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
