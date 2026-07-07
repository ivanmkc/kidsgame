"""kgb-magic: AI sticker "wear-it" inpainting service.

POST /wear { image_url, x, y, item } -> { ok, image_b64 | reason, meta }
Client drops a dress-up sticker onto a scene; server returns the scene
with the target character actually WEARING the item (inpainted), not an
overlay.

Recipe (mirrors tools/gen/nbp.py::edit_local):
  1. Fetch scene (cap 8MB, image/* content-type).
  2. Crop ~460px padded square around the drop point (clamped).
  3. Send the crop + reference-image prompt to Nano Banana Pro
     (gemini-3-pro-image-preview) — no SAM here, so it's a full-crop
     regen with strict same-pose/same-style instructions.
  4. Judge once with gemini-2.5-flash: character clearly wearing item,
     style preserved, no artifacts/text? On reject retry NBP once, then
     give up.
  5. Paste the edited crop back into the full frame, return PNG b64.
"""
from __future__ import annotations

import base64
import io
import os
import sys
import threading
import time

import requests
from flask import Flask, jsonify, request
from google import genai
from google.genai import types
from PIL import Image

PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "adk-coding-agents")
LOCATION = "global"
NBP_MODEL = "gemini-3-pro-image-preview"
JUDGE_MODEL = "gemini-2.5-flash"

CROP_SIZE = 460          # square side, px, in the scene's pixel space
FETCH_BYTES_CAP = 8 * 1024 * 1024
FETCH_TIMEOUT_S = 15

# google-genai's HTTP client is not thread-safe (Cloud Run uses gunicorn
# with worker threads) — one client per thread, reset on failure.
_tls = threading.local()


def _client() -> genai.Client:
    if getattr(_tls, "client", None) is None:
        _tls.client = genai.Client(vertexai=True, project=PROJECT, location=LOCATION)
    return _tls.client


def _reset_client() -> None:
    _tls.client = None


app = Flask(__name__)


# ---------- CORS ----------
def _cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Max-Age"] = "3600"
    return resp


@app.after_request
def _after(resp):
    return _cors(resp)


# ---------- helpers ----------
def _png_bytes(im: Image.Image) -> bytes:
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


def _first_image(resp) -> bytes | None:
    for c in getattr(resp, "candidates", None) or []:
        content = getattr(c, "content", None)
        for p in getattr(content, "parts", None) or []:
            inline = getattr(p, "inline_data", None)
            if inline and getattr(inline, "mime_type", "").startswith("image/") and inline.data:
                return inline.data
    return None


def _fetch_image(url: str) -> Image.Image:
    """GET url with size + content-type guards."""
    if not (url.startswith("https://") or url.startswith("http://")):
        raise ValueError("image_url must be http(s)")
    with requests.get(url, stream=True, timeout=FETCH_TIMEOUT_S) as r:
        r.raise_for_status()
        ct = (r.headers.get("content-type") or "").lower()
        if not ct.startswith("image/"):
            raise ValueError(f"content-type not image: {ct!r}")
        cl = r.headers.get("content-length")
        if cl and int(cl) > FETCH_BYTES_CAP:
            raise ValueError(f"image too large: {cl} bytes")
        buf = io.BytesIO()
        for chunk in r.iter_content(64 * 1024):
            buf.write(chunk)
            if buf.tell() > FETCH_BYTES_CAP:
                raise ValueError(f"image exceeds cap {FETCH_BYTES_CAP}")
        buf.seek(0)
        return Image.open(buf).convert("RGB")


def _crop_around(im: Image.Image, x: float, y: float, size: int) -> tuple[Image.Image, tuple[int, int, int, int]]:
    """Return (crop, (x0,y0,x1,y1) in scene coords). Square, clamped."""
    W, H = im.size
    px, py = int(round(x * W)), int(round(y * H))
    half = size // 2
    x0 = max(0, min(W - size, px - half)) if W >= size else 0
    y0 = max(0, min(H - size, py - half)) if H >= size else 0
    x1 = min(W, x0 + size)
    y1 = min(H, y0 + size)
    return im.crop((x0, y0, x1, y1)), (x0, y0, x1, y1)


# ---------- NBP + judge ----------
def _wear_prompt(item: str) -> str:
    return (
        f"Edit this image: the main character shown here is now WEARING {item}, "
        f"fitted naturally to their head, face or body (choose the anatomically "
        f"correct placement for {item}). Keep the EXACT same character, same "
        f"pose, same facial expression, same art style, same colors, same "
        f"lighting, same background. Do not move the character. Do not add or "
        f"remove any other objects. Do not add any text, letters, labels or "
        f"watermarks. The {item} must look painted into the scene in the same "
        f"cartoon style — not a photo, not an overlay, not a sticker."
    )


def _nbp_edit(crop: Image.Image, item: str, attempts: int = 4) -> Image.Image:
    """Reference-image edit: crop is the input, prompt asks for the item."""
    parts = [
        types.Part(text="Source image (edit this scene):"),
        types.Part(inline_data=types.Blob(mime_type="image/png", data=_png_bytes(crop))),
        types.Part(text=_wear_prompt(item)),
    ]
    contents = [types.Content(role="user", parts=parts)]
    last: Exception | None = None
    for i in range(attempts):
        try:
            resp = _client().models.generate_content(
                model=NBP_MODEL,
                contents=contents,
                config=types.GenerateContentConfig(response_modalities=["IMAGE", "TEXT"]),
            )
            data = _first_image(resp)
            if data:
                out = Image.open(io.BytesIO(data)).convert("RGB")
                # NBP sometimes returns 1.8:1; snap back to the input square.
                if out.size != crop.size:
                    out = _center_crop_resize(out, crop.size)
                return out
            last = RuntimeError("no image in NBP response (content filter?)")
        except Exception as e:  # noqa: BLE001
            last = e
            _reset_client()
        wait = 3 * (i + 1)
        print(f"  WARN nbp attempt {i + 1} failed ({type(last).__name__}: {str(last)[:120]}); retry in {wait}s", file=sys.stderr, flush=True)
        time.sleep(wait)
    raise RuntimeError(f"NBP failed after {attempts} attempts: {last}")


def _center_crop_resize(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    tw, th = size
    target = tw / th
    w, h = im.size
    ar = w / h
    if abs(ar - target) > 0.01:
        if ar > target:
            nw = int(h * target)
            x0 = (w - nw) // 2
            im = im.crop((x0, 0, x0 + nw, h))
        else:
            nh = int(w / target)
            y0 = (h - nh) // 2
            im = im.crop((0, y0, w, y0 + nh))
    return im.resize(size, Image.Resampling.LANCZOS) if im.size != size else im


def _judge_wearing(before: Image.Image, after: Image.Image, item: str) -> bool:
    """Yes/no: does `after` show the same character clearly wearing `item`,
    style preserved, no artifacts? Uses two Flash images side by side."""
    q = (
        "Two images of the same cartoon scene: BEFORE (image 1) and AFTER "
        f"(image 2) an edit intended to put '{item}' on the main character.\n"
        f"Does image 2 show: (a) the SAME main character as image 1, in the "
        f"same pose; (b) that character CLEARLY wearing {item}, placed "
        f"anatomically correctly; (c) same cartoon art style as image 1; "
        f"(d) no visible text/letters/watermarks; (e) no obvious visual "
        f"artifacts or half-drawn parts?\n"
        "Answer with exactly one word: YES or NO."
    )
    parts = [
        types.Part(inline_data=types.Blob(mime_type="image/png", data=_png_bytes(before))),
        types.Part(inline_data=types.Blob(mime_type="image/png", data=_png_bytes(after))),
        types.Part(text=q),
    ]
    for i in range(3):
        try:
            resp = _client().models.generate_content(
                model=JUDGE_MODEL,
                contents=[types.Content(role="user", parts=parts)],
            )
            text = (resp.text or "").strip().upper()
            if "YES" in text[:12]:
                return True
            if "NO" in text[:12]:
                return False
        except Exception as e:  # noqa: BLE001
            print(f"  WARN judge attempt {i + 1}: {type(e).__name__} {str(e)[:100]}", file=sys.stderr, flush=True)
            _reset_client()
            time.sleep(2 * (i + 1))
    return False  # fail closed: unreadable judge = reject


# ---------- HTTP ----------
@app.route("/wear", methods=["POST", "OPTIONS"])
def wear():
    if request.method == "OPTIONS":
        return _cors(app.response_class(status=204))

    t0 = time.time()
    try:
        p = request.get_json(force=True, silent=False) or {}
    except Exception as e:  # noqa: BLE001
        return jsonify(ok=False, reason=f"bad json: {e}"), 400

    image_url = p.get("image_url")
    x_in = p.get("x")
    y_in = p.get("y")
    item = p.get("item")
    if not isinstance(image_url, str) or not isinstance(item, str) or not item.strip():
        return jsonify(ok=False, reason="image_url + item (str) required"), 400
    if not isinstance(x_in, (int, float)) or not isinstance(y_in, (int, float)):
        return jsonify(ok=False, reason="x,y must be numbers"), 400
    x = float(x_in); y = float(y_in)
    if not (0.0 <= x <= 1.0 and 0.0 <= y <= 1.0):
        return jsonify(ok=False, reason="x,y must be in [0,1]"), 400
    if len(item) > 200:
        return jsonify(ok=False, reason="item too long"), 400

    meta: dict = {"item": item, "x": x, "y": y}

    try:
        t_fetch = time.time()
        scene = _fetch_image(image_url)
        meta["scene_size"] = list(scene.size)
        meta["ms_fetch"] = int((time.time() - t_fetch) * 1000)
    except Exception as e:  # noqa: BLE001
        return jsonify(ok=False, reason=f"fetch failed: {e}"), 400

    crop, (x0, y0, x1, y1) = _crop_around(scene, x, y, CROP_SIZE)
    meta["crop_rect"] = [x0, y0, x1, y1]

    # Attempt 1
    t_edit = time.time()
    try:
        edited = _nbp_edit(crop, item)
    except Exception as e:  # noqa: BLE001
        return jsonify(ok=False, reason=f"nbp failed: {e}", meta=meta), 502
    meta["ms_edit_1"] = int((time.time() - t_edit) * 1000)

    t_judge = time.time()
    passed = _judge_wearing(crop, edited, item)
    meta["ms_judge_1"] = int((time.time() - t_judge) * 1000)
    meta["judge_1"] = passed

    if not passed:
        # One retry with the same prompt (NBP is stochastic).
        t_edit2 = time.time()
        try:
            edited = _nbp_edit(crop, item)
        except Exception as e:  # noqa: BLE001
            return jsonify(ok=False, reason=f"nbp retry failed: {e}", meta=meta), 502
        meta["ms_edit_2"] = int((time.time() - t_edit2) * 1000)
        t_judge2 = time.time()
        passed = _judge_wearing(crop, edited, item)
        meta["ms_judge_2"] = int((time.time() - t_judge2) * 1000)
        meta["judge_2"] = passed
        if not passed:
            meta["ms_total"] = int((time.time() - t0) * 1000)
            return jsonify(ok=False, reason="judge rejected both attempts", meta=meta), 200

    # Composite the crop back into the full frame.
    out = scene.copy()
    out.paste(edited, (x0, y0))
    b64 = base64.b64encode(_png_bytes(out)).decode("ascii")
    meta["ms_total"] = int((time.time() - t0) * 1000)
    return jsonify(ok=True, image_b64=b64, meta=meta)


@app.get("/")
def ok():
    return "kgb-magic ok"


@app.get("/healthz")
def healthz():
    return jsonify(ok=True, project=PROJECT, model=NBP_MODEL)
