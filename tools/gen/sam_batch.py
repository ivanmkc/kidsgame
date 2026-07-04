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
import sys
import tempfile
import threading
import uuid
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, "/home/ivanmkc/persistence-of-dreams")
from tools._gpu_ssh import gcloud_scp_down, gcloud_scp_up, gcloud_ssh  # noqa: E402

VM, ZONE = "gpu-sam3-a100", "us-central1-f"
# The T4 fits ~2 concurrent SAM sessions; more just thrash.
_SEM = threading.Semaphore(2)

_REMOTE_TMPL = '''#!/usr/bin/env python3
import json, os, sys, time
import numpy as np
import torch
from PIL import Image

sys.path.insert(0, os.path.expanduser("~/sam3_repo"))
torch.autocast("cuda", dtype=torch.float16).__enter__()

from sam3 import build_sam3_image_model
from sam3.model.sam3_image_processor import Sam3Processor

RUN = "{run}"
PROMPTS = {prompts!r}
t0 = time.time()
model = build_sam3_image_model(checkpoint_path=os.path.expanduser("~/sam3.1_checkpoint.pt"), load_from_HF=False)
processor = Sam3Processor(model, confidence_threshold=0.1)
print(f"model loaded {{time.time()-t0:.1f}}s", flush=True)

img = Image.open(os.path.expanduser(f"~/kgb/{{RUN}}/scene.jpg"))
out_dir = os.path.expanduser(f"~/kgb/{{RUN}}/out")
os.makedirs(out_dir, exist_ok=True)
state = processor.set_image(img)
meta = {{}}
for pi, prompt in enumerate(PROMPTS):
    processor.reset_all_prompts(state)
    state = processor.set_text_prompt(state=state, prompt=prompt)
    masks, scores = state.get("masks", []), state.get("scores", [])
    n = len(masks) if isinstance(masks, list) else (masks.shape[0] if hasattr(masks, "shape") else 0)
    entries = []
    for mi in range(n):
        score = float(scores[mi].cpu().item()) if isinstance(scores, torch.Tensor) else float(scores[mi])
        m = masks[mi].cpu().numpy() if isinstance(masks, torch.Tensor) else np.array(masks[mi])
        if m.ndim > 2:
            m = m.squeeze()
        mask = (m > 0.5).astype(np.uint8) * 255
        if mask.sum() == 0:
            continue
        Image.fromarray(mask).save(f"{{out_dir}}/p{{pi:02d}}_m{{len(entries):02d}}.png")
        ys, xs = np.where(mask > 0)
        entries.append({{"score": round(score, 4), "area": int((mask > 0).sum()),
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
        out = gcloud_ssh(VM, ZONE, f"cd ~/sam3_repo && python3 ~/kgb/{run}/batch.py", timeout=900)
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
