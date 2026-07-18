"""In-place hotspot recovery for wave-5 story books.

Retries SAM detection on choices/scares that gen_stories dropped (spot not
locatable at gen time). Batches ALL candidate phrases for a scene into one
SAM call for speed. Uses a candidate-phrase ladder — spec spot phrase,
a Gemini-vision-proposed phrase, last-2-words, last-word — picking the
first hit from the batch results.

CRITICAL: does NOT re-run gen_stories.py — never wipes the "video" fields.

Usage: cd tools && python3 -u patch_hotspots.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / "gen"))

from PIL import Image
from gen_stories import _spots_distinct
from gen.sam_batch import sam_segment_batch
from gen.nbp import client as genai_client

ROOT = Path(__file__).parent.parent
MANIFEST = ROOT / "src" / "assets" / "manifest.json"
SCENES = ROOT / "assets" / "game" / "story"

WAVE5_IDS = [
    "carnival", "thunder", "bayou", "manor", "badlands", "quarry",
    "lagoon", "grotto", "bamboo", "junkyard", "museum", "observatory",
]

MIN_AREA = 2500
SCORE_THRESH = 0.3
PAD = 12


def _load_specs() -> dict[str, dict]:
    specs = {}
    spec_dir = Path(__file__).parent / "gen" / "specs_wave5"
    for f in spec_dir.glob("*.json"):
        d = json.loads(f.read_text())
        specs[d["id"]] = d
    return specs


def _gemini_spot_phrases_batch(scene_path: Path, choice_labels: list[str]) -> list[str | None]:
    """Ask Gemini vision to name prominent objects for multiple choices at once."""
    results: list[str | None] = [None] * len(choice_labels)
    try:
        img = Image.open(scene_path)
        import io
        from google.genai import types
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=85)

        numbered = "\n".join(f"{i+1}. {lbl}" for i, lbl in enumerate(choice_labels))
        resp = genai_client().models.generate_content(
            model="gemini-3.5-flash",
            contents=[
                types.Part(inline_data=types.Blob(
                    mime_type="image/jpeg", data=buf.getvalue())),
                types.Part(text=(
                    f"Look at this scene. For each numbered action below, name the "
                    f"single most prominent solid object in the scene that represents "
                    f"that action. Use 2-4 words (color + noun). It must be a distinct "
                    f"object, not a region or lighting effect.\n\n{numbered}\n\n"
                    f"Reply with one line per action, numbered, each containing ONLY the phrase."
                )),
            ],
        )
        for line in resp.text.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            # Parse "1. red balloon" or "1: red balloon"
            for sep in [".", ":", ")"]:
                if sep in line:
                    parts = line.split(sep, 1)
                    try:
                        idx = int(parts[0].strip()) - 1
                        phrase = parts[1].strip().strip('"').strip("'").strip(".")
                        if 0 <= idx < len(results) and 2 <= len(phrase) <= 60:
                            results[idx] = phrase
                        break
                    except ValueError:
                        continue
    except Exception as e:
        print(f"  Gemini batch spot query failed: {e}", flush=True)
    return results


def _build_candidates(spec_spot: str, gemini_phrase: str | None) -> list[str]:
    """Build ordered list of candidate phrases for one slot."""
    candidates = [spec_spot]
    if gemini_phrase and gemini_phrase.lower() != spec_spot.lower():
        candidates.append(gemini_phrase)
    words = spec_spot.replace("the ", "").split()
    if len(words) >= 2:
        last2 = " ".join(words[-2:])
        if last2.lower() not in [c.lower() for c in candidates]:
            candidates.append(last2)
    last1 = words[-1]
    if last1.lower() not in [c.lower() for c in candidates]:
        candidates.append(last1)
    return candidates


def _box_from_segs(segs: dict, candidates: list[str]) -> tuple[int, int, int, int] | None:
    """Pick the best box from SAM results, trying candidates in priority order."""
    for phrase in candidates:
        got = segs.get(phrase, [])
        if got and got[0]["score"] >= SCORE_THRESH:
            x0, y0, x1, y1 = got[0]["bbox"]
            if (x1 - x0) * (y1 - y0) < MIN_AREA:
                continue
            x0, y0 = max(0, x0 - PAD), max(0, y0 - PAD)
            x1, y1 = min(1280, x1 + PAD), min(720, y1 + PAD)
            return (x0, y0, x1 - x0, y1 - y0)
    return None


def patch_hotspots():
    specs = _load_specs()
    manifest = json.loads(MANIFEST.read_text())
    story_idx = {s["id"]: i for i, s in enumerate(manifest["stories"])}

    choice_patches: dict[str, dict[str, list[dict]]] = {}
    scare_patches: dict[str, dict[str, dict]] = {}
    before_counts: dict[str, int] = {}
    after_counts: dict[str, int] = {}

    for bid in WAVE5_IDS:
        if bid not in story_idx or bid not in specs:
            print(f"SKIP {bid}: not in manifest or no spec", flush=True)
            continue

        st = manifest["stories"][story_idx[bid]]
        spec = specs[bid]
        choice_patches[bid] = {}
        scare_patches[bid] = {}
        hot_before = 0
        hot_after = 0

        print(f"\n--- {bid} ---", flush=True)

        # Collect all nodes needing work, and all prompts needed per scene
        scene_work: list[dict] = []  # list of work items per scene image

        for nid, node in st["nodes"].items():
            choices = node.get("choices", [])
            if not choices:
                continue

            has_hot = [bool(c.get("hot")) for c in choices]
            hot_before += sum(has_hot)

            if all(has_hot):
                hot_after += len(choices)
                continue

            spec_node = spec.get("nodes", {}).get(nid)
            if not spec_node:
                hot_after += sum(has_hot)
                continue

            spec_choices = spec_node.get("choices", [])
            spots = [c.get("spot") for c in spec_choices]
            if not all(spots):
                hot_after += sum(has_hot)
                continue

            scene_path = SCENES / f"{bid}_{nid}.png"
            if not scene_path.exists():
                print(f"  {bid}/{nid}: scene image missing", flush=True)
                hot_after += sum(has_hot)
                continue

            # Check for scare too while we have this scene
            spec_scare = spec_node.get("scare")
            need_scare = spec_scare and "scare" not in node

            scene_work.append({
                "nid": nid,
                "scene_path": scene_path,
                "spots": spots,
                "spec_choices": spec_choices,
                "num_choices": len(choices),
                "need_scare": need_scare,
                "spec_scare": spec_scare,
            })

        # Also collect scare-only nodes (choices already have hotspots but scare missing)
        for nid, node in st["nodes"].items():
            spec_node = spec.get("nodes", {}).get(nid)
            if not spec_node:
                continue
            spec_scare = spec_node.get("scare")
            if not spec_scare or "scare" in node:
                continue
            # Check if this node is already in scene_work
            if any(w["nid"] == nid for w in scene_work):
                continue
            scene_path = SCENES / f"{bid}_{nid}.png"
            if not scene_path.exists():
                continue
            scene_work.append({
                "nid": nid,
                "scene_path": scene_path,
                "spots": [],
                "spec_choices": [],
                "num_choices": 0,
                "need_scare": True,
                "spec_scare": spec_scare,
            })

        # Process each scene: one Gemini call + one SAM batch per scene
        for work in scene_work:
            nid = work["nid"]
            scene_path = work["scene_path"]
            scene_img = Image.open(scene_path)

            # Build all candidate phrases
            all_labels = [sc.get("label", "") for sc in work["spec_choices"]]
            if work["need_scare"]:
                all_labels.append(f"scare at {work['spec_scare']['spot']}")

            # Gemini batch call for all labels at once
            gemini_phrases = _gemini_spot_phrases_batch(scene_path, all_labels) if all_labels else []

            # Build per-slot candidates and collect all unique prompts
            per_slot_candidates: list[list[str]] = []
            for i, spot in enumerate(work["spots"]):
                gp = gemini_phrases[i] if i < len(gemini_phrases) else None
                cands = _build_candidates(spot, gp)
                per_slot_candidates.append(cands)

            scare_candidates: list[str] = []
            if work["need_scare"]:
                gp_idx = len(work["spots"])
                gp = gemini_phrases[gp_idx] if gp_idx < len(gemini_phrases) else None
                scare_candidates = _build_candidates(work["spec_scare"]["spot"], gp)

            # Collect all unique prompts for one SAM batch
            all_prompts = []
            seen = set()
            for cands in per_slot_candidates:
                for c in cands:
                    if c.lower() not in seen:
                        all_prompts.append(c)
                        seen.add(c.lower())
            for c in scare_candidates:
                if c.lower() not in seen:
                    all_prompts.append(c)
                    seen.add(c.lower())

            if not all_prompts:
                continue

            # Single SAM batch call for this scene
            try:
                segs = sam_segment_batch(scene_img, all_prompts, tag=f"{bid}/{nid}")
            except Exception as e:
                print(f"  {bid}/{nid}: SAM batch failed ({str(e)[:120]})", flush=True)
                if work["spots"]:
                    hot_after += sum(bool(c.get("hot")) for c in st["nodes"][nid].get("choices", []))
                continue

            # Extract boxes for choices
            if work["spots"]:
                boxes = [_box_from_segs(segs, cands) for cands in per_slot_candidates]

                if all(boxes) and _spots_distinct(boxes):
                    hot_dicts = [{"x": b[0], "y": b[1], "w": b[2], "h": b[3]} for b in boxes]
                    choice_patches[bid][nid] = hot_dicts
                    hot_after += work["num_choices"]
                    print(f"  {bid}/{nid}: hotspots RECOVERED {boxes}", flush=True)
                else:
                    missing = [i for i, b in enumerate(boxes) if b is None]
                    print(f"  {bid}/{nid}: hotspots FAILED (missing={missing})", flush=True)
                    hot_after += sum(bool(c.get("hot")) for c in st["nodes"][nid].get("choices", []))

            # Extract scare box
            if work["need_scare"] and scare_candidates:
                scare_box = _box_from_segs(segs, scare_candidates)
                if scare_box is None:
                    print(f"  {bid}/{nid}: scare NOT located", flush=True)
                else:
                    pop_path = SCENES / f"{bid}_{nid}_pop.png"
                    if not pop_path.exists():
                        print(f"  {bid}/{nid}: scare located but pop sprite missing", flush=True)
                    else:
                        ss = work["spec_scare"]
                        scare_patches[bid][nid] = {
                            "x": scare_box[0], "y": scare_box[1],
                            "w": scare_box[2], "h": scare_box[3],
                            "pop": f"story/{bid}_{nid}_pop.png",
                            "sting": ss.get("sting", "boing"),
                            "reveal": ss.get("reveal", "Boo!"),
                            "delay": ss.get("delay", 1800),
                        }
                        print(f"  {bid}/{nid}: scare RECOVERED at {scare_box}", flush=True)

        before_counts[bid] = hot_before
        after_counts[bid] = hot_after

    # --- Atomic read-modify-write ---
    print("\n=== Applying patches atomically ===", flush=True)
    fresh = json.loads(MANIFEST.read_text())
    fresh_idx = {s["id"]: i for i, s in enumerate(fresh["stories"])}

    patched_choices = 0
    patched_scares = 0

    for bid in WAVE5_IDS:
        if bid not in fresh_idx:
            continue
        st = fresh["stories"][fresh_idx[bid]]

        for nid, hot_dicts in choice_patches.get(bid, {}).items():
            node = st["nodes"][nid]
            for i, hot in enumerate(hot_dicts):
                if i < len(node.get("choices", [])):
                    node["choices"][i]["hot"] = hot
                    patched_choices += 1

        for nid, scare_obj in scare_patches.get(bid, {}).items():
            node = st["nodes"][nid]
            node["scare"] = scare_obj
            patched_scares += 1

    MANIFEST.write_text(json.dumps(fresh, indent=2) + "\n")
    print(f"Patched {patched_choices} choice hotspots, {patched_scares} scares", flush=True)

    # Before/after table
    print(f"\n{'Book':<15} {'Before':>8} {'After':>8}", flush=True)
    print("-" * 35, flush=True)
    tb = ta = 0
    for bid in WAVE5_IDS:
        if bid not in story_idx:
            continue
        st = manifest["stories"][story_idx[bid]]
        total = sum(len(n.get("choices", [])) for n in st["nodes"].values())
        b = before_counts.get(bid, 0)
        a = after_counts.get(bid, 0)
        print(f"{bid:<15} {b:>5}/{total:<3} {a:>5}/{total:<3}", flush=True)
        tb += b
        ta += a
    total_total = sum(
        sum(len(n.get("choices", [])) for n in manifest["stories"][story_idx[bid]]["nodes"].values())
        for bid in WAVE5_IDS if bid in story_idx
    )
    print("-" * 35, flush=True)
    print(f"{'TOTAL':<15} {tb:>5}/{total_total:<3} {ta:>5}/{total_total:<3}", flush=True)


if __name__ == "__main__":
    patch_hotspots()
