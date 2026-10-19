import sys
from PIL import Image
import os

path = sys.argv[1]
target = int(sys.argv[2])
max_attempts = int(sys.argv[3])
min_q = int(sys.argv[4])

size = os.path.getsize(path)
if size <= target:
    sys.exit(0)

ext = os.path.splitext(path)[1].lower()
img = Image.open(path)
img.load()

temp_out = path + ".tmp"

if ext in ['.jpg', '.jpeg']:
    quality = 85
    for _ in range(max_attempts):
        img.save(temp_out, 'JPEG', quality=quality, optimize=True)
        if os.path.getsize(temp_out) <= target:
            os.replace(temp_out, path)
            sys.exit(0)
        if quality <= min_q:
            break
        quality = max(min_q, quality - 10)
elif ext == '.png':
    img.save(temp_out, 'PNG', optimize=True, compress_level=9)
    if os.path.getsize(temp_out) <= target:
        os.replace(temp_out, path)
        sys.exit(0)
    quality = 90
    for _ in range(max_attempts):
        q_img = img.quantize(colors=max(16, int(256 * (quality / 100))))
        q_img.save(temp_out, 'PNG', optimize=True)
        if os.path.getsize(temp_out) <= target:
            os.replace(temp_out, path)
            sys.exit(0)
        if quality <= min_q:
            break
        quality = max(min_q, quality - 15)

if os.path.exists(temp_out):
    os.remove(temp_out)

print(f"Failed to compress image to target size {target} bytes", file=sys.stderr)
sys.exit(1)
