const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const code = fs.readFileSync(require.resolve('../college-data.js'), 'utf8');
const window = {};
const context = { window, URLSearchParams, URL, AbortController, fetch: async () => { throw new Error('network disabled in deterministic test'); }, setTimeout, clearTimeout, console };
vm.createContext(context);
vm.runInContext(code, context);
const d = window.CollegeTabData;
assert.ok(d);
const row = {
  id: 123456, ope8_id: '00123400', ope6_id: '001234',
  'school.name': 'Example University', 'school.city': 'Example', 'school.state': 'NY', 'school.ownership': 1,
  'school.school_url': 'example.edu', 'school.price_calculator_url': 'example.edu/npc', 'school.degrees_awarded.predominant': 3,
  '2025.cost.tuition.in_state': 20000, '2025.cost.tuition.out_of_state': 35000,
  '2025.cost.booksupply': 1200, '2025.cost.roomboard.oncampus': 15000, '2025.cost.roomboard.offcampus': 16000,
  '2025.cost.otherexpense.oncampus': 3000, '2025.cost.otherexpense.offcampus': 4000, '2025.cost.otherexpense.withfamily': 2500,
  '2025.cost.attendance.academic_year': 39200, '2025.cost.avg_net_price.public': 18000, '2025.cost.avg_net_price.private': null
};
const rec = d.normalizeScorecardRow(row);
assert.strictEqual(rec.canonicalId, 'ipeds:123456');
assert.strictEqual(rec.costs.tuitionFeesInState.value, 20000);
assert.strictEqual(rec.costs.tuitionFeesInState.source.academicYear, '2025-26');
assert.strictEqual(rec.costs.averageNetPricePrivate.value, null);
const fallback = d.normalizeScorecardRow({ ...row, '2025.cost.booksupply': null, 'latest.cost.booksupply': 987 });
assert.strictEqual(fallback.costs.booksSupplies.value, 987);
assert.strictEqual(fallback.costs.booksSupplies.source.academicYear, 'latest available');
const merged = d.mergeVerifiedSchoolPublished(rec, {
  unitId: '123456', academicYear: '2026-27', sourceUrl: 'https://example.edu/coa',
  costs: { tuitionInState: 21000, mandatoryFeesInState: 1000, transportationOnCampus: 800, personalOnCampus: 1500 }
});
assert.strictEqual(merged.publishedCosts.values.tuitionInState.value, 21000);
assert.strictEqual(merged.publishedCosts.values.mandatoryFeesInState.source.provider, 'School-published cost of attendance');
assert.strictEqual(merged.costs.tuitionFeesInState.value, 20000);
console.log('PASS test-college-data');
