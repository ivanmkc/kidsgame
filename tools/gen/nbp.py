"""Nano Banana Pro (gemini-3-pro-image-preview) via Vertex ADC.

Generation + mask-constrained edit with composite-within-mask: NBP
regenerates the whole frame on edits, so edited pixels are only accepted
inside the mask — everything outside stays pixel-identical to the base.
That guarantee is what makes diff regions exact gameplay hitboxes.
"""

from __future__ import annotations

import io
import sys
import threading
import time

import numpy as np
from PIL import Image
from google import genai
from google.genai import types

PROJECT = "adk-coding-agents"
LOCATION = "global"
NBP_MODEL = "gemini-3-pro-image-preview"

# google-genai's underlying HTTP client is not safe to share across threads
# (concurrent use surfaces as "Cannot send a request, as the client has been
# closed") — keep one client per thread and reset on failure.
_tls = threading.local()


def client() -> genai.Client:
    if getattr(_tls, "client", None) is None:
        _tls.client = genai.Client(vertexai=True, project=PROJECT, location=LOCATION)
    return _tls.client


def reset_client() -> None:
    _tls.client = None


def _first_image(resp) -> bytes | None:
    for c in getattr(resp, "candidates", None) or []:
        content = getattr(c, "content", None)
        for p in getattr(content, "parts", None) or []:
            inline = getattr(p, "inline_data", None)
            if inline and getattr(inline, "mime_type", "").startswith("image/") and inline.data:
                return inline.data
    return None


def _call(contents, attempts: int = 4) -> bytes:
    last = None
    for i in range(attempts):
        try:
            resp = client().models.generate_content(
                model=NBP_MODEL,
                contents=contents,
                config=types.GenerateContentConfig(response_modalities=["IMAGE", "TEXT"]),
            )
            data = _first_image(resp)
            if data:
                return data
            last = RuntimeError("no image in response (content filter?)")
        except Exception as e:  # noqa: BLE001 — retry any transient API error
            last = e
            reset_client()
        wait = 5 * (i + 1)
        print(f"  WARN nbp attempt {i + 1} failed ({type(last).__name__}: {str(last)[:120]}); retry in {wait}s", file=sys.stderr)
        time.sleep(wait)
    raise RuntimeError(f"NBP failed after {attempts} attempts: {last}")


def generate(prompt: str, size: tuple[int, int]) -> Image.Image:
    """Text -> RGB image, normalized to `size`."""
    data = _call([prompt])
    img = Image.open(io.BytesIO(data)).convert("RGB")
    return img.resize(size, Image.Resampling.LANCZOS) if img.size != size else img


def edit(base: Image.Image, mask: np.ndarray, prompt: str) -> tuple[Image.Image, float, float]:
    """Masked edit. mask: bool array HxW, True = editable.

    Returns (composited image, inside_change, outside_change) where the
    change values are the fraction of pixels the model altered inside /
    outside the mask. A high outside_change means the model re-rendered the
    scene instead of editing it — callers must reject those, because the
    content pasted into the mask then comes from a DIFFERENT rendering and
    won't blend with its surroundings, even though the composite still
    guarantees pixel-identity outside the mask.
    """
    mask_img = Image.fromarray((mask * 255).astype(np.uint8)).convert("RGB")

    def png(im: Image.Image) -> bytes:
        buf = io.BytesIO()
        im.save(buf, "PNG")
        return buf.getvalue()

    parts = [
        types.Part(text="Source image (the image you are editing):"),
        types.Part(inline_data=types.Blob(mime_type="image/png", data=png(base))),
        types.Part(text="Mask image (white = area to edit, black = preserve):"),
        types.Part(inline_data=types.Blob(mime_type="image/png", data=png(mask_img))),
        types.Part(text=(
            "Edit the source image so that ONLY the area marked white in the mask "
            "image changes. Pixels marked black in the mask must remain pixel-"
            "identical to the source. Keep the exact same art style, palette and "
            "lighting as the rest of the image. The masked region should depict: "
            + prompt
        )),
    ]
    data = _call([types.Content(role="user", parts=parts)])
    out = Image.open(io.BytesIO(data)).convert("RGB")
    if out.size != base.size:
        out = out.resize(base.size, Image.Resampling.LANCZOS)

    b = np.asarray(base, np.int16)
    o = np.asarray(out, np.int16)
    diff = np.abs(o - b).sum(-1)
    changed_inside = float((diff[mask] > 30).mean()) if mask.any() else 0.0

    # Drift (re-render detection) is measured on blurred downsampled copies:
    # when NBP returns a different resolution, resizing back shifts every
    # fine edge, and a raw pixel diff reads 10-20% even for a faithful edit.
    # Downsampling washes that out; a genuine re-render still lights up.
    from PIL import ImageFilter
    small = (max(1, base.width // 8), max(1, base.height // 8))
    b_s = np.asarray(base.filter(ImageFilter.GaussianBlur(3)).resize(small), np.int16)
    o_s = np.asarray(out.filter(ImageFilter.GaussianBlur(3)).resize(small), np.int16)
    diff_s = np.abs(o_s - b_s).sum(-1)
    mask_s = np.asarray(Image.fromarray((mask * 255).astype(np.uint8), "L").resize(small)) > 127
    changed_outside = float((diff_s[~mask_s] > 45).mean()) if (~mask_s).any() else 0.0

    # Feathered composite: soften the mask boundary so the accepted edit
    # blends instead of showing a hard rectangle seam.
    m_img = Image.fromarray((mask * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(4))
    m = np.asarray(m_img, np.float32)[..., None] / 255.0
    comp = b.astype(np.float32) * (1 - m) + o.astype(np.float32) * m
    return Image.fromarray(comp.clip(0, 255).astype(np.uint8)), changed_inside, changed_outside


def edit_local(
    base: Image.Image,
    rect: tuple[int, int, int, int],
    prompt: str,
    ctx: int = 110,
) -> tuple[Image.Image, float, float]:
    """Patch-local masked edit: the model only ever sees a padded crop around
    `rect`, so a "re-render" can at worst re-render the patch — the rest of
    the scene is untouched by construction. Far more reliable than full-frame
    edits, where NBP sometimes moves objects elsewhere in the scene and slips
    under any global drift gate.

    Returns (new full image, inside_change, drift) where drift is measured on
    the crop's context ring.
    """
    x, y, w, h = rect
    W, H = base.size
    cx0, cy0 = max(0, x - ctx), max(0, y - ctx)
    cx1, cy1 = min(W, x + w + ctx), min(H, y + h + ctx)
    crop = base.crop((cx0, cy0, cx1, cy1))

    mask = np.zeros((cy1 - cy0, cx1 - cx0), bool)
    mask[y - cy0:y - cy0 + h, x - cx0:x - cx0 + w] = True

    edited_crop, inside, drift = edit(crop, mask, prompt)

    out = base.copy()
    out.paste(edited_crop, (cx0, cy0))
    return out, inside, drift
