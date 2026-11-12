#!/bin/bash
# tools/sim/run.sh TAG  -> tools/sim/out/TAG-<diff>-<years>.json, then prints the summary.
# Env: STYLES DIFFS YEARS N W IDX SEED0 PATCH (JS run in the page after setup) MATRIX=1 (adds _c/_n home policies)
# Needs playwright: NODE_PATH=/path/to/node_modules if not installed in the repo.
cd "$(dirname "$0")"; mkdir -p out
TAG=${1:?usage: run.sh TAG}
ST=${STYLES:-food,expert,phone,skilled,passive,ignores,opport}
if [ -n "$MATRIX" ]; then S=""; for s in ${ST//,/ }; do S="$S,$s,${s}_c,${s}_n"; done; ST=${S#,}; fi
FILES=""
for d in ${DIFFS:-normal hard}; do for y in ${YEARS:-5}; do
  OUT=out/$TAG-$d-$y.json STYLES=$ST DIFFS=$d YEARS=$y N=${N:-40} W=${W:-2} node run-all.js | head -1; FILES="$FILES out/$TAG-$d-$y.json"
done; done
node analyze.js $FILES
