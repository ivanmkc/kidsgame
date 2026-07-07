"""End-to-end test for the deployed kgb-magic service.

  python3 tools/magic/test_magic.py [service_url]

Default service_url is the deployed Cloud Run URL. Hits POST /wear with a
real public scene from the ivanmkc/kidsgame repo (via raw.githubusercontent
— verified public), saves the returned image to tools/magic/out_test.png,
and prints the meta so a human can eyeball the result.
"""
from __future__ import annotations

import base64
import json
import os
import pathlib
import sys
import time

import requests

# Public scene asset in this repo (verified 200 via curl).
SCENE_URL = "https://raw.githubusercontent.com/ivanmkc/kidsgame/master/assets/game/diff/princess_base.png"

# Drop point over the pony's head on the right side of the princess scene.
# princess_base.png is 1280x720; pony head is approx (1170, 480).
POINT = {"x": 1170 / 1280, "y": 480 / 720}
ITEM = "big round red glasses"

OUT_PNG = pathlib.Path(__file__).parent / "out_test.png"
DEFAULT_URL = "https://kgb-magic-692247227248.us-central1.run.app"


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("KGB_MAGIC_URL", DEFAULT_URL)
    base = base.rstrip("/")
    payload = {"image_url": SCENE_URL, "item": ITEM, **POINT}
    print(f"POST {base}/wear")
    print(f"  payload: {json.dumps(payload)}")
    t0 = time.time()
    r = requests.post(f"{base}/wear", json=payload, timeout=180)
    dt = time.time() - t0
    print(f"  status: {r.status_code}  wall: {dt:.1f}s")
    try:
        body = r.json()
    except Exception:  # noqa: BLE001
        print(f"  non-json body: {r.text[:400]}")
        return 2

    meta = body.get("meta") or {}
    print(f"  meta: {json.dumps(meta, indent=2)}")

    if not body.get("ok"):
        print(f"  REJECTED: {body.get('reason')}")
        return 1

    b64 = body["image_b64"]
    OUT_PNG.write_bytes(base64.b64decode(b64))
    print(f"  wrote {OUT_PNG} ({OUT_PNG.stat().st_size // 1024} KiB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
