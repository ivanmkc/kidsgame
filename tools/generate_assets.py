"""Generate all game assets with Nano Banana Pro (Vertex, ADC).

Resumable: existing outputs are skipped, the manifest is rebuilt from
whatever is on disk plus what this run adds. Run from the repo root:

    python3 tools/generate_assets.py            # everything
    python3 tools/generate_assets.py --only icons
    python3 tools/generate_assets.py --only diff,hidden,ui
"""

from __future__ import annotations

import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from gen.nbp import generate  # noqa: E402
from gen.scenes import DIFF_THEMES, HIDDEN_THEMES, gen_diff_scene, gen_hidden_scene  # noqa: E402
from gen.spotit import ICONS, gen_icon  # noqa: E402

ROOT = Path(__file__).parent.parent
ASSETS = ROOT / "assets" / "game"
MANIFEST = ROOT / "src" / "assets" / "manifest.json"


def load_manifest() -> dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text())
    return {"spotit": {"icons": [n for n, _ in ICONS]}, "diff": [], "hidden": []}


def save_manifest(m: dict) -> None:
    # Merge with on-disk state by id so two runs (or icon + scene runs racing)
    # never clobber each other's completed entries.
    if MANIFEST.exists():
        disk = json.loads(MANIFEST.read_text())
        for key in ("diff", "hidden"):
            ours = {e["id"] for e in m[key]}
            m[key].extend(e for e in disk.get(key, []) if e["id"] not in ours)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(m, indent=2) + "\n")


def run_icons() -> bool:
    out = ASSETS / "spotit"
    out.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda nd: gen_icon(nd[0], nd[1], out), ICONS))
    return all(results)


def run_diff(manifest: dict) -> bool:
    out = ASSETS / "diff"
    out.mkdir(parents=True, exist_ok=True)
    done_ids = {e["id"] for e in manifest["diff"]}
    todo = [t for t in DIFF_THEMES if t["id"] not in done_ids]
    ok = True
    with ThreadPoolExecutor(max_workers=6) as pool:
        for entry in pool.map(lambda t: gen_diff_scene(t, out, seed=__import__("zlib").crc32(t["id"].encode()) ^ __import__("os").getpid()), todo):
            if entry:
                manifest["diff"].append(entry)
                save_manifest(manifest)
            else:
                ok = False
    return ok


def run_hidden(manifest: dict) -> bool:
    out = ASSETS / "hidden"
    out.mkdir(parents=True, exist_ok=True)
    done_ids = {e["id"] for e in manifest["hidden"]}
    todo = [t for t in HIDDEN_THEMES if t["id"] not in done_ids]
    ok = True
    with ThreadPoolExecutor(max_workers=5) as pool:
        for entry in pool.map(lambda t: gen_hidden_scene(t, out, seed=__import__("zlib").crc32(t["id"].encode()) ^ __import__("os").getpid()), todo):
            if entry:
                manifest["hidden"].append(entry)
                save_manifest(manifest)
            else:
                ok = False
    return ok


def run_ui() -> bool:
    out = ASSETS / "ui"
    out.mkdir(parents=True, exist_ok=True)
    jobs = {
        "menu_bg.png": (
            "Soft pastel background for a children's game menu: gentle cream-"
            "to-peach gradient, scattered tiny faded doodles of stars, balloons "
            "and clouds near the edges, large calm empty area in the middle. "
            "Very low contrast, decorative only. Portrait orientation. No text.",
            (768, 1152),
        ),
        "logo.png": (
            "A cheerful circus tent logo for a kids' game collection called a "
            "game box: bright red-and-cream striped big top tent with a golden "
            "star on top, bold cartoon sticker style with thick outline, on a "
            "plain solid bright magenta background (#FF00FF). No text.",
            (768, 768),
        ),
    }
    ok = True
    for fname, (prompt, size) in jobs.items():
        path = out / fname
        if path.exists():
            continue
        try:
            # logo is chroma-keyed, so let it come back at native aspect
            img = generate(prompt, None if fname == "logo.png" else size)
            if fname == "logo.png":
                from gen.chroma import key_out_magenta
                img, cov = key_out_magenta(img, out_size=512)
                if cov < 0.1:
                    print(f"  WARN {fname}: low coverage {cov}")
            img.save(path)
            print(f"  ui OK: {fname}")
        except Exception as e:  # noqa: BLE001
            print(f"  FAIL ui {fname}: {e}")
            ok = False
    return ok


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="icons,diff,hidden,ui")
    steps = set(ap.parse_args().only.split(","))

    manifest = load_manifest()
    ok = True
    if "icons" in steps:
        print("== Spot It icons ==")
        ok &= run_icons()
    if "diff" in steps:
        print("== Find-the-difference scenes ==")
        ok &= run_diff(manifest)
    if "hidden" in steps:
        print("== Hidden-object scenes ==")
        ok &= run_hidden(manifest)
    if "ui" in steps:
        print("== UI art ==")
        ok &= run_ui()

    save_manifest(manifest)
    print("manifest:", MANIFEST)
    print("ALL OK" if ok else "SOME STEPS FAILED (rerun to resume)")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
