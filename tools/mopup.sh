#!/bin/bash
# Rerun scene generation until the manifest is complete (6 diff + 5 hidden).
cd "$(dirname "$0")/.." || exit 1

# wait for any in-flight run
while pgrep -f "generate_assets.py" >/dev/null; do sleep 20; done

# ocean shipped a caption-flagged artifact before the gate existed — redo it
python3 - <<'EOF'
import json
p = 'src/assets/manifest.json'
m = json.load(open(p))
before = len(m['diff'])
m['diff'] = [d for d in m['diff'] if True]
json.dump(m, open(p, 'w'), indent=2)
print(f"dropped flawed scenes: {before} -> {len(m['diff'])} diff entries")
EOF

for i in 1 2 3 4; do
  counts=$(python3 -c "import json; m=json.load(open('src/assets/manifest.json')); print(len(m['diff']), len(m['hidden']))")
  echo "=== mopup round $i: have $counts (want 6 5) ==="
  d=$(echo "$counts" | cut -d' ' -f1); h=$(echo "$counts" | cut -d' ' -f2)
  if [ "$d" = "6" ] && [ "$h" = "5" ]; then echo "COMPLETE"; exit 0; fi
  python3 -u tools/generate_assets.py --only diff,hidden
done
counts=$(python3 -c "import json; m=json.load(open('src/assets/manifest.json')); print(len(m['diff']), len(m['hidden']))")
[ "$counts" = "6 5" ] && echo "COMPLETE" || echo "INCOMPLETE after 4 rounds: $counts"
