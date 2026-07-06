"""Chroma-key magenta-background stickers into trimmed RGBA sprites."""

from __future__ import annotations

import numpy as np
from PIL import Image


def resize_rgba(canvas: np.ndarray, out_size: int) -> Image.Image:
    """LANCZOS-resize RGBA without color bleed: a plain resize blends the RGB
    of TRANSPARENT pixels (leftover backdrop/black padding) into opaque edge
    pixels — premultiply alpha first, unpremultiply after."""
    arr = canvas.astype(np.float32)
    a = arr[..., 3:4] / 255.0
    pre = np.concatenate([arr[..., :3] * a, arr[..., 3:4]], axis=-1).astype(np.uint8)
    img = Image.fromarray(pre, "RGBA").resize((out_size, out_size), Image.Resampling.LANCZOS)
    out = np.asarray(img, np.float32)
    a2 = out[..., 3:4]
    rgb = np.clip(out[..., :3] * 255.0 / np.maximum(a2, 1e-3), 0, 255)
    return Image.fromarray(np.concatenate([rgb, a2], axis=-1).astype(np.uint8), "RGBA")


def key_out_magenta(img: Image.Image, out_size: int = 256) -> tuple[Image.Image, float]:
    """Remove the magenta backdrop, trim to content, pad square, resize.

    Returns (rgba sprite, alpha coverage fraction of the trimmed box).
    """
    rgb = np.asarray(img.convert("RGB"), np.int16)
    # Key on the actual backdrop color: NBP doesn't always render the exact
    # magenta we ask for (darker pinks, crimsons), so sample the border and
    # remove everything close to its median color.
    border = np.concatenate([
        rgb[0, :], rgb[-1, :], rgb[:, 0], rgb[:, -1],
        rgb[1, :], rgb[-2, :], rgb[:, 1], rgb[:, -2],
    ])
    bg_color = np.median(border, axis=0)
    dist = np.abs(rgb - bg_color).sum(-1)
    bg = dist < 120
    alpha = np.where(bg, 0, 255).astype(np.uint8)

    # de-fringe: shrink alpha 1px so magenta halo pixels drop out
    from PIL import ImageFilter
    a_img = Image.fromarray(alpha, "L").filter(ImageFilter.MinFilter(3))
    alpha = np.asarray(a_img)

    ys, xs = np.where(alpha > 0)
    if len(xs) == 0:
        return Image.new("RGBA", (out_size, out_size), (0, 0, 0, 0)), 0.0
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1

    rgba = np.dstack([rgb.astype(np.uint8), alpha])[y0:y1, x0:x1]
    h, w = rgba.shape[:2]
    side = max(h, w)
    canvas = np.zeros((side, side, 4), np.uint8)
    oy, ox = (side - h) // 2, (side - w) // 2
    canvas[oy:oy + h, ox:ox + w] = rgba
    coverage = float((rgba[..., 3] > 0).mean())
    sprite = resize_rgba(canvas, out_size)
    # post-resize guard: any surviving pixel still near the backdrop color is
    # spill — drop it (legit pinks sit far from the sampled backdrop median)
    arr = np.asarray(sprite, np.int16)
    spill = (arr[..., 3] > 0) & (np.abs(arr[..., :3] - bg_color).sum(-1) < 140)
    if spill.any():
        arr = arr.copy()
        arr[spill, 3] = 0
        sprite = Image.fromarray(arr.astype(np.uint8), "RGBA")
    return sprite, coverage
