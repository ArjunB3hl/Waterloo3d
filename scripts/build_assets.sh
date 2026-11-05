#!/usr/bin/env bash
# Reproduce every published asset from scratch (data -> scene -> reference renders -> web data).
#   scripts/build_assets.sh                  # stage 1 + stage 2 regions (default sample)
#   REGIONS="campus2x2" scripts/build_assets.sh
#   FETCH=0 scripts/build_assets.sh          # skip downloads when data_cache/ is already populated
#   FORCE=1 scripts/build_assets.sh          # re-prepare and re-render existing tiles
set -euo pipefail
cd "$(dirname "$0")/.."
REGIONS=${REGIONS:-"campus2x2 park_uptown stage2_surround"}
FORCE_FLAG=""; [ "${FORCE:-0}" = "1" ] && FORCE_FLAG="--force"
step() { printf '\n== %s\n' "$*"; }

if [ "${FETCH:-1}" = "1" ]; then
  step "fetch Overture + terrain";        python3 pipeline/fetch_overture.py; python3 pipeline/fetch_terrain.py
fi
step "build scene";                        python3 pipeline/build_scene.py > /dev/null
step "plan city coverage + regions";       python3 pipeline/plan_coverage.py
for r in $REGIONS; do
  step "prepare render jobs: $r";          python3 pipeline/prepare_tiles.py --region "$r" $FORCE_FLAG
done
step "render reference tiles (headless three.js)"; node render/render_refs.mjs $FORCE_FLAG
step "publish tiles, heights, masks, overview";    python3 pipeline/publish_tiles.py
step "landmarks, building labels, search, collision, feathers";
python3 pipeline/build_landmarks.py > /dev/null
python3 pipeline/build_labels.py          # needs landmarks.json (ids) and manifest.json (published tiles)
python3 pipeline/build_search.py
python3 pipeline/build_collision.py
python3 pipeline/build_feathers.py
step "validate alignment";                 python3 pipeline/validate_alignment.py | head -8
echo; echo "done. Start the viewer with: npm run dev"
