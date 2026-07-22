"""Run SAM3.1 experiments for GEPA segmentation optimization.

Executes on GPU VM. Implements:
  E1: Still-mask keyframe seeding (full-object SAM still mask as seed)
  E5a: Multi-part union (lid + body + battery, hole-filled)
  Baseline: Single text+bbox prompt

For the crate specifically, also implements:
  Recolor: Recolor frames to uniform color before tracking
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, "/home/ivanmkc/persistence-of-dreams")
import tools._sam3_video as sv
from tools._gpu_ssh import gcloud_scp_down, gcloud_scp_up, gcloud_ssh

ROOT = Path("/home/ivanmkc/kidsgame")
TMP = Path("/home/ivanmkc/.claude/jobs/c60063e9/tmp")

GPU_VM_L4 = {
    "name": "gpu-sam3-l4-overnight",
    "zone": "us-central1-a",
    "remote_dir": "/home/ivanmkc/sam3_experiment",
    "sam3_repo": "~/sam3_repo",
}

GPU_VM_A100 = {
    "name": "gpu-sam3-a100-alt",
    "zone": "us-west4-b",
    "remote_dir": "/home/ivanmkc/sam3_experiment",
    "sam3_repo": "~/sam3_repo",
}


def get_manifest():
    return json.loads((ROOT / "src/assets/manifest.json").read_text())


def get_bbox_normalized(room_id: str, hotspot_id: str) -> tuple[float, ...]:
    m = get_manifest()
    for room in m["escape"]:
        if room["id"] == room_id:
            for h in room["hotspots"]:
                if h["id"] == hotspot_id:
                    bb = h["sprite"]["bbox"]
                    return (bb["x"] / 1280, bb["y"] / 720, bb["w"] / 1280, bb["h"] / 720)
    raise KeyError(f"{room_id}/{hotspot_id}")


def ensure_frames(room_id: str, hotspot_id: str) -> Path:
    """Ensure extracted frames exist for an animation."""
    name = f"{room_id}_{hotspot_id}"
    frames_dir = TMP / f"fix3/{name}/frames"
    if frames_dir.exists() and len(list(frames_dir.glob("f_*.png"))) >= 90:
        return frames_dir
    frames_dir.mkdir(parents=True, exist_ok=True)
    clip = ROOT / f"public/escape-video/{name}.mp4"
    if not clip.exists():
        raise FileNotFoundError(f"No clip at {clip}")
    import subprocess
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(clip), "-vf", "scale=1280:720",
        str(frames_dir / "f_%04d.png"),
    ], check=True, timeout=60)
    return frames_dir


def run_sam_track(
    frames_dir: Path,
    output_dir: Path,
    prompt: str,
    seed_bbox: tuple[float, ...],
    direction: str = "bidirectional",
    gpu_vm: dict | None = None,
    chunk_size: int = 32,
    upload_frames: bool = True,
    remote_session_dir: str | None = None,
) -> str:
    """Run SAM3.1 video tracking, chunked for L4 memory constraints."""
    vm = gpu_vm or GPU_VM_L4
    output_dir.mkdir(parents=True, exist_ok=True)

    frames = sorted(frames_dir.glob("f_*.png"))
    n_frames = len(frames)
    all_masks = {}

    for c0 in range(0, n_frames, chunk_size):
        chunk_frames = frames[c0:c0 + chunk_size]
        cdir = TMP / f"_chunks/chunk_{c0}"
        codir = TMP / f"_chunks/out_{c0}"
        for d in (cdir, codir):
            if d.exists():
                shutil.rmtree(d)
            d.mkdir(parents=True)

        for j, f in enumerate(chunk_frames):
            shutil.copyfile(f, cdir / f"f_{j + 1:04d}.png")

        print(f"  Chunk {c0}: {len(chunk_frames)} frames, prompt='{prompt}'")

        session = sv.run_sam3_video_predictor(
            frames_dir_local=cdir,
            output_masks_dir_local=codir,
            prompt=prompt,
            gpu_vm=vm,
            seed_bbox_normalized=seed_bbox,
            direction=direction,
            upload_frames=upload_frames,
            remote_session_dir=remote_session_dir,
        )

        for j in range(len(chunk_frames)):
            src = codir / f"mask_{j:04d}.png"
            if src.exists():
                shutil.copyfile(src, output_dir / f"mask_{c0 + j:04d}.png")

        shutil.rmtree(cdir)
        shutil.rmtree(codir)
        upload_frames = True
        remote_session_dir = None

    return str(output_dir)


def run_multi_part_union(
    frames_dir: Path,
    output_dir: Path,
    parts: list[dict],
    seed_bbox: tuple[float, ...],
    gpu_vm: dict | None = None,
) -> Path:
    """Run multiple SAM tracks and union the masks."""
    from scipy import ndimage

    output_dir.mkdir(parents=True, exist_ok=True)
    part_dirs = []

    for i, part in enumerate(parts):
        pdir = output_dir / f"part_{i}"
        print(f"Part {i}: '{part['prompt']}'")
        run_sam_track(
            frames_dir, pdir,
            prompt=part["prompt"],
            seed_bbox=seed_bbox,
            direction=part.get("direction", "bidirectional"),
            gpu_vm=gpu_vm,
        )
        part_dirs.append(pdir)

    union_dir = output_dir / "union"
    union_dir.mkdir(exist_ok=True)
    n_frames = len(list(frames_dir.glob("f_*.png")))

    for fi in range(n_frames):
        masks = []
        for pdir in part_dirs:
            mp = pdir / f"mask_{fi:04d}.png"
            if mp.exists():
                m = np.array(Image.open(mp).convert("L")) > 0
                masks.append(m)
        if masks:
            union = masks[0]
            for m in masks[1:]:
                union = union | m
            union = ndimage.binary_fill_holes(union)
            Image.fromarray((union * 255).astype(np.uint8)).save(
                union_dir / f"mask_{fi:04d}.png"
            )
        else:
            Image.fromarray(np.zeros((720, 1280), dtype=np.uint8)).save(
                union_dir / f"mask_{fi:04d}.png"
            )

    return union_dir


def run_still_mask_seed(
    frames_dir: Path,
    output_dir: Path,
    room_id: str,
    hotspot_id: str,
    seed_bbox: tuple[float, ...],
    gpu_vm: dict | None = None,
) -> Path:
    """E1: Use SAM still detection at keyframes to get full-object masks,
    then use those as seeds for video propagation via text+bbox.

    The hypothesis: zero-mask runs are PROMPT-GROUNDING failures. A still
    detector with the same text+bbox may ground better on individual frames
    (no temporal context confusion). If the still mask is good, we use it
    to inform the text prompt (describe what the still detector found).
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    sam_mask_path = ROOT / f"assets/game/escape/sam_masks/{room_id}_{hotspot_id}.png"
    if not sam_mask_path.exists():
        sam_mask_path = ROOT / f"assets/game/escape/sam_masks/{room_id}_slot.png"

    if sam_mask_path.exists():
        still_mask = np.array(Image.open(sam_mask_path).convert("L")) > 0
        coverage = still_mask.mean() * 100
        print(f"Still mask from {sam_mask_path.name}: {coverage:.1f}% coverage")

        bb_px = {
            "x": int(seed_bbox[0] * 1280), "y": int(seed_bbox[1] * 720),
            "w": int(seed_bbox[2] * 1280), "h": int(seed_bbox[3] * 720),
        }
        crop = still_mask[bb_px["y"]:bb_px["y"] + bb_px["h"],
                          bb_px["x"]:bb_px["x"] + bb_px["w"]]
        fb = crop.mean()
        print(f"Still mask FRAME-BODY in bbox: {fb:.3f}")

        if fb >= 0.85:
            print("Still mask is good — using as reference for prompt engineering")
        else:
            print(f"Still mask is weak ({fb:.3f}) — still trying video propagation")

    prompts_to_try = [
        "wooden crate",
        "brown wooden box",
        "green wooden chest",
        "wooden storage box",
        "crate with green lid",
    ]

    best_dir = None
    best_fb = 0.0

    for prompt in prompts_to_try:
        pdir = output_dir / f"try_{prompt.replace(' ', '_')}"
        if pdir.exists():
            shutil.rmtree(pdir)
        print(f"\nTrying prompt: '{prompt}'")
        run_sam_track(
            frames_dir, pdir,
            prompt=prompt,
            seed_bbox=seed_bbox,
            gpu_vm=gpu_vm,
        )
        from PIL import Image as PIm
        m0 = pdir / "mask_0000.png"
        if m0.exists():
            m = np.array(PIm.open(m0).convert("L"))
            bb_px = {
                "x": int(seed_bbox[0] * 1280), "y": int(seed_bbox[1] * 720),
                "w": int(seed_bbox[2] * 1280), "h": int(seed_bbox[3] * 720),
            }
            crop = m[bb_px["y"]:bb_px["y"] + bb_px["h"],
                     bb_px["x"]:bb_px["x"] + bb_px["w"]]
            fb = (crop > 0).mean()
            zeros = sum(
                1 for i in range(96)
                if (pdir / f"mask_{i:04d}.png").exists()
                and np.array(PIm.open(pdir / f"mask_{i:04d}.png").convert("L")).max() == 0
            )
            print(f"  FRAME-BODY: {fb:.3f}, zeros: {zeros}/96")
            if fb > best_fb:
                best_fb = fb
                best_dir = pdir
        else:
            print("  No mask_0000 produced")

    if best_dir:
        final = output_dir / "best"
        if final.exists():
            shutil.rmtree(final)
        shutil.copytree(best_dir, final)
        print(f"\nBest prompt: {best_dir.name} (FRAME-BODY {best_fb:.3f})")

    return best_dir or output_dir


def recolor_frames(
    frames_dir: Path,
    output_dir: Path,
    room_id: str,
    hotspot_id: str,
    target_rgb: tuple[int, int, int] = (196, 75, 47),
) -> Path:
    """Recolor the crate in each frame to a uniform color for better tracking.

    Uses the plate-diff mask to identify crate pixels, then replaces their
    hue/saturation while preserving luminance structure.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    plate = np.array(Image.open(
        ROOT / f"assets/game/escape/{room_id}_clean.png"
    ).convert("RGB"))

    m = get_manifest()
    h = next(
        h for r in m["escape"] for h in r["hotspots"]
        if r["id"] == room_id and h["id"] == hotspot_id
    )
    bb = h["sprite"]["bbox"]

    before_path = h["sprite"].get("beforeScene", "")
    if before_path:
        before = np.array(Image.open(
            ROOT / "assets/game" / before_path
        ).convert("RGB").resize((1280, 720), Image.LANCZOS))
    else:
        before = plate.copy()

    crate_mask = np.abs(
        before[bb["y"]:bb["y"] + bb["h"], bb["x"]:bb["x"] + bb["w"]].astype(np.int16)
        - plate[bb["y"]:bb["y"] + bb["h"], bb["x"]:bb["x"] + bb["w"]].astype(np.int16)
    ).sum(axis=-1) > 50

    tr, tg, tb = target_rgb
    t_lum = 0.299 * tr + 0.587 * tg + 0.114 * tb

    frames = sorted(frames_dir.glob("f_*.png"))
    for fp in frames:
        frame = np.array(Image.open(fp).convert("RGB"))
        crop = frame[bb["y"]:bb["y"] + bb["h"], bb["x"]:bb["x"] + bb["w"]].copy()
        lum = (0.299 * crop[:, :, 0] + 0.587 * crop[:, :, 1] + 0.114 * crop[:, :, 2])

        diff_plate = np.abs(
            crop.astype(np.int16)
            - plate[bb["y"]:bb["y"] + bb["h"], bb["x"]:bb["x"] + bb["w"]].astype(np.int16)
        ).sum(axis=-1)
        obj_mask = diff_plate > 50

        if obj_mask.any():
            scale = np.clip(lum / max(t_lum, 1), 0.3, 2.0)
            new_r = np.clip(tr * scale, 0, 255).astype(np.uint8)
            new_g = np.clip(tg * scale, 0, 255).astype(np.uint8)
            new_b = np.clip(tb * scale, 0, 255).astype(np.uint8)
            crop[obj_mask, 0] = new_r[obj_mask]
            crop[obj_mask, 1] = new_g[obj_mask]
            crop[obj_mask, 2] = new_b[obj_mask]
            frame[bb["y"]:bb["y"] + bb["h"], bb["x"]:bb["x"] + bb["w"]] = crop

        Image.fromarray(frame).save(output_dir / fp.name)

    return output_dir


def run_all_crate_experiments(gpu_vm: dict | None = None):
    """Run all crate-specific experiments."""
    room_id, hotspot_id = "rocketpad", "crate"
    frames_dir = ensure_frames(room_id, hotspot_id)
    seed = get_bbox_normalized(room_id, hotspot_id)
    exp_dir = TMP / "gepa/crate_experiments"
    exp_dir.mkdir(parents=True, exist_ok=True)

    results = []

    # E1: Still-mask keyframe seeding with prompt sweep
    print("=" * 60)
    print("E1: Still-mask seeding + prompt sweep")
    print("=" * 60)
    e1_dir = exp_dir / "e1_still_seed"
    e1_result = run_still_mask_seed(
        frames_dir, e1_dir, room_id, hotspot_id, seed, gpu_vm
    )

    # E5a: Multi-part union (proven approach)
    print("\n" + "=" * 60)
    print("E5a: Multi-part union (lid + body + battery)")
    print("=" * 60)
    e5a_dir = exp_dir / "e5a_multi_part"
    run_multi_part_union(
        frames_dir, e5a_dir,
        parts=[
            {"prompt": "green wooden treasure chest lid", "direction": "bidirectional"},
            {"prompt": "brown wooden box", "direction": "bidirectional"},
            {"prompt": "green battery", "direction": "bidirectional"},
        ],
        seed_bbox=seed,
        gpu_vm=gpu_vm,
    )

    # Recolor experiment: uniform red crate
    print("\n" + "=" * 60)
    print("Recolor: Uniform red crate")
    print("=" * 60)
    recolor_dir = exp_dir / "recolor_frames"
    recolor_frames(frames_dir, recolor_dir, room_id, hotspot_id, (196, 75, 47))
    recolor_masks_dir = exp_dir / "recolor_masks"
    run_sam_track(
        recolor_dir, recolor_masks_dir,
        prompt="red wooden box",
        seed_bbox=seed,
        gpu_vm=gpu_vm,
    )

    # Recolor experiment 2: uniform blue crate
    print("\n" + "=" * 60)
    print("Recolor: Uniform blue crate")
    print("=" * 60)
    recolor_dir2 = exp_dir / "recolor_blue_frames"
    recolor_frames(frames_dir, recolor_dir2, room_id, hotspot_id, (47, 100, 196))
    recolor_masks_dir2 = exp_dir / "recolor_blue_masks"
    run_sam_track(
        recolor_dir2, recolor_masks_dir2,
        prompt="blue wooden box",
        seed_bbox=seed,
        gpu_vm=gpu_vm,
    )

    print("\n" + "=" * 60)
    print("ALL CRATE EXPERIMENTS DONE")
    print("=" * 60)

    # Measure all results
    bb = {"x": 895, "y": 229, "w": 385, "h": 451}
    for name, mdir in [
        ("e1_best", e1_dir / "best"),
        ("e5a_union", e5a_dir / "union"),
        ("recolor_red", recolor_masks_dir),
        ("recolor_blue", recolor_masks_dir2),
    ]:
        if mdir.exists() and (mdir / "mask_0000.png").exists():
            fb, zeros = measure_frame_body(mdir, bb)
            print(f"{name}: FRAME-BODY={fb:.3f}, zeros={zeros}")
        else:
            print(f"{name}: no masks")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--gpu", choices=["l4", "a100", "none"], default="none")
    parser.add_argument("--crate-only", action="store_true")
    args = parser.parse_args()

    gpu = None
    if args.gpu == "l4":
        gpu = GPU_VM_L4
    elif args.gpu == "a100":
        gpu = GPU_VM_A100

    if args.crate_only:
        run_all_crate_experiments(gpu)
    else:
        print("Full GEPA sweep not implemented yet — use --crate-only")
