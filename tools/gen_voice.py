"""Pre-generate all narration with Gemini 3.1 Flash TTS (Speech Arena #2).

Collects every line the app speaks (story texts, choice labels, scare
reveals, rule/odd-one instructions, recall variants, UI prompts), renders
each once to public/voice/<sha1>.mp3, and writes src/assets/voice.ts
mapping exact text -> filename. say() plays the file when mapped and only
falls back to Web Speech for unmapped strings.

Usage: python3 tools/gen_voice.py   (skips existing clips)
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from google import genai  # noqa: E402
from google.genai import types  # noqa: E402

ROOT = Path(__file__).parent.parent
VOICE_DIR = ROOT / "public" / "voice"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"
VOICE_TS = ROOT / "src" / "assets" / "voice.ts"

_client = None


def client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(vertexai=True, project="adk-coding-agents", location="us-central1")
    return _client


EMOJI = re.compile(r"[\U0001F000-\U0001FAFF☀-➿⬀-⯿]")


def spoken_form(text: str) -> str:
    return EMOJI.sub("", text).strip()


# per-source delivery styles (Gemini 3.1 TTS audio tags)
STYLES = {
    "whisper_text": "[hushed, suspenseful, slow] ",
    "whisper_reveal": "[gentle, warm, relieved] ",
    "scareschool_text": "[playful, energetic] ",
    "scareschool_reveal": "[giggling, delighted] ",
    "gentle": "[warm, cozy storytelling] ",
    "choice": "[bright, inviting] ",
    "instruction": "[cheerful, encouraging] ",
}


def collect_lines() -> list[tuple[str, str]]:
    lines: dict[str, str] = {}
    m = json.loads(MANIFEST.read_text())
    for st in m.get("stories", []):
        spooky = st["id"] == "whisper"
        school = st["id"] == "scareschool"
        tstyle = STYLES["whisper_text"] if spooky else STYLES["scareschool_text"] if school else STYLES["gentle"]
        rstyle = STYLES["whisper_reveal"] if spooky else STYLES["scareschool_reveal"]
        for n in st["nodes"].values():
            lines.setdefault(n["text"], tstyle)
            for c in n.get("choices", []):
                lines.setdefault(c["label"], STYLES["choice"])
            if "scare" in n:
                lines.setdefault(n["scare"]["reveal"], rstyle)
    cat = (ROOT / "src" / "games" / "iconCategories.ts").read_text()
    for t in re.findall(r"tap: '([^']+)'", cat) + re.findall(r"not: '([^']+)'", cat):
        lines.setdefault(t, STYLES["instruction"])
    lines.setdefault("Which one does not belong?", STYLES["instruction"])
    for n in range(1, 11):
        lines.setdefault(f"Memory check! Do rule number {n} again. Do you remember it?", STYLES["instruction"])
    lines.setdefault("What should happen next?", STYLES["choice"])
    lines.setdefault("Tap where you want to go!", STYLES["choice"])
    lines.setdefault("or maybe...", STYLES["choice"])
    lines.setdefault("How many players?", STYLES["instruction"])
    lines.setdefault("Two player mode is on!", STYLES["instruction"])
    return sorted(lines.items())


def fname_for(text: str) -> str:
    return hashlib.sha1(spoken_form(text).encode()).hexdigest()[:16] + ".mp3"


# some lines are too short for the TTS quality filter — speak a richer
# form under the same map key
TTS_OVERRIDES = {
    "or maybe...": "Orrr... maybe...",
    "Hug Great-Grandcat 💜": "Give Great-Grandcat a great big hug!",
    "Be Mo, but louder! 📣": "Be Mo... but louder!",
    "Scare the Principal back 😈": "Scare the Principal right back!",
}


def synth(job: tuple[str, str]) -> bool:
    text, style = job
    out = VOICE_DIR / fname_for(text)
    if out.exists():
        return True
    say = spoken_form(TTS_OVERRIDES.get(text, text))
    for attempt in range(3):
        try:
            resp = client().models.generate_content(
                model="gemini-3.1-flash-tts-preview",
                contents=style + say,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Leda")))),
            )
            data = resp.candidates[0].content.parts[0].inline_data.data
            with tempfile.NamedTemporaryFile(suffix=".raw", delete=False) as f:
                f.write(data)
                raw = f.name
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "s16le", "-ar", "24000",
                            "-ac", "1", "-i", raw, "-codec:a", "libmp3lame", "-q:a", "4",
                            str(out)], check=True)
            Path(raw).unlink()
            print(f"  voiced: {say[:60]!r}")
            return True
        except Exception as e:  # noqa: BLE001
            print(f"  retry {attempt + 1} {say[:40]!r}: {str(e)[:90]}")
    return False


def main() -> None:
    VOICE_DIR.mkdir(parents=True, exist_ok=True)
    lines = collect_lines()
    print(f"{len(lines)} lines to voice")
    with ThreadPoolExecutor(4) as ex:
        results = list(ex.map(synth, lines))
    ok = [t for (t, _), r in zip(lines, results) if r]
    entries = ",\n".join(f"  {json.dumps(spoken_form(t))}: '{fname_for(t)}'" for t in sorted(ok))
    VOICE_TS.write_text(
        "// GENERATED by tools/gen_voice.py — exact spoken text -> pre-rendered clip.\n"
        "export const VOICE: Record<string, string> = {\n" + entries + ",\n};\n")
    print(f"voiced {len(ok)}/{len(lines)}; wrote src/assets/voice.ts")


if __name__ == "__main__":
    main()
