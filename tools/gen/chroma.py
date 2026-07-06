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
    sprite = _despill_edges(sprite, bg_color)
    return sprite, coverage


def _despill_edges(sprite: Image.Image, bg_color: np.ndarray) -> Image.Image:
    """Kill residual key spill: anti-aliased object/backdrop boundary pixels
    survive the absolute-distance key as darker magenta blends. Any pixel that
    is magenta-HUED (R and B both well above G — legit pinks have G close to
    B) and sits within 2px of transparency is spill, whatever its brightness."""
    from PIL import ImageFilter
    arr = np.asarray(sprite, np.int16).copy()
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    hue = (np.minimum(r, b) > g + 50) & (np.minimum(r, b) > 60)
    near_bg = np.abs(arr[..., :3] - bg_color).sum(-1) < 160
    trans = Image.fromarray(((a < 128) * 255).astype(np.uint8), "L").filter(ImageFilter.MaxFilter(11))
    edge = np.asarray(trans) > 0
    spill = (a > 0) & edge & (hue | near_bg)
    if spill.any():
        arr[spill, 3] = 0
        return Image.fromarray(arr.astype(np.uint8), "RGBA")
    return sprite
