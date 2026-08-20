const assert = require('assert');
const C = require('../cost-of-living-data-2026.js');
assert.strictEqual(Object.keys(C.INDEX).length,51,'50 states + DC');
for(const code of Object.keys(C.INDEX)){
  const p=C.monthlyPreset(code); assert.ok(p && p.monthlyTotal>0,code);
  for(const k of ['food','housing','transportation','healthcare','entertainment','charity','misc']) assert.ok(Number.isFinite(p.categories[k])&&p.categories[k]>=0,`${code} ${k}`);
}
assert.ok(C.monthlyPreset('CA').categories.housing>C.monthlyPreset('OK').categories.housing,'state housing index should change monthly housing preset');
assert.strictEqual(C.monthlyPreset('CA').categories.charity,C.monthlyPreset('OK').categories.charity,'charity should not be geographically cost-scaled');
console.log('PASS test-cost-of-living');
