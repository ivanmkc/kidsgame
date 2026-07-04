"""Precompute silhouette PNGs (alpha -> solid plum) for icons and thumbs.

react-native-web implements Image tintColor as a CSS mask that can stretch
or crop sprites (the truncated-fish bug) — precomputed shadows sidestep the
whole quirk class.
"""

from pathlib import Path

import numpy as np
from PIL import Image

ASSETS = Path(__file__).parent.parent / "assets" / "game"
PLUM = (75, 58, 87)


def shadow_of(src: Path) -> None:
    dst = src.with_name(src.stem + "_shadow.png")
    img = np.asarray(Image.open(src).convert("RGBA"))
    out = np.zeros_like(img)
    out[..., 0], out[..., 1], out[..., 2] = PLUM
    out[..., 3] = img[..., 3]
    Image.fromarray(out, "RGBA").save(dst)


def main() -> None:
    n = 0
    for d, pattern in ((ASSETS / "spotit", "*.png"),):
        for f in sorted(d.glob(pattern)):
            if f.stem.endswith("_shadow"):
                continue
            shadow_of(f)
            n += 1
    print(f"{n} shadows written")


if __name__ == "__main__":
    main()
