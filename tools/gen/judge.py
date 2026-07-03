"""Vision judge (Gemini Flash) — cheap yes/no checks on generated assets.

Two independently-phrased judges, strict-min: an asset passes only if BOTH
say yes. Catches plausible-but-wrong generations (invisible diffs, wrong
object, style break) that programmatic pixel checks can't.
"""

from __future__ import annotations

import io
import sys
import time

from PIL import Image
from google.genai import types

from .nbp import client

_JUDGE_CANDIDATES = ["gemini-3.1-flash", "gemini-2.5-flash"]
_judge_model: str | None = None


def judge_model() -> str:
    global _judge_model
    if _judge_model is None:
        for m in _JUDGE_CANDIDATES:
            try:
                client().models.generate_content(model=m, contents="Say OK")
                _judge_model = m
                break
            except Exception:
                continue
        if _judge_model is None:
            raise RuntimeError(f"no judge model reachable: {_JUDGE_CANDIDATES}")
        print(f"judge model: {_judge_model}")
    return _judge_model


def _png_part(img: Image.Image) -> types.Part:
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return types.Part(inline_data=types.Blob(mime_type="image/png", data=buf.getvalue()))


def ask_yes_no(question: str, images: list[Image.Image], attempts: int = 3) -> bool:
    parts: list[types.Part] = [_png_part(im) for im in images]
    parts.append(types.Part(text=question + "\nAnswer with exactly one word: YES or NO."))
    for i in range(attempts):
        try:
            resp = client().models.generate_content(
                model=judge_model(),
                contents=[types.Content(role="user", parts=parts)],
            )
            text = (resp.text or "").strip().upper()
            if "YES" in text[:12]:
                return True
            if "NO" in text[:12]:
                return False
        except Exception as e:  # noqa: BLE001
            print(f"  WARN judge attempt {i + 1}: {type(e).__name__} {str(e)[:100]}", file=sys.stderr)
            time.sleep(4 * (i + 1))
    return False  # unreadable/unreachable judge = fail closed


def strict_min(q1: str, q2: str, images: list[Image.Image]) -> bool:
    return ask_yes_no(q1, images) and ask_yes_no(q2, images)


def ask_text(question: str, images: list[Image.Image], attempts: int = 3) -> str:
    """Short free-text answer (e.g. captioning what changed)."""
    parts: list[types.Part] = [_png_part(im) for im in images]
    parts.append(types.Part(text=question))
    for i in range(attempts):
        try:
            resp = client().models.generate_content(
                model=judge_model(),
                contents=[types.Content(role="user", parts=parts)],
            )
            text = (resp.text or "").strip().strip('."')
            if text:
                return text[:80]
        except Exception as e:  # noqa: BLE001
            print(f"  WARN ask_text attempt {i + 1}: {type(e).__name__} {str(e)[:100]}", file=sys.stderr)
            time.sleep(4 * (i + 1))
    return "something changed here"
