(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CollegeTabCostMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function finite(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function cagr(firstValue, lastValue, years) {
    if (!finite(firstValue) || !finite(lastValue) || firstValue <= 0 || lastValue <= 0) return null;
    if (!Number.isInteger(years) || years <= 0) return null;
    const rate = Math.pow(lastValue / firstValue, 1 / years) - 1;
    return Number.isFinite(rate) && rate > -1 ? rate : null;
  }

  function sumComplete(values) {
    if (!Array.isArray(values) || !values.length) return null;
    if (values.some(value => !finite(value) || value < 0)) return null;
    return values.reduce((sum, value) => sum + value, 0);
  }

  function projectTotal({ annualCost, annualGrowthRate, baseYear, startYear, attendanceYears }) {
    if (!finite(annualCost) || annualCost < 0) return null;
    if (!finite(annualGrowthRate) || annualGrowthRate <= -1) return null;
    if (!Number.isInteger(baseYear) || !Number.isInteger(startYear)) return null;
    if (!Number.isInteger(attendanceYears) || attendanceYears < 1 || attendanceYears > 8) return null;

    const firstYearCost = annualCost * Math.pow(1 + annualGrowthRate, startYear - baseYear);
    if (!finite(firstYearCost) || firstYearCost < 0) return null;
    let total = 0;
    for (let year = 0; year < attendanceYears; year += 1) {
      total += firstYearCost * Math.pow(1 + annualGrowthRate, year);
    }
    return finite(total) && total >= 0 ? total : null;
  }

  function fundingTotal({ grantsAnnual, familyAnnual, attendanceYears }) {
    if (!finite(grantsAnnual) || grantsAnnual < 0 || !finite(familyAnnual) || familyAnnual < 0) return null;
    if (!Number.isInteger(attendanceYears) || attendanceYears < 1 || attendanceYears > 8) return null;
    return (grantsAnnual + familyAnnual) * attendanceYears;
  }

  function borrowingRequirement(projectedCost, funding) {
    if (!finite(projectedCost) || projectedCost < 0 || !finite(funding) || funding < 0) return null;
    return Math.max(0, projectedCost - funding);
  }

  return Object.freeze({ cagr, sumComplete, projectTotal, fundingTotal, borrowingRequirement });
});
