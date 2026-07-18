"""Story audio verification gate (Ivan: wrong voice / volume / cutoffs /
lang match). Three checks:

1. COVERAGE (hard gate): every line a story can SPEAK — node text, choice
   labels, hots lead lines, scare reveals — must have a synthesized clip
   for EVERY language it renders in (en + ja/cmn/yue from node/choice "t").
   A missing lang clip silently plays the ENGLISH clip (src/sound.ts
   fallback) = "audio doesn't match language"; a missing en clip falls to
   Web Speech = "wrong voice".
2. DURATION sanity (hard gate): clip shorter than ~40% of a conservative
   chars-per-second estimate = truncated synthesis.
3. LOUDNESS scan (report + optional --normalize): ffmpeg volumedetect
   mean_volume; clips >4dB from the median get flagged / normalized.

Usage: python3 tools/verify_story_audio.py [--loudness] [--normalize]
Exit nonzero on coverage/duration failures (ship.sh gates on this).
"""
import json
import re
import subprocess
import sys
from pathlib import Path
from statistics import median

ROOT = Path(__file__).parent.parent
VOICE_DIR = ROOT / "public" / "voice"
VOICE_TS = ROOT / "src" / "assets" / "voice.ts"

PICKER = {"ja": "どの おはなし よもうか？", "cmn": "读哪个故事？", "yue": "睇邊個故事？",
          "en": "Which story shall we read?"}
LEADS = {
    "en": ["What should happen next?", "Tap where you want to go!"],
    "ja": ["つぎは どうなる？", "いきたい ほうを タップ！"],
    "cmn": ["接下来会怎样？", "想去哪就点哪！"],
    "yue": ["跟住會點樣呢？", "想去邊就撳邊！"],
}
EMOJI = re.compile(r"[\U0001F300-\U0001FAFF☀-➿⬀-⯿\uFE0E\uFE0F]")

def spoken(t: str) -> str:
    return EMOJI.sub("", t).strip()

def load_voice_map() -> dict:
    # voice.ts entries are JSON-style double-quoted keys -> 'hash.mp3'
    m = {}
    for k, v in re.findall(r'"((?:[^"\\]|\\.)*)":\s*\'([0-9a-f]+\.mp3)\'', VOICE_TS.read_text()):
        m[json.loads('"' + k + '"')] = v
    return m

def main() -> int:
    voice = load_voice_map()
    man = json.loads((ROOT / "src/assets/manifest.json").read_text())
    missing, jobs = [], []
    for st in man.get("stories", []):
        for nid, n in st["nodes"].items():
            lines = {"en": [n["text"]]}
            for lang, t in (n.get("t") or {}).items():
                lines.setdefault(lang, []).append(t)
            for c in n.get("choices", []):
                lines["en"].append(c["label"])
                for lang, t in (c.get("t") or {}).items():
                    lines.setdefault(lang, []).append(t)
            if "scare" in n:
                lines["en"].append(n["scare"]["reveal"])
                for lang, t in (n["scare"].get("t") or {}).items():
                    lines.setdefault(lang, []).append(t)
            for lang, ts in lines.items():
                for t in ts:
                    sp = spoken(t)
                    if not sp:
                        continue
                    key = sp if lang == "en" else f"{lang}|{sp}"
                    if key not in voice or not (VOICE_DIR / voice[key]).exists():
                        missing.append((st["id"], nid, lang, sp[:60]))
    for lang, t in PICKER.items():
        key = spoken(t) if lang == "en" else f"{lang}|{spoken(t)}"
        if key not in voice or not (VOICE_DIR / voice[key]).exists():
            missing.append(("PICKER", "-", lang, t))
    for lang, ts in LEADS.items():
        for t in ts:
            key = spoken(t) if lang == "en" else f"{lang}|{spoken(t)}"
            if key not in voice or not (VOICE_DIR / voice[key]).exists():
                missing.append(("LEADS", "-", lang, t))

    # ── Escape room coverage ──
    for room in man.get("escape", []):
        rid = room["id"]
        escape_lines: dict[str, list[str]] = {"en": []}
        escape_lines["en"].append(room["intro"])
        escape_lines["en"].append(room["winText"])
        for lang, fields in (room.get("t") or {}).items():
            for txt in fields.values():
                escape_lines.setdefault(lang, []).append(txt)
        for h in room.get("hotspots", []):
            for field in ("sayFound", "saySearch", "sayLocked"):
                if h.get(field):
                    escape_lines["en"].append(h[field])
            for lang, fields in (h.get("t") or {}).items():
                for txt in fields.values():
                    escape_lines.setdefault(lang, []).append(txt)
        for item in room.get("items", []):
            escape_lines["en"].append(item["label"])
            for lang, txt in (item.get("t") or {}).items():
                escape_lines.setdefault(lang, []).append(txt)
        for lang, ts in escape_lines.items():
            for t in ts:
                sp = spoken(t)
                if not sp:
                    continue
                key = sp if lang == "en" else f"{lang}|{sp}"
                if key not in voice or not (VOICE_DIR / voice[key]).exists():
                    missing.append((f"escape/{rid}", "-", lang, sp[:60]))

    # ── Game speechLines coverage (speech_lines.json) ──
    sl_path = ROOT / "tools" / "speech_lines.json"
    if sl_path.exists():
        for line in json.loads(sl_path.read_text()):
            sp = spoken(line)
            if not sp:
                continue
            if sp.isascii():
                if sp not in voice or not (VOICE_DIR / voice[sp]).exists():
                    missing.append(("speechLines", "-", "en", sp[:60]))
            else:
                if re.search(r"[぀-ヿ]", sp):
                    key = f"ja|{sp}"
                    if key not in voice or not (VOICE_DIR / voice[key]).exists():
                        missing.append(("speechLines", "-", "ja", sp[:60]))
                elif re.search(r"[一-鿿]", sp):
                    for lang in ("cmn", "yue"):
                        key = f"{lang}|{sp}"
                        if key not in voice or not (VOICE_DIR / voice[key]).exists():
                            missing.append(("speechLines", "-", lang, sp[:60]))

    print(f"coverage: {len(missing)} missing clips")
    for m_ in missing[:40]:
        print("  MISSING", m_)

    # duration sanity over story clips (cheap ffprobe)
    trunc = []
    story_keys = set()
    for st in man.get("stories", []):
        for n in st["nodes"].values():
            for lang, ts in [("en", [n["text"]])] + [(l, [t]) for l, t in (n.get("t") or {}).items()]:
                for t in ts:
                    sp = spoken(t)
                    story_keys.add(sp if lang == "en" else f"{lang}|{sp}")
    for key in sorted(story_keys):
        clip = voice.get(key)
        if not clip or not (VOICE_DIR / clip).exists():
            continue
        text = key.split("|", 1)[-1]
        cjk = bool(re.search(r"[぀-ヿ一-鿿]", text))
        # generous: >=40% of a conservative speaking-rate estimate
        expect = len(text) / (6.5 if cjk else 16.0)
        if expect < 1.2:
            continue
        try:
            dur = float(subprocess.run(
                ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                 "-of", "csv=p=0", str(VOICE_DIR / clip)],
                capture_output=True, text=True, timeout=20).stdout.strip())
        except Exception:
            continue
        if dur < 0.4 * expect:
            trunc.append((key[:60], round(dur, 1), round(expect, 1)))
    print(f"duration: {len(trunc)} truncation suspects")
    for t_ in trunc[:20]:
        print("  TRUNCATED", t_)

    if "--loudness" in sys.argv:
        vols = {}
        for key in sorted(story_keys):
            clip = voice.get(key)
            if not clip or not (VOICE_DIR / clip).exists():
                continue
            r = subprocess.run(["ffmpeg", "-i", str(VOICE_DIR / clip), "-af",
                                "volumedetect", "-f", "null", "-"],
                               capture_output=True, text=True, timeout=30)
            mm = re.search(r"mean_volume: ([-\d.]+) dB", r.stderr)
            if mm:
                vols[clip] = float(mm.group(1))
        if vols:
            med = median(vols.values())
            out = {c: v for c, v in vols.items() if abs(v - med) > 4}
            print(f"loudness: median {med:.1f} dB, {len(out)} outliers (>4dB off)")
            if "--normalize" in sys.argv:
                for c, v in out.items():
                    src = VOICE_DIR / c
                    tmp = src.with_suffix(".norm.mp3")
                    subprocess.run(["ffmpeg", "-y", "-i", str(src), "-af",
                                    f"volume={med - v:.1f}dB", "-codec:a", "libmp3lame",
                                    "-q:a", "4", str(tmp)], capture_output=True, timeout=30)
                    tmp.replace(src)
                print(f"normalized {len(out)} clips toward {med:.1f} dB")

    return 1 if (missing or trunc) else 0

if __name__ == "__main__":
    sys.exit(main())
