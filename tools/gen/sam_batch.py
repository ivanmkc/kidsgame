"""Batched SAM 3.1 segmentation — one GPU-VM round-trip per scene.

The pod repo's sam3_detect_object() pays a model load per prompt; a hidden
scene needs 6-8 prompts, so this client uploads the scene once, loads the
checkpoint once, and segments every prompt in the same session. Returns all
masks per prompt so callers can gate on instance count.

Requires CLOUDSDK_AUTH_ACCESS_TOKEN (ADC token) in the environment — the
box's compute SA lacks ssh scopes.
"""

from __future__ import annotations

import json
import tempfile
import threading
import uuid
from pathlib import Path

import subprocess

import numpy as np
from PIL import Image

VM, ZONE = "gpu-sam3-a100", "us-central1-a"


# Self-contained gcloud transport: importing the pod repo's tools package
# pulled in whatever heavy deps other sessions add there (today: a broken
# torchvision), so these thin wrappers live here instead.

def _run(argv: list[str], timeout: int) -> subprocess.CompletedProcess:
    r = subprocess.run(argv, capture_output=True, text=True, timeout=timeout)
    if r.returncode != 0:
        raise RuntimeError(f"{argv[0]} failed ({r.returncode}): {r.stderr[-300:]}")
    return r


def gcloud_ssh(vm: str, zone: str, cmd: str, timeout: int = 600) -> str:
    r = _run(["gcloud", "compute", "ssh", vm, "--zone", zone, "--command", cmd], timeout)
    return r.stdout + ("\n" + r.stderr if r.stderr else "")


def gcloud_scp_up(vm: str, zone: str, local: str, remote: str, timeout: int = 600) -> None:
    _run(["gcloud", "compute", "scp", "--zone", zone, local, f"{vm}:{remote}"], timeout)


def gcloud_scp_down(vm: str, zone: str, remote: str, local: str, timeout: int = 600) -> None:
    _run(["gcloud", "compute", "scp", "--zone", zone, f"{vm}:{remote}", local], timeout)
# The T4 fits ~2 concurrent SAM sessions; more just thrash.
_SEM = threading.Semaphore(2)

_REMOTE_TMPL = '''#!/usr/bin/env python3
import json, os, time
import numpy as np
import torch
from PIL import Image

RUN = "{run}"
PROMPTS = {prompts!r}
t0 = time.time()

from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection
from sam2.sam2_image_predictor import SAM2ImagePredictor

gdino_proc = AutoProcessor.from_pretrained("IDEA-Research/grounding-dino-base")
gdino_model = AutoModelForZeroShotObjectDetection.from_pretrained(
    "IDEA-Research/grounding-dino-base").to("cuda")
sam2 = SAM2ImagePredictor.from_pretrained("facebook/sam2-hiera-tiny")
print(f"models loaded {{time.time()-t0:.1f}}s", flush=True)

img = Image.open(os.path.expanduser(f"~/kgb/{{RUN}}/scene.jpg")).convert("RGB")
out_dir = os.path.expanduser(f"~/kgb/{{RUN}}/out")
os.makedirs(out_dir, exist_ok=True)
w, h = img.size

sam2.set_image(np.array(img))
meta = {{}}
for pi, prompt in enumerate(PROMPTS):
    inputs = gdino_proc(images=img, text=prompt + ".", return_tensors="pt").to("cuda")
    with torch.no_grad():
        outputs = gdino_model(**inputs)
    results = gdino_proc.post_process_grounded_object_detection(
        outputs, inputs.input_ids, threshold=0.15, text_threshold=0.15,
        target_sizes=[(h, w)])[0]
    boxes_xyxy = results["boxes"].cpu().numpy()
    det_scores = results["scores"].cpu().numpy()
    entries = []
    for bi in range(len(boxes_xyxy)):
        box = boxes_xyxy[bi]
        masks_out, mask_scores, _ = sam2.predict(box=box, multimask_output=True)
        best = int(mask_scores.argmax())
        m = masks_out[best]
        mask = (m > 0.5).astype(np.uint8) * 255
        if mask.sum() == 0:
            continue
        Image.fromarray(mask).save(f"{{out_dir}}/p{{pi:02d}}_m{{len(entries):02d}}.png")
        ys, xs = np.where(mask > 0)
        entries.append({{"score": round(float(det_scores[bi]), 4),
                         "area": int((mask > 0).sum()),
                         "bbox": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]}})
    meta[prompt] = entries
    print(f"  '{{prompt}}': {{len(entries)}} mask(s)", flush=True)
with open(f"{{out_dir}}/meta.json", "w") as f:
    json.dump(meta, f)
print("BATCH_DONE", flush=True)
'''


def sam_segment_batch(img: Image.Image, prompts: list[str], tag: str = "") -> dict[str, list[dict]]:
    """Segment every prompt on `img` in one VM session.

    Returns {prompt: [{score, area, bbox(x0,y0,x1,y1), mask(bool HxW)}...]},
    masks sorted by score descending per prompt. Raises on transport failure.
    """
    run = uuid.uuid4().hex[:10]
    with _SEM, tempfile.TemporaryDirectory() as td:
        # The box's compute SA lacks ssh scopes and ADC tokens expire ~1h;
        # refresh per batch so multi-hour generation runs never lose auth.
        import os
        import subprocess
        os.environ["CLOUDSDK_AUTH_ACCESS_TOKEN"] = subprocess.check_output(
            ["gcloud", "auth", "application-default", "print-access-token"],
            text=True).strip()
        local = Path(td)
        img.convert("RGB").save(local / "scene.jpg", quality=95)
        (local / "batch.py").write_text(_REMOTE_TMPL.format(run=run, prompts=prompts))

        gcloud_ssh(VM, ZONE, f"mkdir -p ~/kgb/{run}")
        gcloud_scp_up(VM, ZONE, str(local / "scene.jpg"), f"~/kgb/{run}/scene.jpg")
        gcloud_scp_up(VM, ZONE, str(local / "batch.py"), f"~/kgb/{run}/batch.py")
        # Pinned venv (torch 2.12.1/torchvision 0.27.1): immune to other
        # sessions' pip --user installs, which broke the shared env once.
        out = gcloud_ssh(VM, ZONE, f"~/sam3_venv/bin/python ~/kgb/{run}/batch.py", timeout=900)
        if "BATCH_DONE" not in out:
            raise RuntimeError(f"sam batch {tag} did not finish: ...{out[-400:]}")
        gcloud_ssh(VM, ZONE, f"cd ~/kgb/{run} && tar czf out.tgz out")
        gcloud_scp_down(VM, ZONE, f"~/kgb/{run}/out.tgz", str(local / "out.tgz"))
        gcloud_ssh(VM, ZONE, f"rm -rf ~/kgb/{run}")

        import tarfile
        with tarfile.open(local / "out.tgz") as tf:
            tf.extractall(local)
        meta = json.loads((local / "out" / "meta.json").read_text())

        result: dict[str, list[dict]] = {}
        for pi, prompt in enumerate(prompts):
            entries = meta.get(prompt, [])
            got = []
            for mi, e in enumerate(entries):
                mp = local / "out" / f"p{pi:02d}_m{mi:02d}.png"
                if not mp.exists():
                    continue
                mask = np.asarray(Image.open(mp).resize(img.size, Image.Resampling.NEAREST)) > 127
                got.append({**e, "mask": mask})
            got.sort(key=lambda d: -d["score"])
            result[prompt] = got
        return result
