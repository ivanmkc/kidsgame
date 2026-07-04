#!/bin/bash
# Loop generation until the manifest holds every theme (dynamic targets).
cd "$(dirname "$0")/.." || exit 1
while pgrep -f "generate_assets.py" >/dev/null; do sleep 20; done
want=$(python3 -c "import sys; sys.path.insert(0,'tools'); from gen.scenes import DIFF_THEMES, HIDDEN_THEMES; print(len(DIFF_THEMES), len(HIDDEN_THEMES))")
wd=$(echo "$want" | cut -d' ' -f1); wh=$(echo "$want" | cut -d' ' -f2)
for i in $(seq 1 8); do
  counts=$(python3 -c "import json; m=json.load(open('src/assets/manifest.json')); print(len(m['diff']), len(m['hidden']))")
  d=$(echo "$counts" | cut -d' ' -f1); h=$(echo "$counts" | cut -d' ' -f2)
  echo "=== round $i: have $d/$wd diff, $h/$wh hidden ==="
  if [ "$d" = "$wd" ] && [ "$h" = "$wh" ]; then echo "COMPLETE"; exit 0; fi
  python3 -u tools/generate_assets.py --only diff,hidden
done
echo "rounds exhausted"
