const assert = require('assert');
const data = require('../state-tax-data-2026.js');
assert.strictEqual(data.SOURCE.taxYear, 2026);
assert.strictEqual(Object.keys(data.STATES).length, 51, '50 states + DC expected');
for (const [code, state] of Object.entries(data.STATES)) {
  assert.ok(/^[A-Z]{2}$/.test(code), `bad state code ${code}`);
  assert.ok(state.name, `${code} missing name`);
  for (const status of ['single', 'joint']) {
    assert.ok(Array.isArray(state[status]), `${code} ${status} brackets missing`);
    if (state.type !== 'none') assert.strictEqual(state[status][0]?.threshold, 0, `${code} ${status} first bracket must begin at 0`);
    for (let i = 0; i < state[status].length; i += 1) {
      const row = state[status][i];
      assert.ok(Number.isFinite(row.threshold) && row.threshold >= 0, `${code} ${status} bad threshold`);
      assert.ok(Number.isFinite(row.rate) && row.rate >= 0 && row.rate <= 1, `${code} ${status} bad rate`);
      if (i) assert.ok(row.threshold >= state[status][i - 1].threshold, `${code} ${status} brackets unsorted`);
    }
  }
}
console.log('PASS test-state-tax-data');
