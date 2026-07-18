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

LUNA = ("Luna, a small white unicorn foal with a curly rainbow mane and tail, "
        "big friendly eyes and a tiny golden horn")

SCENES: dict[str, dict] = {
    "twinkle": {
        "bg_prompt": (
            f"A seamlessly tileable horizontal panoramic night sky strip, "
            f"deep indigo to dark purple gradient with many scattered twinkling "
            f"yellow and white stars of varying sizes, small wisps of semi-"
            f"transparent cloud, {STYLE}"
        ),
        "mid_prompt": (
            f"A seamlessly tileable horizontal panoramic mountain range strip "
            f"with transparent sky above, rolling purple-blue hills and jagged "
            f"peaks with snow-capped tops, silhouetted against twilight, "
            f"the bottom edge fades to dark green-blue, {STYLE}"
        ),
        "fg_prompt": (
            f"A seamlessly tileable horizontal panoramic meadow strip with "
            f"transparent sky above, lush green rolling hills covered in soft "
            f"grass and scattered small wildflowers in pink and yellow, gentle "
            f"undulating terrain, the top edge is a soft grassy horizon, {STYLE}"
        ),
        "vehicle_prompt": (
            f"{LUNA} happily riding in the wicker basket of a large colorful "
            f"hot-air balloon, the balloon envelope has wide stripes of cherry "
            f"red, sunny yellow, and sky blue, Luna is peeping over the basket "
            f"edge and waving one hoof, ropes connect basket to balloon, the "
            f"full balloon and basket visible, on a solid magenta (#FF00FF) "
            f"background, {STYLE}"
        ),
        "picker_prompt": (
            f"Portrait of {LUNA} smiling, head and upper body, looking directly "
            f"at the viewer, a small hot-air balloon floats behind her, on a "
            f"solid magenta (#FF00FF) background, {STYLE}"
        ),
        "objects": {
            "sky": [
                ("star", "a single bright twinkling golden five-pointed star with small sparkle rays radiating outward"),
                ("comet", "a single small shooting star with a bright white head and a glowing blue-white tail trailing behind"),
                ("moon_crescent", "a single small golden crescent moon with a gentle warm glow"),
                ("cloud_wispy", "a single small wispy semi-transparent white cloud"),
                ("rocket", "a single tiny colorful toy rocket ship with red nose cone, blue body, and an orange flame trail"),
                ("sparkle", "a single cluster of three small golden sparkles close together"),
            ],
            "mid": [
                ("rainbow", "a single small curved rainbow arc with all seven visible colors"),
                ("bird", "a single small cute bluebird in flight with wings spread"),
                ("cloud_puffy", "a single small round puffy white cloud"),
                ("owl", "a single small cute round owl with big yellow eyes perched"),
            ],
            "ground": [
                ("flower_pink", "a single small pink five-petal wildflower with a green stem"),
                ("flower_yellow", "a single small yellow sunflower with brown center and green stem"),
                ("tree_round", "a single small round bushy green tree with a brown trunk"),
                ("mushroom", "a single small red mushroom with white spots and a short white stem"),
                ("mountain_goat", "a single tiny cute white mountain goat standing"),
                ("tulip", "a single small red tulip flower with green stem and leaf"),
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
            f"Is this a high-quality panoramic landscape strip? "
            f"Requirements: {prompt.split(',')[0]}, no text, no UI, "
            f"painterly children's book style.",
            [img],
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
            f"Is this a clean sprite of: {prompt.split(',')[0]}? "
            f"Should be a single object, transparent background, "
            f"painterly children's book style, no text.",
            [sprite],
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

    # 3. Picker portrait
    if "picker_prompt" in spec:
        print("\nPicker portrait:")
        _gen_sprite(spec["picker_prompt"], "picker", scene_dir, size=256)

    # 4. Object sprites
    for zone, items in spec["objects"].items():
        print(f"\nObject sprites ({zone}):")
        for name, prompt in items:
            _gen_sprite(prompt, f"obj_{zone}_{name}", scene_dir, size=128)

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
