#!/bin/bash
# Ship ONLY audit-verified scenes. The working manifest keeps everything
# (generation state); the deploy is built from a clean-filtered copy and
# the working state is restored afterwards. Broken content cannot ship.
set -euo pipefail

# A running generator mutates the manifest mid-build (merge-on-save) —
# shipping during generation raced once and let failing tests through.
if pgrep -f "generate_assets.py" > /dev/null; then
  echo "REFUSING TO SHIP: generation loop is running (manifest would race)."
  exit 2
fi
cd "$(dirname "$0")/.."

cp src/assets/manifest.json /tmp/kgb_manifest_full.json
python3 - <<'PYEOF'
import json
ledger = set(json.load(open('tools/quality_ledger.json'))['clean'])
m = json.load(open('src/assets/manifest.json'))
before = (len(m['diff']), len(m['hidden']))
import os
def has_files(e):
    return all(os.path.exists('assets/game/' + e[k]) for k in ('imageA', 'imageB', 'image') if k in e)
m['diff'] = [d for d in m['diff'] if d['id'] in ledger and has_files(d)]
m['hidden'] = [h for h in m['hidden'] if h['id'] in ledger and has_files(h)]
for coll in ('diff', 'hidden'):
    for e in m[coll]:
        e.pop('flagged', None)  # nothing unverified ships, so no badges
json.dump(m, open('src/assets/manifest.json', 'w'), indent=2)
print(f"ship manifest: {before} -> {len(m['diff'])} diff + {len(m['hidden'])} hidden (ledger-verified only)")
PYEOF

python3 tools/tighten_hitboxes.py > /dev/null
python3 tools/rate_levels.py
python3 tools/gen_thumbs.py
node tools/gen_images_ts.mjs
npx tsc --noEmit
npx vitest run src/games/__tests__/logic.test.ts 2>&1 | grep -E "Test Files|Tests "
npx expo export --platform web 2>&1 | tail -1
npx gh-pages -d dist --nojekyll -m "deploy: ledger-verified content only" 2>&1 | tail -1

# restore full working manifest for generation to keep extending
cp /tmp/kgb_manifest_full.json src/assets/manifest.json
node tools/gen_images_ts.mjs > /dev/null
echo "SHIPPED (working manifest restored)"
