const assert = require('assert');
const Engine = require('../financial-engine.js');
const StateData = require('../state-tax-data-2026.js');
const Loan = require('../loan-engine.js');

function near(actual, expected, tolerance = 0.02, label = '') {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label} expected ${expected}, got ${actual}`);
}

assert.strictEqual(Engine.ENGINE_VERSION, '2026.08.20-v5');
assert.strictEqual(Object.keys(StateData.STATES).length, 51, '50 states + DC expected');
assert.strictEqual(Engine.progressiveTax(10000, [[null, 0.10]]), 0, 'null bracket thresholds must remain missing rather than coercing to zero');

// Progressive federal income tax: single, $74,000 wages, no pre-tax retirement.
// 2026 standard deduction $16,100 => $57,900 taxable.
// 10% of 12,400 + 12% of 38,000 + 22% of 7,500 = $7,450.
const fed = Engine.federalIncomeTax({ grossWages: 74000, filingStatus: 'single', taxYear: 2026 });
near(fed.standardDeduction, 16100, 0.01, 'federal standard deduction');
near(fed.taxableIncome, 57900, 0.01, 'federal taxable income');
near(fed.tax, 7450, 0.01, 'federal tax');

// Pre-tax 401(k) reduces federal taxable wages.
const fedWith401k = Engine.federalIncomeTax({ grossWages: 74000, pretaxRetirement: 4440, filingStatus: 'single', taxYear: 2026 });
assert.ok(fedWith401k.tax < fed.tax);

// FICA: under wage base, 6.2% Social Security + 1.45% Medicare.
const fica = Engine.ficaTax({ grossWages: 74000, filingStatus: 'single', taxYear: 2026 });
near(fica.socialSecurity, 4588, 0.01, 'social security');
near(fica.medicare, 1073, 0.01, 'medicare');
near(fica.tax, 5661, 0.01, 'fica total');

// Social Security wage base and Additional Medicare threshold are applied.
const highFica = Engine.ficaTax({ grossWages: 250000, filingStatus: 'single', taxYear: 2026 });
near(highFica.socialSecurity, 11439, 0.01, 'social security cap');
near(highFica.additionalMedicare, 450, 0.01, 'additional medicare');
const futureHighFica = Engine.ficaTax({ grossWages: 250000, filingStatus: 'single', taxYear: 2036, policyIndexRate: 0.03 });
near(futureHighFica.additionalMedicareThreshold, 200000, 0.01, 'Additional Medicare threshold is not inflation indexed');
near(futureHighFica.additionalMedicare, 450, 0.01, 'future Additional Medicare statutory threshold');

// No-wage-tax state and flat-tax state sanity checks.
const tx = Engine.stateIncomeTax({ grossWages: 100000, state: 'TX', filingStatus: 'single', taxYear: 2026 });
near(tx.tax, 0, 0.01, 'Texas wage income tax');
const pa = Engine.stateIncomeTax({ grossWages: 100000, state: 'PA', filingStatus: 'single', taxYear: 2026 });
near(pa.tax, 3070, 0.01, 'Pennsylvania baseline');
const pa401k = Engine.stateIncomeTax({ grossWages: 100000, pretaxRetirement: 10000, state: 'PA', filingStatus: 'single', taxYear: 2026 });
near(pa401k.stateAgi, 100000, 0.01, 'Pennsylvania taxes employee retirement deferrals as compensation');
near(pa401k.tax, 3070, 0.01, 'Pennsylvania retirement deferral treatment');

// Optional local tax is explicit, never silently assumed.
const paLocal = Engine.stateIncomeTax({ grossWages: 100000, state: 'PA', filingStatus: 'single', taxYear: 2026, localIncomeTaxRate: 0.01 });
near(paLocal.localTax, 1000, 0.01, 'local tax override');
near(paLocal.tax, 4070, 0.01, 'state + local');

// 2026 retirement limit is enforced.
const retirement = Engine.retirementContribution({ grossWages: 500000, employeeRate: 0.2, employerContributionRate: 0.04, taxYear: 2026 });
near(retirement.employee, 24500, 0.01, '401k cap');
near(retirement.employer, 14400, 0.01, 'employer contribution uses compensation cap');
near(retirement.annualAdditionLimit, 72000, 0.01, 'defined-contribution annual additions cap');
near(retirement.compensationLimit, 360000, 0.01, 'qualified-plan compensation cap');
assert.strictEqual(retirement.contributionCapped, true, 'high employee deferral request should surface cap');
const retirementCapped = Engine.retirementContribution({ grossWages: 500000, employeeRate: 0.2, employerContributionRate: 1, taxYear: 2026 });
near(retirementCapped.total, 72000, 0.01, 'combined employee + employer annual addition cap');
near(retirementCapped.employer, 47500, 0.01, 'employer amount after annual addition cap');

// Loan payment standard amortization.
const pmt = Engine.monthlyPayment(10000, 0.06, 120);
near(pmt, 111.02, 0.02, '10-year amortized payment');
const schedule = Engine.repaymentSchedule({ principal: 10000, apr: 0.06, termMonths: 120 });
assert.ok(schedule.payoffMonths >= 119 && schedule.payoffMonths <= 120);
assert.ok(schedule.totalInterest > 3000 && schedule.totalInterest < 3500);
near(schedule.rows[schedule.rows.length - 1].balance, 0, 0.01, 'loan payoff');

// In-school simple interest is computed per annual borrowing tranche.
const financing = Engine.projectCollegeFinancing({
  annualCost: 30000,
  annualGrowthRate: 0,
  baseYear: 2026,
  startYear: 2026,
  attendanceYears: 4,
  grantsAnnual: 10000,
  familyAnnual: 5000,
  loanApr: 0.06,
  interestAccruesInSchool: true,
  graceMonths: 6
});
near(financing.totalCost, 120000, 0.01, 'college total');
near(financing.totalBorrowedPrincipal, 60000, 0.01, 'principal borrowed');
// Mid-year disbursement assumption: 15k * 6% * (3.5+2.5+1.5+0.5) = 7,200.
near(financing.inSchoolInterest, 7200, 0.01, 'in-school interest');
near(financing.graduationDebt, 67200, 0.01, 'debt at graduation');
// Grace interest is modeled on unpaid principal, not on already-accrued in-school interest.
near(financing.graceInterest, 1800, 0.01, 'grace interest on principal only');
near(financing.repaymentStartDebt, 69000, 0.01, 'repayment-start debt');

// Dedicated growth / living-cost / reserve / net-worth functions.
near(Engine.projectSalary({ startSalary: 70000, annualGrowthRate: 0.03, years: 5 }), 81149.19, 0.02, 'salary growth');
near(Engine.inflateExpense({ annualExpense: 18000, inflationRate: 0.025, years: 5 }), 20365.35, 0.02, 'housing inflation');
near(Engine.emergencyFundTarget({ annualCoreExpenses: 36000, months: 3 }), 9000, 0.01, 'emergency target');
near(Engine.calculateNetWorth({ retirement: 50000, taxableInvestments: 20000, emergencySavings: 9000, cashDeficit: 1000, loanBalance: 15000 }), 63000, 0.01, 'net worth');

// Investment growth function.
near(Engine.futureValueLumpSum(10000, 0.07, 10), 19671.51, 0.02, 'future value');

const collegeForScenario = { annualCost: 30000, annualGrowthRate: 0.03, baseYear: 2026, startYear: 2027, attendanceYears: 4, grantsAnnual: 10000, familyAnnual: 5000 };
const costForScenario = Engine.projectCollegeFinancing({ ...collegeForScenario, loanApr: 0, interestAccruesInSchool: false, graceMonths: 0 });
const needsForScenario = costForScenario.rows.map(row => ({ academicYearIndex: row.academicYearIndex, calendarStartYear: row.calendarStartYear, netNeed: row.borrowedPrincipal }));
const suggestedRows = Loan.suggestLoanPlan({ annualFundingNeeds: needsForScenario, dependencyStatus: 'dependent' });
const annualLoans = suggestedRows.map(row => {
  const lim = Loan.annualLimit('dependent', row.academicYearIndex);
  const sub = Math.min(lim.subsidized, row.unsubsidizedGross);
  return { ...row, subsidizedGross: sub, unsubsidizedGross: row.unsubsidizedGross - sub, privateApr: row.privateGross > 0 ? 0.10 : null, privateFeeRate: row.privateGross > 0 ? 0 : null };
});
const baseScenario = {
  college: collegeForScenario,
  financing: {
    dependencyStatus: 'dependent', priorFederalStudentPrincipal: 0, priorFederalSubsidizedPrincipal: 0, priorParentPlusPrincipal: 0,
    extraMonthlyPayment: 0, annualLoans,
    privateTerms: { termMonths: 120, graceMonths: 6, inSchoolPaymentMode: 'deferred', capitalizeAtRepayment: true }
  },
  career: { startSalary: 70000, salaryGrowthRate: 0.03, workState: 'TX', filingStatus: 'single', localIncomeTaxRate: 0 },
  expenses: { monthly: { housing: 1500, food: 500, transportation: 400, healthcare: 250, entertainment: 150, charity: 50, misc: 150 } },
  economy: { inflationRate: 0.025 },
  wealth: { employerContributionRate: 0.03, investmentReturnRate: 0.07, emergencyMonths: 3, cashHysaRate: 0.035, k401Available: true, hsaCoverage: 'none', allocations: { k401: 50, hsa: 0, roth: 25, brokerage: 25, cash: 0 }, startingEmergencySavings: 0, startingCash: 0, starting401k: 0, startingHsa: 0, startingRoth: 0, startingBrokerage: 0, confirmed: true },
  ages: { graduationAge: 22, targetAge: 40 },
  taxPolicy: { indexRate: 0.025 }
};
const result = Engine.projectScenario(baseScenario);
assert.strictEqual(result.ready, true, `scenario missing: ${result.missing}`);
assert.ok(result.college.totalCost > 120000);
assert.ok(result.loan.student.federalDebtAtGraduation > result.loan.student.federalPrincipalBorrowed, 'unsubsidized federal interest must accrue in school');
assert.ok(result.loan.student.privateDebtAtGraduation > result.loan.student.privatePrincipalBorrowed, 'deferred private interest must accrue in school');
assert.strictEqual(result.loan.parent.debtAtGraduation, 0);
const subTranches = result.loan.tranches.filter(x => x.type === 'direct_subsidized');
const unsubTranches = result.loan.tranches.filter(x => x.type === 'direct_unsubsidized');
assert.ok(subTranches.length > 0 && subTranches.every(x => x.accruedInterestAtGraduation === 0), 'subsidized tranches must not accrue in-school interest');
assert.ok(unsubTranches.some(x => x.accruedInterestAtGraduation > 0), 'unsubsidized tranches must accrue from disbursement');
assert.ok(result.firstYear.monthlyTakeHome > 0);
assert.ok(result.firstYear.monthlyBudget > 0, 'monthly budget should be exposed');
assert.ok(result.firstYear.emergencyTarget > 0, 'emergency target should be based on essential monthly obligations');
assert.ok(result.timeline[0].emergencyBalance <= result.timeline[0].emergencyTarget + 0.01, 'emergency HYSA may not exceed target');
const firstInvestmentYear = result.timeline.find(row => (row.savingsAllocation.k401 + row.savingsAllocation.hsa + row.savingsAllocation.roth + row.savingsAllocation.brokerage + row.savingsAllocation.cash) > 0.01);
if (firstInvestmentYear) assert.ok(firstInvestmentYear.emergencyBalance >= firstInvestmentYear.emergencyTarget - 0.01, 'user-directed investing begins only after emergency target is full');
assert.ok(result.targetNetWorth > 0);
assert.ok(result.debtFreeAge > 22);
assert.strictEqual(result.timeline.length, 18);
assert.ok(/^CT-2026\.08\.20-v5-[A-F0-9]{8}$/.test(result.fingerprint));
assert.strictEqual(result.fingerprint, Engine.projectScenario(JSON.parse(JSON.stringify(baseScenario))).fingerprint, 'same inputs must reproduce same fingerprint');

const changedInput = JSON.parse(JSON.stringify(baseScenario));
changedInput.career.startSalary += 1;
assert.notStrictEqual(result.fingerprint, Engine.projectScenario(changedInput).fingerprint);

// Changing student loan mix must not change the modeled future value of family contributions.
const lessSubsidized = JSON.parse(JSON.stringify(baseScenario));
lessSubsidized.financing.annualLoans = lessSubsidized.financing.annualLoans.map(row => ({ ...row, unsubsidizedGross: row.unsubsidizedGross + row.subsidizedGross, subsidizedGross: 0 }));
const lessSubResult = Engine.projectScenario(lessSubsidized);
assert.strictEqual(lessSubResult.ready, true);
near(lessSubResult.familyContributionOpportunityCostAtTarget, result.familyContributionOpportunityCostAtTarget, 0.01, 'family opportunity cost independent of loan mix');
assert.ok(lessSubResult.college.graduationDebt > result.college.graduationDebt, 'losing subsidy should increase graduation debt');

// Invalid prior subsidized balance cannot exceed total prior federal principal.
const badPrior = JSON.parse(JSON.stringify(baseScenario));
badPrior.financing.priorFederalStudentPrincipal = 1000;
badPrior.financing.priorFederalSubsidizedPrincipal = 2000;
const badPriorResult = Engine.projectScenario(badPrior);
assert.strictEqual(badPriorResult.ready, false);
assert.ok(badPriorResult.missing.includes('loan.priorFederalSubsidizedPrincipal'));

const invalidScenario = JSON.parse(JSON.stringify(baseScenario));
invalidScenario.economy.inflationRate = 0.90;
const invalidResult = Engine.projectScenario(invalidScenario);
assert.strictEqual(invalidResult.ready, false);
assert.ok(invalidResult.missing.includes('economy.inflationRate'));

const cheaper = JSON.parse(JSON.stringify(baseScenario));
cheaper.college.annualCost = 20000;
const cheaperCost = Engine.projectCollegeFinancing({ ...cheaper.college, loanApr: 0, interestAccruesInSchool: false, graceMonths: 0 });
const cheaperNeeds = cheaperCost.rows.map(row => ({ academicYearIndex: row.academicYearIndex, calendarStartYear: row.calendarStartYear, netNeed: row.borrowedPrincipal }));
cheaper.financing.annualLoans = Loan.suggestLoanPlan({ annualFundingNeeds: cheaperNeeds, dependencyStatus: 'dependent' }).map(row => ({ ...row, privateApr: row.privateGross > 0 ? 0.10 : null, privateFeeRate: row.privateGross > 0 ? 0 : null }));
cheaper.career.startSalary = 65000;
const result2 = Engine.projectScenario(cheaper);
assert.strictEqual(result2.ready, true, `cheaper scenario missing: ${result2.missing}`);
const comparison = Engine.compareScenarios(result, result2);
assert.ok(comparison);
assert.strictEqual(comparison.leftFingerprint, result.fingerprint);
assert.strictEqual(comparison.rightFingerprint, result2.fingerprint);
assert.ok(Number.isFinite(comparison.targetNetWorthGap));
near(comparison.targetNetWorthGap, Math.abs(comparison.netWorthDelta), 0.01, 'scenario net-worth gap');
assert.strictEqual(Object.prototype.hasOwnProperty.call(comparison, 'opportunityCostOfChoice'), false, 'net-worth gap must not be mislabeled opportunity cost');
const differentTarget = JSON.parse(JSON.stringify(baseScenario));
differentTarget.ages.targetAge = 45;
assert.strictEqual(Engine.compareScenarios(result, Engine.projectScenario(differentTarget)), null, 'different target ages are not directly comparable');

console.log('PASS test-financial-engine');
