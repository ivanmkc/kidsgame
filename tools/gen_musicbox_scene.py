"""Generate Music Box v2 panoramic scene strips and sprites.

Per scene (starting with twinkle):
1. Three parallax panoramic strips (background, midground, foreground) — wide
   tileable landscape art for horizontal scrolling.
2. Character-in-vehicle sprite on magenta -> chroma-keyed RGBA.
3. Tap-spawned object sprites on magenta -> chroma-keyed RGBA.

All art uses a consistent warm, painterly, rounded children's book style
(Sago-Mini-esque). Panoramic strips are prompted for seamless horizontal
tiling and verified by diffing left/right edge columns.

Usage: python3 tools/gen_musicbox_scene.py [scene_id]
       (defaults to 'twinkle'; resumes from existing files)
"""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from gen.chroma import key_out_magenta  # noqa: E402
from gen.judge import ask_yes_no  # noqa: E402
from gen.nbp import generate  # noqa: E402
from PIL import Image  # noqa: E402

ROOT = Path(__file__).parent.parent
OUT = ROOT / "assets" / "game" / "musicbox"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"

STYLE = (
    "warm painterly children's book illustration style, soft rounded shapes, "
    "gentle colors, hand-painted texture, simple and charming, no text, "
    "no UI elements, no harsh shadows"
)

SCENES: dict[str, dict] = {
    "twinkle": {
        "bg_prompt": (
            f"A seamlessly tileable horizontal panoramic night sky strip, "
            f"deep indigo to purple gradient with scattered twinkling stars, "
            f"a crescent moon, wisps of cloud, {STYLE}"
        ),
        "mid_prompt": (
            f"A seamlessly tileable horizontal panoramic mountain range strip, "
            f"rolling purple-blue hills and peaks, some with snow caps, "
            f"silhouetted against a twilight sky, {STYLE}"
        ),
        "fg_prompt": (
            f"A seamlessly tileable horizontal panoramic meadow strip, "
            f"lush green rolling hills with wildflowers, soft grass, "
            f"gentle undulations, {STYLE}"
        ),
        "vehicle_prompt": (
            f"A cute cheerful bunny character wearing a red scarf, riding in "
            f"the basket of a colorful hot-air balloon with stripes of red, "
            f"yellow, and blue, the bunny is waving, full body view, "
            f"on a solid magenta (#FF00FF) background, {STYLE}"
        ),
        "objects": {
            "sky": [
                ("star", "a bright twinkling golden star with sparkle rays"),
                ("comet", "a small shooting star with a glowing tail"),
                ("moon_crescent", "a small crescent moon glowing softly"),
                ("cloud_wispy", "a small wispy white cloud"),
                ("rocket", "a tiny colorful toy rocket with a flame trail"),
                ("sparkle", "a cluster of three small sparkles"),
            ],
            "mid": [
                ("rainbow", "a small curved rainbow arc"),
                ("bird", "a small cute bird in flight"),
                ("cloud_puffy", "a small puffy white cloud"),
                ("eagle", "a small friendly eagle soaring"),
            ],
            "ground": [
                ("flower_pink", "a small pink wildflower"),
                ("flower_yellow", "a small yellow sunflower"),
                ("tree_round", "a small round green tree"),
                ("mushroom", "a small red-and-white mushroom"),
                ("mountain_goat", "a tiny cute mountain goat"),
                ("tulip", "a small red tulip"),
            ],
        },
    },
}


def _verify_tileable(img: Image.Image, threshold: int = 30) -> bool:
    """Check if left and right edge columns are similar enough to tile."""
    arr = np.array(img)
    left = arr[:, :4, :3].astype(float)
    right = arr[:, -4:, :3].astype(float)
    diff = np.abs(left - right).mean()
    ok = diff < threshold
    if not ok:
        print(f"    tile-seam diff={diff:.1f} (threshold={threshold}) — retrying")
    return ok


def _gen_strip(prompt: str, name: str, out_dir: Path, max_retries: int = 4) -> Path:
    """Generate a panoramic strip, judge-gated + tile-verified."""
    path = out_dir / f"{name}.png"
    if path.exists():
        print(f"  skip {name} (exists)")
        return path

    for attempt in range(max_retries):
        print(f"  gen {name} (attempt {attempt + 1})...")
        full_prompt = f"{prompt}. The image must tile seamlessly when repeated horizontally — the left edge must match the right edge exactly in color and content."
        img = generate(full_prompt, size=(1280, 400))

        if not _verify_tileable(img):
            continue

        ok = ask_yes_no(
            img,
            f"Is this a high-quality panoramic landscape strip? "
            f"Requirements: {prompt.split(',')[0]}, no text, no UI, "
            f"painterly children's book style."
        )
        if ok:
            img.save(path)
            print(f"  saved {name}")
            return path
        print(f"  judge rejected {name}")

    # Best-effort fallback: save last attempt
    print(f"  fallback save {name}")
    img.save(path)
    return path


def _gen_sprite(prompt: str, name: str, out_dir: Path, size: int = 256,
                max_retries: int = 4) -> Path:
    """Generate a chroma-keyed sprite on magenta background."""
    path = out_dir / f"{name}.png"
    if path.exists():
        print(f"  skip {name} (exists)")
        return path

    for attempt in range(max_retries):
        print(f"  gen {name} (attempt {attempt + 1})...")
        full_prompt = (
            f"{prompt}, centered in frame, on a solid magenta (#FF00FF) "
            f"background, {STYLE}"
        )
        img = generate(full_prompt, size=(512, 512))
        sprite, coverage = key_out_magenta(img, out_size=size)

        if coverage < 0.05:
            print(f"    low coverage {coverage:.2f} — retrying")
            continue

        ok = ask_yes_no(
            sprite,
            f"Is this a clean sprite of: {prompt.split(',')[0]}? "
            f"Should be a single object, transparent background, "
            f"painterly children's book style, no text."
        )
        if ok:
            sprite.save(path)
            print(f"  saved {name}")
            return path
        print(f"  judge rejected {name}")

    print(f"  fallback save {name}")
    sprite.save(path)
    return path


def gen_scene(scene_id: str) -> None:
    """Generate all assets for one music-box scene."""
    spec = SCENES.get(scene_id)
    if not spec:
        print(f"Unknown scene: {scene_id}")
        sys.exit(1)

    scene_dir = OUT / scene_id
    scene_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n=== Music Box scene: {scene_id} ===\n")

    # 1. Panoramic strips
    print("Panoramic strips:")
    _gen_strip(spec["bg_prompt"], "bg", scene_dir)
    _gen_strip(spec["mid_prompt"], "mid", scene_dir)
    _gen_strip(spec["fg_prompt"], "fg", scene_dir)

    # 2. Vehicle sprite
    print("\nVehicle sprite:")
    _gen_sprite(spec["vehicle_prompt"], "vehicle", scene_dir, size=300)

    # 3. Object sprites
    for zone, items in spec["objects"].items():
        print(f"\nObject sprites ({zone}):")
        for name, prompt in items:
            _gen_sprite(prompt, f"obj_{zone}_{name}", scene_dir, size=80)

    # 4. Update manifest
    manifest_path = MANIFEST
    with open(manifest_path) as f:
        manifest = json.load(f)
    if "musicbox" not in manifest:
        manifest["musicbox"] = {}
    manifest["musicbox"][scene_id] = {
        "strips": ["bg", "mid", "fg"],
        "vehicle": "vehicle",
        "objects": {
            zone: [name for name, _ in items]
            for zone, items in spec["objects"].items()
        },
    }
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print(f"\nManifest updated: musicbox.{scene_id}")


if __name__ == "__main__":
    scene_id = sys.argv[1] if len(sys.argv) > 1 else "twinkle"
    gen_scene(scene_id)
