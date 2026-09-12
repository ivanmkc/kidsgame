#!/usr/bin/env python3
"""Voice clip length gate.

A TTS clip should take about as long to play as its text takes to read. When
it doesn't, the model did something other than read the line — the two
"Sing the lullaby" clips came back as 105 and 31 seconds of actual singing
instead of a two-second instruction, which strands the Story Path page that
speaks them.

That was invisible while nothing waited on narration. It stops being
invisible the moment anything does (Story Path holds its hotspots until the
page has been read), so it needs a gate.

    python3 tools/voice_durations.py [--factor 3.0] [--slack 8]

Reports every clip whose duration exceeds both `factor` times the length its
text implies and `slack` seconds of headroom, and exits non-zero if any
exist. The rate is the median seconds-per-character over the shipped clips,
measured PER SCRIPT — a hanzi or kana character carries about 2.5x the sound
of a latin one, so one rate for both would flag good Japanese and Chinese
reads. Both re-derive themselves if the voice or speaking style changes.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import statistics

try:
    from mutagen.mp3 import MP3
except ImportError:  # pragma: no cover - dependency hint
    raise SystemExit("needs mutagen: pip install mutagen")

ROOT = pathlib.Path(__file__).resolve().parent.parent
VOICE_TS = ROOT / "src" / "assets" / "voice.ts"
VOICE_DIR = ROOT / "public" / "voice"

ENTRY = re.compile(r'^  ("(?:[^"\\]|\\.)*"): \'([0-9a-f]+\.mp3)\',$', re.M)
LANG_KEY = re.compile(r"^(ja|cmn|yue)\|")
# Minimum text length to score: a one- or two-character line carries too
# little signal for the rate to mean anything.
MIN_CHARS = 8


def voice_map() -> dict[str, str]:
    return {json.loads(k): v for k, v in ENTRY.findall(VOICE_TS.read_text())}


def durations() -> list[tuple[str, str, float, int]]:
    """(text, filename, seconds, text length) for every clip on disk."""
    out = []
    for text, fname in voice_map().items():
        path = VOICE_DIR / fname
        if not path.exists():
            continue
        try:
            seconds = MP3(path).info.length
        except Exception:  # noqa: BLE001 - an unreadable clip is a separate problem
            continue
        body = LANG_KEY.sub("", text)
        out.append((text, fname, seconds, len(body)))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--factor", type=float, default=3.0,
                    help="how many times the implied length is still acceptable")
    ap.add_argument("--slack", type=float, default=8.0,
                    help="seconds of headroom on top, so short lines aren't flagged for noise")
    args = ap.parse_args()

    clips = durations()
    if not clips:
        print(f"no clips found under {VOICE_DIR}")
        return 1
    scorable = [c for c in clips if c[3] >= MIN_CHARS]
    rate = {}
    for latin in (True, False):
        group = [c for c in scorable if c[0].isascii() is latin]
        if group:
            rate[latin] = statistics.median(sec / n for _, _, sec, n in group)
    print(f"{len(clips)} clips on disk, {len(scorable)} scorable; median "
          + ", ".join(f"{r:.4f} s/char ({'latin' if k else 'cjk'})"
                      for k, r in rate.items()))

    bad = []
    for text, fname, seconds, n in scorable:
        implied = n * rate[text.isascii()]
        if seconds > max(implied * args.factor, implied + args.slack):
            bad.append((seconds, implied, text, fname))
    bad.sort(reverse=True)

    if not bad:
        print("every clip plays for about as long as its text implies")
        return 0
    print(f"\n{len(bad)} clip(s) far longer than their text implies:")
    for seconds, implied, text, fname in bad:
        print(f"  {seconds:7.1f}s (implied ~{implied:4.1f}s)  {fname}  {text[:70]!r}")
    print("\nDelete the clip and its src/assets/voice.ts entry, then re-run "
          "tools/gen_voice.py to re-synthesize it.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
