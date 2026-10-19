"""Video regeneration runner using Veo and scene image as first frame.

Processes video regeneration jobs from artifact-review queues (F41e9de, G1.R6),
conditions Veo on the story node's scene illustration as the first frame, and
writes generated MP4s under 'candidates/' without replacing shipped assets.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

# Ensure tools/ is in sys.path for gen.* imports
_TOOLS_DIR = Path(__file__).resolve().parent.parent
if str(_TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(_TOOLS_DIR))

from google import genai
from google.genai import types

DEFAULT_MODEL = "veo-3.1-fast-generate-001"
DEFAULT_CANDIDATES_DIR = "candidates"

_HEROES_CACHE: dict[str, tuple[str, str]] | None = None
_SPECS_CACHE: dict[str, dict] | None = None


def parse_video_filename(filename_or_path: str) -> tuple[str, str, int] | None:
    """Extracts (story_id, node_id, choice_index) from a video filename or path.

    Index convention follows gen_story_videos.py:
      - non-negative int: choice transition index (e.g. 0, 1, 2)
      - -1: final scene ending animation (_end.mp4)
      - -2: scare surprise animation (_scare.mp4)
    """
    norm = filename_or_path.replace("\\", "/").rstrip("/")
    base = norm.split("/")[-1]
    if not base.endswith(".mp4"):
        return None
    stem = base[:-4]

    m_end = re.match(r"^([a-z0-9]+)_(.+)_(end)$", stem)
    if m_end:
        return m_end.group(1), m_end.group(2), -1

    m_scare = re.match(r"^([a-z0-9]+)_(.+)_(scare)$", stem)
    if m_scare:
        return m_scare.group(1), m_scare.group(2), -2

    m_num = re.match(r"^([a-z0-9]+)_(.+)_([0-9]+)$", stem)
    if m_num:
        return m_num.group(1), m_num.group(2), int(m_num.group(3))

    return None


def validate_candidate_path(
    candidates_dir: str | Path, asset_path: str, root_dir: str | Path = "."
) -> Path:
    """Validates that candidate path is within candidates_dir and does not overwrite shipped asset."""
    if not asset_path or not str(asset_path).strip():
        raise ValueError("Asset path cannot be empty")
    if not candidates_dir or not str(candidates_dir).strip():
        raise ValueError("Candidates directory cannot be empty")

    norm_asset = str(asset_path).replace("\\", "/")
    if norm_asset.startswith("./"):
        norm_asset = norm_asset[2:]
    norm_asset = norm_asset.lstrip("/")
    if not norm_asset:
        raise ValueError("Asset path cannot be empty")

    root = Path(root_dir).resolve()
    resolved_candidates = (root / candidates_dir).resolve()
    resolved_candidate = (resolved_candidates / norm_asset).resolve()

    try:
        resolved_candidate.relative_to(resolved_candidates)
    except ValueError as e:
        raise ValueError(f"Asset path escapes candidates directory: {asset_path}") from e

    resolved_shipped = (root / norm_asset).resolve()
    if resolved_candidate == resolved_shipped:
        raise ValueError(f"Candidate path cannot overwrite shipped asset: {asset_path}")

    return resolved_candidate


def load_specs_and_heroes(tools_dir: Path | None = None) -> tuple[dict[str, tuple[str, str]], dict[str, dict]]:
    """Loads all story hero definitions and story specs."""
    global _HEROES_CACHE, _SPECS_CACHE
    if tools_dir is None and _HEROES_CACHE is not None and _SPECS_CACHE is not None:
        return _HEROES_CACHE, _SPECS_CACHE

    td = tools_dir or _TOOLS_DIR
    gen_dir = td / "gen"

    from gen.story_specs import (
        CAST,
        CLOUD_CASTLE,
        COOKIE_CAPER,
        DEEP_SEA,
        LUNA,
        MILO,
        MO,
        NIGHT_MARKET,
        PIP,
        RAINBOW_DOORS,
        SCARE_SCHOOL,
        SKY_RACE,
        TREASURE_TRAIL,
        WHISPERING_HOUSE,
        YOKAI_PARADE,
    )
    from gen.story_specs_wave2 import NOVA, PEARL, REX, WAVE2_BY_ID, WILLOW
    from gen.story_specs_wave3 import WAVE3_BY_ID
    from gen.story_specs_wave4 import WAVE4_BY_ID
    from gen.story_specs_wave5 import WAVE5_BY_ID

    # Soften Mo for Veo filter safety, matching gen_story_videos.py
    safe_mo = MO.replace(
        "monster with one big friendly eye, tiny nub horns",
        "creature with one large cheerful eye, soft rounded bumps on his head",
    )

    heroes: dict[str, tuple[str, str]] = {
        "doors": ("Luna", LUNA),
        "trail": ("Pip", PIP),
        "night": ("Milo", MILO),
        "deep": ("Mo", safe_mo),
        "sky": ("Pip", PIP),
        "yokai": ("Milo", MILO),
        "cloud": ("Luna", LUNA),
        "cookie": ("Pip", PIP),
        "whisper": ("Milo", MILO),
        "scareschool": ("Mo", safe_mo),
    }

    hn = {
        "LUNA": ("Luna", LUNA),
        "PIP": ("Pip", PIP),
        "MILO": ("Milo", MILO),
        "MO": ("Mo", safe_mo),
        "NOVA": ("Nova", NOVA),
        "REX": ("Rex", REX),
        "WILLOW": ("Willow", WILLOW),
        "PEARL": ("Pearl", PEARL),
    }

    specs: dict[str, dict] = {
        "doors": RAINBOW_DOORS,
        "trail": TREASURE_TRAIL,
        "night": NIGHT_MARKET,
        "deep": DEEP_SEA,
        "sky": SKY_RACE,
        "yokai": YOKAI_PARADE,
        "cloud": CLOUD_CASTLE,
        "cookie": COOKIE_CAPER,
        "whisper": WHISPERING_HOUSE,
        "scareschool": SCARE_SCHOOL,
    }
    specs.update(WAVE2_BY_ID)
    specs.update(WAVE3_BY_ID)
    specs.update(WAVE4_BY_ID)
    specs.update(WAVE5_BY_ID)

    spec_dirs = ["specs_wave2", "specs_wave3", "specs_wave4", "specs_wave5", "specs_legacy"]
    for folder in spec_dirs:
        for f in sorted((gen_dir / folder).glob("*.json")):
            data = json.loads(f.read_text(encoding="utf-8"))
            sid = data["id"]
            hero_key = data.get("hero")
            if hero_key and hero_key in hn:
                heroes[sid] = hn[hero_key]
            specs[sid] = data

    if tools_dir is None:
        _HEROES_CACHE = heroes
        _SPECS_CACHE = specs
    return heroes, specs


def build_video_prompt(
    sid: str,
    nid: str,
    idx: int,
    root_dir: Path | None = None,
) -> str:
    """Builds Veo prompting for a story video following gen_story_videos.py."""
    tools_path = (root_dir / "tools") if (root_dir and (root_dir / "tools" / "gen").exists()) else None
    heroes, specs = load_specs_and_heroes(tools_path)

    hero_name, hero_desc = heroes[sid]
    spec = specs[sid]
    node = spec["nodes"][nid]

    if idx == -1:
        # Ending animation
        mood = "comic, bouncy" if node.get("bad") else "joyful, gentle"
        text = str(node["text"]).strip()[:120]
        prompt = (
            f"{hero_desc}. Animate this exact final storybook scene coming alive: "
            f"{mood}: {text}. The hero visibly moves the WHOLE time — swaying, "
            f"bouncing or dancing in place — AND at least one background element "
            f"(confetti, stars, water, leaves, steam) moves continuously; clear "
            f"visible motion in every second of the clip, never a still frame. "
            f"Nobody leaves frame, composition stays identical to the first frame "
            f"throughout. Bright children's picture-book style. No text."
        )
    elif idx == -2:
        # Scare surprise animation
        sc = node["scare"]
        pop = sc.get("pop", "a friendly little surprise creature")
        spot = sc.get("spot", "hiding spot")
        prompt = (
            f"{hero_desc}. Starting from this exact scene, a COMIC SURPRISE: {pop} "
            f"suddenly springs out from the {spot} with a big bouncy pop, lands with a "
            f"friendly wave, and the hero does a startled-then-delighted little jump. "
            f"The creature stays fully visible from its pop until the last frame and "
            f"the hero stays in position. Playful, funny, never frightening. "
            f"Composition stays close to the first frame. Bright children's "
            f"picture-book style. No text."
        )
    else:
        # In-scene choice action
        choices = node["choices"]
        choice = choices[idx]
        action = str(choice["label"]).rstrip("!.")
        spot = choice.get("spot", "chosen thing")
        prompt = (
            f"{hero_desc}. Starting from this exact scene, {hero_name} FULLY PERFORMS "
            f"this action from start to finish: {action}. The hero physically reaches "
            f"and engages with the {spot} — NOT just walking toward it. Show the "
            f"COMPLETE action: if climbing, the hero climbs up and over; if sliding, "
            f"the hero slides all the way down; if entering, the hero goes IN and "
            f"disappears through; if picking up, the hero grabs and holds it up; "
            f"if jumping, the hero leaps and lands. Full physical action arc from "
            f"approach to completion. The background and location stay EXACTLY as "
            f"in the first frame for the entire clip. Bright children's picture-book "
            f"style, consistent with the first frame. No text."
        )

    if sid == "globe":
        for pat, rep in (
            ("door-knocker", "heart charm"),
            ("keyhole", "little slot"),
            ("door", "archway"),
            ("key", "charm"),
        ):
            prompt = re.sub(rf"\b{pat}\b", rep, prompt)

    return prompt


def find_scene_image(
    sid: str,
    nid: str,
    root_dir: Path | None = None,
) -> tuple[bytes, str]:
    """Finds and reads the scene illustration conditioning image, returning (bytes, mime_type)."""
    root = (root_dir or Path(".")).resolve()
    scenes_dir = root / "assets" / "game" / "story"
    for ext, mime in [(".png", "image/png"), (".jpg", "image/jpeg")]:
        candidate = scenes_dir / f"{sid}_{nid}{ext}"
        if candidate.exists():
            return candidate.read_bytes(), mime

    raise FileNotFoundError(f"Scene image not found for {sid}_{nid} under {scenes_dir}")


def read_queue(queue_path: str | Path) -> list[dict]:
    """Reads video regeneration jobs from queue output file.

    Accepts queue output format (JSON file with a 'jobs' array),
    filtering for jobs where mediaKind == "video".
    """
    p = Path(queue_path)
    if not p.exists():
        raise FileNotFoundError(f"Queue file not found: {p}")
    data = json.loads(p.read_text(encoding="utf-8"))

    if not isinstance(data, dict) or "jobs" not in data or not isinstance(data["jobs"], list):
        raise ValueError("Invalid queue format: expected dict with 'jobs' array")

    video_jobs: list[dict] = []
    for item in data["jobs"]:
        if not isinstance(item, dict):
            raise ValueError(f"Invalid queue item: expected dict, got {type(item).__name__}")
        if item.get("mediaKind") == "video":
            video_jobs.append(dict(item))

    return video_jobs


def get_default_veo_client() -> Any:
    """Creates the default google-genai Vertex AI client."""
    project = os.environ.get("GOOGLE_CLOUD_PROJECT") or "ivanmkc-experimental-665175"
    return genai.Client(vertexai=True, project=project, location="us-central1")


def call_veo(
    client: Any,
    model: str,
    prompt: str,
    image_bytes: bytes,
    mime_type: str,
    duration_seconds: int = 6,
) -> bytes:
    """Calls Veo with the given prompt and first-frame image conditioning, returning MP4 bytes."""
    image_arg = types.Image(image_bytes=image_bytes, mime_type=mime_type)
    config_arg = types.GenerateVideosConfig(
        number_of_videos=1,
        duration_seconds=duration_seconds,
        aspect_ratio="16:9",
        resolution="720p",
        generate_audio=False,
        person_generation="allow_all",
    )

    op = client.models.generate_videos(
        model=model,
        prompt=prompt,
        image=image_arg,
        config=config_arg,
    )

    t0 = time.time()
    while not op.done:
        time.sleep(10)
        op = client.operations.get(op)
        if time.time() - t0 > 900:
            raise TimeoutError("Veo LRO timed out after 900s")

    if op.error:
        raise RuntimeError(str(op.error)[:200])

    resp = op.response or op.result
    return resp.generated_videos[0].video.video_bytes


def run_video_candidates(
    queue: str | Path,
    candidates_dir: str | Path = DEFAULT_CANDIDATES_DIR,
    root_dir: str | Path = ".",
    write_manifest: bool = True,
) -> list[dict]:
    """Processes video regeneration jobs, writing candidate MP4s without modifying shipped files."""
    root_path = Path(root_dir).resolve()
    cand_dir_path = (root_path / candidates_dir).resolve()
    jobs = read_queue(queue)
    manifest: list[dict] = []

    client = get_default_veo_client()

    for job in jobs:
        asset_path = job.get("asset", "")
        model = job.get("model", DEFAULT_MODEL)

        parsed = parse_video_filename(asset_path)
        if not parsed:
            manifest.append({
                "assetPath": asset_path,
                "candidatePath": None,
                "model": model,
                "status": "error",
                "reason": f"Cannot parse video asset filename: {asset_path}",
            })
            continue
        sid, nid, idx = parsed

        # Build prompt from spec
        try:
            prompt = build_video_prompt(sid, nid, idx, root_dir=root_path)
        except Exception as e:
            manifest.append({
                "assetPath": asset_path,
                "candidatePath": None,
                "model": model,
                "status": "error",
                "reason": f"Failed to build prompt: {e}",
            })
            continue

        # Locate scene image as first frame by convention
        try:
            image_bytes, mime_type = find_scene_image(
                sid,
                nid,
                root_dir=root_path,
            )
        except Exception as e:
            manifest.append({
                "assetPath": asset_path,
                "candidatePath": None,
                "model": model,
                "status": "error",
                "reason": f"Failed to find scene image: {e}",
            })
            continue

        # Validate candidate destination
        try:
            target_cand_path = validate_candidate_path(candidates_dir, asset_path, root_dir=root_path)
        except Exception as e:
            manifest.append({
                "assetPath": asset_path,
                "candidatePath": None,
                "model": model,
                "status": "error",
                "reason": f"Invalid candidate path: {e}",
            })
            continue

        # Call Veo model client
        try:
            video_bytes = call_veo(
                client,
                model=model,
                prompt=prompt,
                image_bytes=image_bytes,
                mime_type=mime_type,
            )
        except Exception as e:
            manifest.append({
                "assetPath": asset_path,
                "candidatePath": None,
                "model": model,
                "status": "error",
                "reason": f"Model generation failed: {e}",
            })
            continue

        # Write generated MP4 to candidate path
        try:
            target_cand_path.parent.mkdir(parents=True, exist_ok=True)
            target_cand_path.write_bytes(video_bytes)
        except Exception as e:
            manifest.append({
                "assetPath": asset_path,
                "candidatePath": None,
                "model": model,
                "status": "error",
                "reason": f"Failed to write candidate file: {e}",
            })
            continue

        rel_cand_path = str(target_cand_path.relative_to(root_path)).replace("\\", "/")
        manifest.append({
            "assetPath": asset_path,
            "candidatePath": rel_cand_path,
            "model": model,
            "status": "success",
        })

    if write_manifest:
        cand_dir_path.mkdir(parents=True, exist_ok=True)
        manifest_file = cand_dir_path / "candidates.json"
        manifest_file.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    return manifest


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate video candidates from regeneration queue using Veo."
    )
    parser.add_argument("queue", help="Path to regeneration queue JSON")
    parser.add_argument(
        "--candidates-dir", default=DEFAULT_CANDIDATES_DIR, help="Directory to write candidate files to"
    )
    parser.add_argument("--root-dir", default=".", help="Root directory of the repository")
    parser.add_argument("--no-manifest", action="store_true", help="Do not write candidates.json manifest")
    try:
        args = parser.parse_args(argv)
    except SystemExit:
        return 1

    try:
        results = run_video_candidates(
            queue=args.queue,
            candidates_dir=args.candidates_dir,
            root_dir=args.root_dir,
            write_manifest=not args.no_manifest,
        )
    except Exception as e:
        print(f"Error executing video candidate regeneration: {e}", file=sys.stderr)
        return 1

    successes = sum(1 for r in results if r["status"] == "success")
    errors = sum(1 for r in results if r["status"] == "error")
    print(f"Processed {len(results)} video jobs: {successes} succeeded, {errors} errors")
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
