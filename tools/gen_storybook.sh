#!/bin/bash
# One-command storybook pipeline: spec -> scenes+hotspots -> Veo clips ->
# voice -> audit renders. Idempotent at every stage (each resumes by file).
#
#   bash tools/gen_storybook.sh <story_id ...>
#
# Prereqs: spec in tools/gen/story_specs.py (see the storybook-pipeline
# skill for authoring rules), registered in STORIES in gen_stories.py and
# in HEROES/SPECS in gen_story_videos.py.
set -euo pipefail
cd "$(dirname "$0")/.."
IDS=("$@")
[ ${#IDS[@]} -gt 0 ] || { echo "usage: $0 <story_id ...>"; exit 2; }

echo "== 1/6 spec lint"
python3 tools/gen/story_lint.py

echo "== 2/6 scenes + hotspots + scares (NBP + SAM)"
python3 tools/gen_stories.py "${IDS[@]}"

echo "== 3/6 Veo action clips"
python3 tools/gen_story_videos.py "${IDS[@]}"

echo "== 4/6 speech lines + voice clips (incl. lang-tagged)"
KGB_DUMP=1 npx vitest run src/games/__tests__/speechdump.test.ts --silent >/dev/null
python3 tools/gen_voice.py

echo "== 5/6 bundle images"
node tools/gen_images_ts.mjs

echo "== 6/6 audit renders (feed these to the audit fleet before shipping)"
python3 tools/story_audit_render.py "${IDS[@]}"

echo
echo "NEXT: run the adversarial audit fleet on tools/audit_out/story/<id>/"
echo "      (hotspot placement, continuity, single-hero, consequences),"
echo "      fix findings, then tools/ship.sh."
