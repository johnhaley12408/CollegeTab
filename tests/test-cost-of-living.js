const assert = require('assert');
const C = require('../cost-of-living-data-2026.js');
assert.strictEqual(Object.keys(C.INDEX).length,51,'50 states + DC');
for(const code of Object.keys(C.INDEX)){
  const p=C.monthlyPreset(code); assert.ok(p && p.monthlyTotal>0,code);
  for(const k of ['food','housing','transportation','healthcare','entertainment','charity','misc']) assert.ok(Number.isFinite(p.categories[k])&&p.categories[k]>=0,`${code} ${k}`);
}
assert.ok(C.monthlyPreset('CA').categories.housing>C.monthlyPreset('OK').categories.housing,'state housing index should change monthly housing preset');
assert.strictEqual(C.monthlyPreset('CA').categories.charity,C.monthlyPreset('OK').categories.charity,'charity should not be geographically cost-scaled');
const inflation=C.inflationPreset();
assert.strictEqual(inflation.source.provider,'U.S. Bureau of Labor Statistics');
assert.ok(inflation.source.url.includes('bls.gov'));
for(const k of ['food','housing','transportation','healthcare','entertainment','charity','misc']) assert.ok(Number.isFinite(inflation.rates[k])&&inflation.rates[k]>=0&&inflation.rates[k]<=20,k);
assert.ok(new Set(Object.values(inflation.rates)).size>=4,'sectional preset must contain meaningfully different rates');
console.log('PASS test-cost-of-living');
