#!/usr/bin/env python3
"""Experiment A: generate after-patches for escape hotspots using NBP edit_local.

Runs on the REAL toyroom and dragoncave scenes. Saves artifacts to
tools/audit_out/escape-fx/. Reports drift and change metrics.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from gen.judge import ask_yes_no  # noqa: E402
from gen.nbp import edit_local  # noqa: E402
from PIL import Image  # noqa: E402

ROOT = Path(__file__).parent.parent
MANIFEST = ROOT / "src" / "assets" / "manifest.json"
ASSETS = ROOT / "assets" / "game"
OUT = ROOT / "tools" / "audit_out" / "escape-fx"
OUT.mkdir(parents=True, exist_ok=True)

EXPERIMENTS = [
    {
        "room": "toyroom",
        "hotspot": "chest",
        "prompt": "the red wooden toy chest is now wide open with the lid raised up, showing an empty interior",
    },
    {
        "room": "toyroom",
        "hotspot": "pen",
        "prompt": "the wooden fence pen gate is swung wide open, the golden puppy happily bounding out",
    },
    {
        "room": "dragoncave",
        "hotspot": "stove",
        "prompt": "the copper stove is now lit with warm orange flames through the grate, a golden pancake sizzling in a pan on top",
    },
    {
        "room": "dragoncave",
        "hotspot": "dragon",
        "prompt": "the teal baby dragon happily munching a golden pancake with eyes closed in delight, tiny puff of smoke",
    },
]


def main() -> None:
    manifest = json.loads(MANIFEST.read_text())
    rooms = {r["id"]: r for r in manifest.get("escape", [])}

    for exp in EXPERIMENTS:
        room = rooms.get(exp["room"])
        if not room:
            print(f"SKIP {exp['room']}: not in manifest")
            continue
        hs = next((h for h in room["hotspots"] if h["id"] == exp["hotspot"]), None)
        if not hs:
            print(f"SKIP {exp['room']}/{exp['hotspot']}: hotspot not found")
            continue

        scene_path = ASSETS / room["image"]
        scene = Image.open(scene_path)
        box = (hs["box"]["x"], hs["box"]["y"], hs["box"]["w"], hs["box"]["h"])
        tag = f"{exp['room']}_{exp['hotspot']}"
        print(f"\n{'='*60}")
        print(f"Experiment: {tag}")
        print(f"  box: {box}")
        print(f"  prompt: {exp['prompt'][:80]}...")

        before_crop = scene.crop((box[0], box[1], box[0] + box[2], box[1] + box[3]))
        before_crop.save(OUT / f"{tag}_before.png")

        best = None
        for attempt in range(3):
            try:
                out, inside_ch, drift = edit_local(scene, box, exp["prompt"], ctx=80)
            except Exception as e:
                print(f"  attempt {attempt + 1} error: {str(e)[:120]}")
                continue

            after_crop = out.crop((box[0], box[1], box[0] + box[2], box[1] + box[3]))
            after_crop.save(OUT / f"{tag}_after_try{attempt}.png")
            print(f"  attempt {attempt + 1}: inside_ch={inside_ch:.3f} drift={drift:.3f}")

            if drift > 0.12:
                print(f"  REJECT: drift too high")
                continue
            if inside_ch < 0.05:
                print(f"  REJECT: no visible change")
                continue

            passed = ask_yes_no(
                f"Two images: the first is the ORIGINAL scene crop, the second is the edited version. "
                f"Does the second image show a believable '{exp['prompt']}' that matches the art style?",
                [before_crop, after_crop],
            )
            status = "PASS" if passed else "FAIL"
            print(f"  judge: {status}")

            if passed:
                best = {"attempt": attempt, "inside_ch": inside_ch, "drift": drift}
                after_crop.save(OUT / f"{tag}_after_best.png")
                out.save(OUT / f"{tag}_full_after.png")
                break

        if best:
            print(f"  RESULT: {tag} succeeded (attempt {best['attempt']}, ch={best['inside_ch']:.3f}, drift={best['drift']:.3f})")
        else:
            print(f"  RESULT: {tag} FAILED after 3 attempts")

    print("\nDone. Artifacts in", OUT)


if __name__ == "__main__":
    main()
