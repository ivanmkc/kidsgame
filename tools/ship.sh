#!/bin/bash
# Ship ONLY audit-verified scenes. The working manifest keeps everything
# (generation state); the deploy is built from a clean-filtered copy and
# the working state is restored afterwards. Broken content cannot ship.
set -euo pipefail

# A running generator mutates the manifest mid-build (merge-on-save) —
# shipping during generation raced once and let failing tests through.
python3 tools/verify_story_audio.py || { echo "REFUSING TO SHIP: story audio coverage/duration failed."; exit 1; }

if pgrep -f "generate_assets.py" > /dev/null; then
  echo "REFUSING TO SHIP: generation loop is running (manifest would race)."
  exit 2
fi
cd "$(dirname "$0")/.."

cp src/assets/manifest.json /tmp/kgb_manifest_full.json
# any gate failure must still restore the working manifest
trap 'cp /tmp/kgb_manifest_full.json src/assets/manifest.json' EXIT
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
# Stories: hotspot nav is mandatory for post-retrofit books. Books still
# missing 'hot' on any decision choice are held back from the deploy (same
# philosophy as the ledger filter) instead of blocking the whole ship.
LEGACY_TILE_OK = {'luna', 'pip', 'whisper', 'scareschool'}
def fully_wired(st):
    return all('hot' in c for n in st['nodes'].values() for c in n.get('choices', []))
held = [s['id'] for s in m.get('stories', []) if s['id'] not in LEGACY_TILE_OK and not fully_wired(s)]
m['stories'] = [s for s in m.get('stories', []) if s['id'] in LEGACY_TILE_OK or fully_wired(s)]
if held:
    print(f"ship manifest: holding back {len(held)} un-wired stories: {' '.join(sorted(held))}")
json.dump(m, open('src/assets/manifest.json', 'w'), indent=2)
print(f"ship manifest: {before} -> {len(m['diff'])} diff + {len(m['hidden'])} hidden (ledger-verified only), {len(m['stories'])} stories")
PYEOF

# Story content rules (hotspot nav on every decision node, no bracket text
# in narration) verified on the SHIP manifest — hard gate.
python3 tools/gen/story_lint.py --manifest || { echo "REFUSING TO SHIP: story manifest verify failed."; exit 1; }

python3 tools/check_pool_pixels.py   # invisible-difference gate (hard fail)
python3 tools/tighten_hitboxes.py > /dev/null
python3 tools/rate_levels.py
python3 tools/gen_thumbs.py
node tools/gen_images_ts.mjs
# Every bundled asset must be committed — 758 files once shipped from disk
# only, so a clean clone couldn't build (hard gate).
python3 - <<'PYEOF'
import re, subprocess, sys
tracked = set(subprocess.run(['git','ls-files'], capture_output=True, text=True).stdout.splitlines())
refs = {m.group(1) for m in re.finditer(r"require\('\.\./\.\./(assets/game/[^']+)'\)", open('src/assets/images.ts').read())}
import json
for r in json.load(open('src/assets/manifest.json')).get('escape', []):
    refs.update('public/' + h['animVideo'] for h in r['hotspots'] if h.get('animVideo'))
bad = sorted(refs - tracked)
if bad:
    print(f"REFUSING TO SHIP: {len(bad)} referenced assets not committed:", *bad[:20], sep='\n  ')
    sys.exit(1)
PYEOF
npx tsc --noEmit
npx vitest run src/games/__tests__/logic.test.ts 2>&1 | grep -E "Test Files|Tests "
BUILD_ID=$(git rev-parse --short HEAD)-$(python3 -c "import time; print(int(time.time()))")
printf "// GENERATED at ship time\nexport const KGB_BUILD = '%s';\n" "$BUILD_ID" > src/assets/build.ts
npx expo export --platform web 2>&1 | tail -1
printf '{"build": "%s"}\n' "$BUILD_ID" > dist/version.json
# PWA: inject manifest + iOS meta into the exported page (Metro owns index.html)
PWA_TAGS='<link rel="manifest" href="manifest.json"/><link rel="apple-touch-icon" href="icons/apple-touch-icon.png"/><meta name="theme-color" content="#FFC24B"/><meta name="apple-mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-title" content="Kids Games"/><meta name="mobile-web-app-capable" content="yes"/>'
python3 - "$PWA_TAGS" <<'PYEOF'
import sys
from pathlib import Path
tags = sys.argv[1]
p = Path('dist/index.html')
html = p.read_text()
assert '</head>' in html and 'rel="manifest"' not in html
p.write_text(html.replace('</head>', tags + '</head>'))
print('PWA tags injected')
PYEOF
npx gh-pages -d dist --nojekyll -m "deploy: ledger-verified content only" 2>&1 | tail -1

# restore full working manifest for generation to keep extending
cp /tmp/kgb_manifest_full.json src/assets/manifest.json
node tools/gen_images_ts.mjs > /dev/null
echo "SHIPPED (working manifest restored)"
