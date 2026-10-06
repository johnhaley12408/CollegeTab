const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Engine = require('../financial-engine.js');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const start = appSource.indexOf('function annualFundingNeedsForModel');
const end = appSource.indexOf('\nfunction effectiveLoanRows', start);
assert.ok(start >= 0 && end > start, 'annualFundingNeedsForModel must remain directly testable');

const buildNeeds = new Function(
  'window',
  `${appSource.slice(start, end)}; return annualFundingNeedsForModel;`
)({ CollegeTabFinancialEngine: Engine });

const needs = buildNeeds({
  annualCost: 30000,
  growthRate: 0.03,
  projectionBaseYear: 2026,
  projectionStartYear: 2027,
  validYears: 4,
  grantsAnnual: 10000,
  familyAnnual: 5000
});

assert.strictEqual(needs.length, 4, 'four attendance years must produce four annual loan-plan rows');
assert.deepStrictEqual(needs.map(row => row.academicYearIndex), [1, 2, 3, 4]);
assert.deepStrictEqual(needs.map(row => row.calendarStartYear), [2027, 2028, 2029, 2030]);
assert.ok(needs.every(row => Number.isFinite(row.netNeed) && row.netNeed > 0));
assert.deepStrictEqual(buildNeeds({}), [], 'incomplete college inputs must not fabricate funding rows');

console.log('PASS test-app-funding-needs');
