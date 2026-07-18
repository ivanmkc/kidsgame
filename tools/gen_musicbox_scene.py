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
from gen.chroma import crossfade_loop, key_out_magenta, key_strip_magenta  # noqa: E402
from gen.judge import ask_yes_no, strict_min  # noqa: E402
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
PIP = ("Pip, a chubby golden puppy with floppy ears, a red collar with a bone "
       "tag, and a happy open-mouth smile")
MILO = ("Milo, a small black kitten with huge amber eyes, a white chest patch, "
        "carrying a tiny glowing lantern")

SCENES: dict[str, dict] = {
    "twinkle": {
        "vehicleY": 0.28,
        "bg_prompt": (
            f"A seamlessly tileable horizontal panoramic night sky strip, "
            f"deep indigo to dark purple gradient with many scattered twinkling "
            f"yellow and white stars of varying sizes, small wisps of semi-"
            f"transparent cloud, {STYLE}"
        ),
        "mid_prompt": (
            f"A seamlessly tileable horizontal panoramic mountain range strip "
            f"on a solid magenta (#FF00FF) background where the sky would be, "
            f"rolling purple-blue hills and jagged peaks with snow-capped tops, "
            f"silhouetted against twilight, the bottom edge fades to dark "
            f"green-blue, the sky region is solid magenta, {STYLE}"
        ),
        "fg_prompt": (
            f"A seamlessly tileable horizontal panoramic meadow strip on a "
            f"solid magenta (#FF00FF) background where the sky would be, "
            f"lush green rolling hills covered in soft grass and scattered "
            f"small wildflowers in pink and yellow, gentle undulating terrain, "
            f"the top edge is a soft grassy horizon against magenta, {STYLE}"
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
                ("owl", "a single small cute round owl with big yellow eyes, wings slightly spread, floating, no branch, no perch"),
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
    "row": {
        "vehicleY": 0.48,
        "bg_prompt": (
            f"A seamlessly tileable horizontal panoramic bright sunny sky strip, "
            f"cheerful blue sky with fluffy white cumulus clouds and warm golden "
            f"sunlight, a few seagulls in the distance, {STYLE}"
        ),
        "mid_prompt": (
            f"A seamlessly tileable horizontal panoramic ocean strip on a "
            f"solid magenta (#FF00FF) background where the sky would be, "
            f"sparkling turquoise-blue sea water with gentle rolling waves "
            f"and white foam crests, small tropical islands with palm trees "
            f"in the far distance, sky region is solid magenta, {STYLE}"
        ),
        "fg_prompt": (
            f"A seamlessly tileable horizontal panoramic ocean surface strip "
            f"on a solid magenta (#FF00FF) background where the sky would be, "
            f"close-up deep blue-green waves with white foam and spray, seaweed "
            f"and small bubbles at the bottom, coral reef shapes peeking above "
            f"the water line, sky region is solid magenta, {STYLE}"
        ),
        "vehicle_prompt": (
            f"{PIP} happily sitting in a small red wooden rowboat with two "
            f"little oars, Pip is peeking over the side with tongue out, the "
            f"boat bobs on gentle waves, full boat and character visible, on a "
            f"solid magenta (#FF00FF) background, {STYLE}"
        ),
        "picker_prompt": (
            f"Portrait of {PIP} smiling, head and upper body, wearing a small "
            f"sailor hat, looking directly at the viewer, a tiny anchor in the "
            f"background, on a solid magenta (#FF00FF) background, {STYLE}"
        ),
        "objects": {
            "sky": [
                ("seagull", "a single small cute white seagull in flight with wings spread"),
                ("cloud_fluffy", "a single small round fluffy white cloud"),
                ("sun_rays", "a single small cheerful golden sun with short rays radiating outward"),
                ("pelican", "a single small cute brown pelican carrying a fish in its beak"),
            ],
            "mid": [
                ("dolphin", "a single small cute grey dolphin leaping out of water with a splash"),
                ("fish_orange", "a single small bright orange clownfish swimming"),
                ("jellyfish", "a single small pink jellyfish with trailing tentacles"),
                ("sea_turtle", "a single small cute green sea turtle swimming"),
            ],
            "ground": [
                ("starfish", "a single small orange five-armed starfish"),
                ("shell_pink", "a single small pink conch seashell"),
                ("crab", "a single small cute red crab with big claws"),
                ("seahorse", "a single small cute yellow seahorse"),
                ("coral", "a single small piece of bright orange fan coral"),
                ("anchor", "a single small rustic brown anchor with a rope"),
            ],
        },
    },
    "jingle": {
        "vehicleY": 0.42,
        "bg_prompt": (
            f"A seamlessly tileable horizontal panoramic winter sky strip, "
            f"pale grey-blue sky with soft clouds and gently falling snowflakes, "
            f"hints of aurora borealis green and purple at the top, {STYLE}"
        ),
        "mid_prompt": (
            f"A seamlessly tileable horizontal panoramic snowy pine forest strip "
            f"on a solid magenta (#FF00FF) background where the sky would be, "
            f"snow-covered evergreen pine trees of varying sizes in the distance, "
            f"soft blue-white snow drifts, gentle rolling snowy hills, sky region "
            f"is solid magenta, {STYLE}"
        ),
        "fg_prompt": (
            f"A seamlessly tileable horizontal panoramic snowy ground strip "
            f"on a solid magenta (#FF00FF) background where the sky would be, "
            f"close-up fresh white snow with gentle hills and sled tracks, "
            f"scattered pine needles and small frozen puddles, sparkly frost "
            f"texture, sky region is solid magenta, {STYLE}"
        ),
        "vehicle_prompt": (
            f"{MILO} bundled up in a red scarf sitting on a wooden sled with "
            f"curved runners, the sled is sliding down a snowy slope, Milo's "
            f"scarf flutters behind, full sled and character visible, on a "
            f"solid magenta (#FF00FF) background, {STYLE}"
        ),
        "picker_prompt": (
            f"Portrait of {MILO} wearing a red scarf, head and upper body, "
            f"looking directly at the viewer, snowflakes in the air around him, "
            f"on a solid magenta (#FF00FF) background, {STYLE}"
        ),
        "objects": {
            "sky": [
                ("snowflake", "a single small delicate white snowflake crystal"),
                ("snowflake_big", "a single large intricate white snowflake with six-fold symmetry"),
                ("cardinal", "a single small cute bright red cardinal bird perched"),
                ("cloud_snowy", "a single small grey cloud with tiny snowflakes falling from it"),
            ],
            "mid": [
                ("pine_tree", "a single small snow-covered evergreen pine tree"),
                ("snowman", "a single small cute snowman with a top hat, carrot nose, and stick arms"),
                ("deer", "a single small cute brown deer with small antlers standing"),
                ("cabin", "a single small cozy log cabin with a smoking chimney and warm window glow"),
            ],
            "ground": [
                ("gift_red", "a single small wrapped gift box with red paper and a gold ribbon bow"),
                ("gift_blue", "a single small wrapped gift box with blue paper and a silver ribbon"),
                ("holly", "a single small sprig of green holly with three red berries"),
                ("candy_cane", "a single small red and white striped candy cane"),
                ("snow_bunny", "a single small cute white bunny sitting in the snow"),
                ("mitten", "a single small red knitted mitten with white snowflake pattern"),
            ],
        },
    },
}


def _verify_tileable(img: Image.Image, threshold: int = 30) -> bool:
    """Check if left and right edge columns are similar enough to tile.

    Tiles 2x and checks that the join column is seamless (last col of
    first tile vs first col of second tile).
    """
    arr = np.array(img)
    # Direct left/right edge comparison
    left = arr[:, :4, :3].astype(float)
    right = arr[:, -4:, :3].astype(float)
    diff = np.abs(left - right).mean()
    if diff >= threshold:
        print(f"    tile-seam diff={diff:.1f} (threshold={threshold}) — retrying")
        return False
    # Tile 2x verification: the join column between tile copies
    join_left = arr[:, -1, :3].astype(float)
    join_right = arr[:, 0, :3].astype(float)
    join_diff = np.abs(join_left - join_right).mean()
    if join_diff >= threshold:
        print(f"    join-col diff={join_diff:.1f} (threshold={threshold}) — retrying")
        return False
    return True


def _gen_strip(prompt: str, name: str, out_dir: Path, max_retries: int = 8,
               magenta_key: bool = False) -> Path:
    """Generate a panoramic strip, judge-gated + tile-verified.

    With *magenta_key=True* the strip is generated 1408 wide on a magenta
    backdrop, chroma-keyed to true RGBA, then crossfaded into a seamless
    1280-wide loop.
    """
    path = out_dir / f"{name}.png"
    if path.exists():
        print(f"  skip {name} (exists)")
        return path

    gen_w = 1408 if magenta_key else 1280

    for attempt in range(max_retries):
        print(f"  gen {name} (attempt {attempt + 1})...")
        full_prompt = f"{prompt}. The image must tile seamlessly when repeated horizontally — the left edge must match the right edge exactly in color and content."
        img = generate(full_prompt, size=(gen_w, 400))

        if magenta_key:
            # Verify NBP actually rendered a magenta sky region before keying.
            # The top rows must be close to #FF00FF; if the model ignored the
            # magenta instruction the key_strip_magenta call would produce a
            # fully opaque strip (broken transparency).
            top_rgb = np.array(img)[:5, :, :].mean(axis=(0, 1))
            is_magenta = top_rgb[0] > 180 and top_rgb[2] > 180 and top_rgb[1] < 100
            if not is_magenta:
                print(f"    top rows not magenta (R={top_rgb[0]:.0f} G={top_rgb[1]:.0f} B={top_rgb[2]:.0f}) — retrying")
                continue
            img = key_strip_magenta(img)
            img = crossfade_loop(img, final_w=1280, fade_w=128)

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

        # coverage = fraction of pixels that are OPAQUE (content); we need
        # both content (>5%) and enough transparent background (>20%) to
        # confirm the chroma key worked — if almost everything is opaque the
        # key didn't fire and we'd ship an opaque rectangle.
        arr = np.array(sprite)
        transparent_pct = (arr[:, :, 3] == 0).sum() / arr[:, :, 3].size
        if coverage < 0.05:
            print(f"    low coverage {coverage:.2f} — retrying")
            continue
        if transparent_pct < 0.20:
            print(f"    chroma key failed ({transparent_pct:.0%} transparent) — retrying")
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


def _composite_scene(scene_dir: Path, spec: dict) -> Image.Image:
    """Build a full composite of bg + mid + fg + vehicle + 3 sample spawns.

    Uses the actual game stage proportions (1024x668) so layers overlap
    realistically: bg fills the stage top-aligned, mid is bottom-aligned
    at 650px, fg is bottom-aligned at 380px.
    """
    STAGE_W, STAGE_H = 1024, 668
    BG_H, MID_H, FG_H = 900, 650, 380

    bg = Image.open(scene_dir / "bg.png").convert("RGBA")
    mid = Image.open(scene_dir / "mid.png").convert("RGBA")
    fg = Image.open(scene_dir / "fg.png").convert("RGBA")
    vehicle = Image.open(scene_dir / "vehicle.png").convert("RGBA")

    comp = Image.new("RGBA", (STAGE_W, STAGE_H))

    bg_scaled = bg.resize((STAGE_W, BG_H), Image.Resampling.LANCZOS)
    comp.paste(bg_scaled, (0, 0))

    mid_scaled = mid.resize((STAGE_W, MID_H), Image.Resampling.LANCZOS)
    mid_layer = Image.new("RGBA", (STAGE_W, STAGE_H), (0, 0, 0, 0))
    mid_layer.paste(mid_scaled, (0, STAGE_H - MID_H))
    comp = Image.alpha_composite(comp, mid_layer)

    vehicle_y = spec.get("vehicleY", 0.35)
    vx = STAGE_W // 5
    vy = int(STAGE_H * vehicle_y) - vehicle.height // 2
    comp.paste(vehicle, (vx, max(0, vy)), vehicle)

    fg_scaled = fg.resize((STAGE_W, FG_H), Image.Resampling.LANCZOS)
    fg_layer = Image.new("RGBA", (STAGE_W, STAGE_H), (0, 0, 0, 0))
    fg_layer.paste(fg_scaled, (0, STAGE_H - FG_H))
    comp = Image.alpha_composite(comp, fg_layer)

    zones = list(spec["objects"].items())
    spawn_y = {"sky": 0.15, "mid": 0.45, "ground": 0.75}
    for zi, (zone, items) in enumerate(zones):
        if items:
            name = items[0][0]
            p = scene_dir / f"obj_{zone}_{name}.png"
            if p.exists():
                sprite = Image.open(p).convert("RGBA")
                sx = STAGE_W // 2 + zi * 80
                sy = int(STAGE_H * spawn_y.get(zone, 0.5)) - sprite.height // 2
                comp.paste(sprite, (sx, max(0, sy)), sprite)
    return comp.convert("RGB")


def _composite_judge_gate(scene_dir: Path, spec: dict,
                          max_retries: int = 3) -> bool:
    """Dual-judge strict-min on the composited scene.

    Returns True if the scene passes; False means the caller must delete
    failing pieces and regenerate.
    """
    for attempt in range(max_retries):
        comp = _composite_scene(scene_dir, spec)
        comp_path = scene_dir / "_composite_check.png"
        comp.save(comp_path)
        ok = strict_min(
            "Look at this composited game scene carefully. Are there ANY "
            "rectangular seams, cut edges, banding artifacts, ghost or "
            "semi-transparent characters, white fringe, or opaque background "
            "patches around sprites? Answer YES if the image is CLEAN (no "
            "such artifacts), NO if any artifacts are present.",
            "Is this one coherent hand-illustrated children's book scene? "
            "All elements should look like they belong in the same painting, "
            "with consistent style and lighting. Answer YES or NO.",
            [comp],
        )
        if ok:
            print(f"  composite judge: PASS (attempt {attempt + 1})")
            comp_path.unlink(missing_ok=True)
            return True
        print(f"  composite judge: FAIL (attempt {attempt + 1})")
    comp_path.unlink(missing_ok=True)
    return False


def gen_scene(scene_id: str) -> None:
    """Generate all assets for one music-box scene."""
    spec = SCENES.get(scene_id)
    if not spec:
        print(f"Unknown scene: {scene_id}")
        sys.exit(1)

    scene_dir = OUT / scene_id
    scene_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n=== Music Box scene: {scene_id} ===\n")

    # 1. Panoramic strips (bg is opaque; mid/fg use magenta chroma for RGBA)
    print("Panoramic strips:")
    _gen_strip(spec["bg_prompt"], "bg", scene_dir)
    _gen_strip(spec["mid_prompt"], "mid", scene_dir, magenta_key=True)
    _gen_strip(spec["fg_prompt"], "fg", scene_dir, magenta_key=True)

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

    # 5. Composite judge gate: verify the assembled scene is artifact-free
    print("\nComposite judge gate:")
    if not _composite_judge_gate(scene_dir, spec):
        print(f"  WARNING: composite judge failed for {scene_id} after retries")
        print(f"  Artifacts may remain — manual review required")

    # 6. Update manifest
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
    scene_id = sys.argv[1] if len(sys.argv) > 1 else "all"
    if scene_id == "all":
        for sid in SCENES:
            gen_scene(sid)
    else:
        gen_scene(scene_id)
