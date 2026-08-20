#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node --check "$ROOT/app.js"
node --check "$ROOT/college-data.js"
node --check "$ROOT/college-cost-math.js"
node --check "$ROOT/state-tax-data-2026.js"
node --check "$ROOT/loan-engine.js"
node --check "$ROOT/financial-engine.js"
node --check "$ROOT/auth.js"
node --check "$ROOT/scripts/build-ipeds-directory.mjs"
node "$ROOT/tests/test-cost-math.js"
node "$ROOT/tests/test-college-data.js"
node "$ROOT/tests/test-state-tax-data.js"
node "$ROOT/tests/test-loan-engine.js"
python "$ROOT/tests/test-loan-crosscheck.py"
node "$ROOT/tests/test-financial-engine.js"
python "$ROOT/tests/test-engine-crosscheck.py"
node "$ROOT/tests/test-cost-of-living.js"
node "$ROOT/tests/test-savings-engine.js"
node "$ROOT/tests/test-emergency-waterfall.js"
python "$ROOT/tests/test-linear-budget-savings.py"
node "$ROOT/scripts/build-ipeds-directory.mjs" --input "$ROOT/tests/ipeds-mini.csv" --survey-year 2025 --out "$ROOT/tests/ipeds-mini.json" >/dev/null
node - <<NODE
const fs=require('fs'),assert=require('assert'); const p=JSON.parse(fs.readFileSync('$ROOT/tests/ipeds-mini.json','utf8')); const byId=Object.fromEntries(p.institutions.map(x=>[x.unitId,x])); assert.strictEqual(p.institutionCount,2); assert.strictEqual(byId['100001'].canonicalId,'ipeds:100001'); assert.strictEqual(byId['100001'].identity.ownership,'Public'); assert.strictEqual(byId['100002'].identity.ownership,'Private nonprofit'); console.log('PASS test-ipeds-builder');
NODE
python "$ROOT/tests/static-audit.py"
python "$ROOT/tests/test-scenario-ui.py"
echo 'ALL COLLEGETAB ENGINE + SCENARIO TESTS PASS'
