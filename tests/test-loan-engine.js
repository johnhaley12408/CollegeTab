const assert = require('assert');
const Loan = require('../loan-engine.js');

function near(actual, expected, tolerance = 0.02, label = '') {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

assert.strictEqual(Loan.LOAN_ENGINE_VERSION, '2026.08.19-loans-v4');
assert.strictEqual(Loan.FEDERAL_POLICY_2026.directUndergradApr, 0.0652);
assert.strictEqual(Loan.FEDERAL_POLICY_2026.parentPlusApr, 0.0907);
assert.deepStrictEqual(Loan.annualLimit('dependent', 1), { combined: 5500, subsidized: 3500 });
assert.deepStrictEqual(Loan.annualLimit('independent', 3), { combined: 12500, subsidized: 5500 });
assert.strictEqual(Loan.tieredStandardTermMonths(24999.99), 120);
assert.strictEqual(Loan.tieredStandardTermMonths(25000), 180);
assert.strictEqual(Loan.tieredStandardTermMonths(50000), 240);
assert.strictEqual(Loan.tieredStandardTermMonths(100000), 300);

assert.deepStrictEqual(Loan.annualLimit('dependent_plus_denied', 1), { combined: 9500, subsidized: 3500 });
const plusDeniedNeed = Loan.netFromGross(9500, Loan.FEDERAL_POLICY_2026.directFeeRate);
const plusDenied = Loan.validateLoanPlan({ annualFundingNeeds: [{ academicYearIndex: 1, calendarStartYear: 2026, netNeed: plusDeniedNeed }], dependencyStatus: 'dependent_plus_denied', priorFederalStudentPrincipal: 0, priorFederalSubsidizedPrincipal: 0, priorParentPlusPrincipal: 0, annualLoans: [{ academicYearIndex: 1, calendarStartYear: 2026, subsidizedGross: 3500, unsubsidizedGross: 6000, parentPlusGross: 0, privateGross: 0, directApr: 0.0652, parentPlusApr: 0.0907 }], privateTerms: {} });
assert.strictEqual(plusDenied.ready, true, 'PLUS-denied dependent should receive higher Direct limit when otherwise valid');

// Two-disbursement planning convention: a four-year year-1 unsubsidized tranche accrues from each disbursement to graduation.
near(Loan.interestToGraduation(2000, 0.0652, 1, 4), 450.97, 0.01, 'unsubsidized in-school interest');

// Direct fees reduce proceeds without reducing gross principal owed.
near(Loan.netFromGross(5500, Loan.FEDERAL_POLICY_2026.directFeeRate), 5441.87, 0.01, 'Direct net proceeds');
near(Loan.grossNeededForNet(5441.87, Loan.FEDERAL_POLICY_2026.directFeeRate), 5500.01, 0.02, 'gross-up for Direct fee');

const directNet = Loan.netFromGross(5500, Loan.FEDERAL_POLICY_2026.directFeeRate);
const need = directNet + 4500;
const plan = Loan.projectEducationLoans({
  annualFundingNeeds: [{ academicYearIndex: 1, calendarStartYear: 2026, netNeed: need }],
  attendanceYears: 1,
  dependencyStatus: 'dependent',
  priorFederalStudentPrincipal: 0,
  priorFederalSubsidizedPrincipal: 0,
  priorParentPlusPrincipal: 0,
  annualLoans: [{ academicYearIndex: 1, calendarStartYear: 2026, subsidizedGross: 3500, unsubsidizedGross: 2000, parentPlusGross: 0, privateGross: 4500, directApr: 0.0652, parentPlusApr: 0.0907, privateApr: 0.10, privateFeeRate: 0 }],
  privateTerms: { termMonths: 120, graceMonths: 6, inSchoolPaymentMode: 'deferred', capitalizeAtRepayment: true },
  extraMonthlyPayment: 0
});
assert.strictEqual(plan.ready, true, plan.errors?.join(','));
const sub = plan.tranches.find(x => x.type === 'direct_subsidized');
const unsub = plan.tranches.find(x => x.type === 'direct_unsubsidized');
const priv = plan.tranches.find(x => x.type === 'private');
assert.strictEqual(sub.accruedInterestAtGraduation, 0, 'subsidized loan must not accrue while in school');
near(unsub.accruedInterestAtGraduation, 59.77, 0.01, 'unsubsidized one-year accrual');
near(priv.accruedInterestAtGraduation, 206.25, 0.01, 'private deferred one-year accrual');
near(plan.student.federalDebtAtGraduation, 5559.77, 0.01, 'federal debt at graduation');
near(plan.student.privateDebtAtGraduation, 4706.25, 0.01, 'private debt at graduation');
near(plan.student.debtAtGraduation, 10266.02, 0.01, 'total student debt at graduation');
assert.strictEqual(plan.parent.debtAtGraduation, 0, 'no Parent PLUS in student debt stack');
assert.ok(plan.student.monthlyMinimum > 0);

// Private interest-only mode pays in-school interest instead of carrying it into graduation debt.
const interestOnly = Loan.projectEducationLoans({
  annualFundingNeeds: [{ academicYearIndex: 1, calendarStartYear: 2026, netNeed: need }], attendanceYears: 1, dependencyStatus: 'dependent',
  priorFederalStudentPrincipal: 0, priorFederalSubsidizedPrincipal: 0, priorParentPlusPrincipal: 0,
  annualLoans: [{ academicYearIndex: 1, calendarStartYear: 2026, subsidizedGross: 3500, unsubsidizedGross: 2000, parentPlusGross: 0, privateGross: 4500, directApr: 0.0652, parentPlusApr: 0.0907, privateApr: 0.10, privateFeeRate: 0 }],
  privateTerms: { termMonths: 120, graceMonths: 6, inSchoolPaymentMode: 'interest_only', capitalizeAtRepayment: true },
  extraMonthlyPayment: 0
});
near(interestOnly.student.privateDebtAtGraduation, 4500, 0.01, 'private interest-only graduation debt');
near(interestOnly.interest.privateInterestPaidInSchool, 206.25, 0.01, 'private interest paid while enrolled');

// Parent PLUS accrues during school/deferment and deferred interest capitalizes when repayment begins.
const plusGross = 10000;
const plusNeed = Loan.netFromGross(plusGross, Loan.FEDERAL_POLICY_2026.parentPlusFeeRate);
const plusPlan = Loan.projectEducationLoans({
  annualFundingNeeds: [{ academicYearIndex: 1, calendarStartYear: 2026, netNeed: plusNeed }], attendanceYears: 1, dependencyStatus: 'dependent',
  priorFederalStudentPrincipal: 0, priorFederalSubsidizedPrincipal: 0, priorParentPlusPrincipal: 0,
  annualLoans: [{ academicYearIndex: 1, calendarStartYear: 2026, subsidizedGross: 0, unsubsidizedGross: 0, parentPlusGross: plusGross, privateGross: 0, directApr: 0.0652, parentPlusApr: 0.0907 }],
  privateTerms: {}, extraMonthlyPayment: 0
});
assert.strictEqual(plusPlan.ready, true);
const plusTranche = plusPlan.tranches.find(x => x.type === 'parent_plus');
assert.ok(plusTranche.accruedInterestAtGraduation > 0, 'Parent PLUS must accrue while student is enrolled');
assert.strictEqual(plusTranche.capitalizeAtRepayment, true, 'deferred Parent PLUS interest must capitalize at repayment start');
assert.ok(plusPlan.parent.debtAtRepaymentStart > plusPlan.parent.debtAtGraduation, 'Parent PLUS must continue accruing during post-enrollment deferment');
assert.strictEqual(plusPlan.repaymentPolicy.parentPlusTermMonths, 120, 'sub-$25k Parent PLUS Tiered Standard term is 10 years');

// Existing subsidized principal must be tracked separately from total prior Direct principal.
const badPrior = Loan.validateLoanPlan({ annualFundingNeeds: [{ academicYearIndex: 1, calendarStartYear: 2026, netNeed: 0 }], dependencyStatus: 'dependent', priorFederalStudentPrincipal: 1000, priorFederalSubsidizedPrincipal: 2000, priorParentPlusPrincipal: 0, annualLoans: [{ academicYearIndex: 1, calendarStartYear: 2026, subsidizedGross: 0, unsubsidizedGross: 0, parentPlusGross: 0, privateGross: 0, directApr: 0.0652, parentPlusApr: 0.0907 }], privateTerms: {} });
assert.strictEqual(badPrior.ready, false);
assert.ok(badPrior.errors.includes('loan.priorFederalSubsidizedPrincipal'));

const existingPriorProjection = Loan.projectEducationLoans({
  annualFundingNeeds: [{ academicYearIndex: 1, calendarStartYear: 2026, netNeed: 0 }], attendanceYears: 1, dependencyStatus: 'dependent',
  priorFederalStudentPrincipal: 1000, priorFederalSubsidizedPrincipal: 0, priorParentPlusPrincipal: 0,
  annualLoans: [{ academicYearIndex: 1, calendarStartYear: 2026, subsidizedGross: 0, unsubsidizedGross: 0, parentPlusGross: 0, privateGross: 0, directApr: 0.0652, parentPlusApr: 0.0907 }],
  privateTerms: {}, extraMonthlyPayment: 0
});
assert.strictEqual(existingPriorProjection.ready, false);
assert.ok(existingPriorProjection.errors.includes('loan.existingLoanDetailsRequired'));

// Parent PLUS is not available in this model for independent undergraduates.
const badPlus = Loan.validateLoanPlan({ annualFundingNeeds: [{ academicYearIndex: 1, calendarStartYear: 2026, netNeed: Loan.netFromGross(1000, Loan.FEDERAL_POLICY_2026.parentPlusFeeRate) }], dependencyStatus: 'independent', priorFederalStudentPrincipal: 0, priorFederalSubsidizedPrincipal: 0, priorParentPlusPrincipal: 0, annualLoans: [{ academicYearIndex: 1, calendarStartYear: 2026, subsidizedGross: 0, unsubsidizedGross: 0, parentPlusGross: 1000, privateGross: 0, directApr: 0.0652, parentPlusApr: 0.0907 }], privateTerms: {} });
assert.strictEqual(badPlus.ready, false);
assert.ok(badPlus.errors.includes('loan.year1.parentPlusIndependent'));

// Future federal rates and post-current-window loan fees are unknown; current rate is only a proxy and must surface a warning.
const futureNeed = Loan.netFromGross(1000, Loan.FEDERAL_POLICY_2026.directFeeRate);
const future = Loan.validateLoanPlan({ annualFundingNeeds: [{ academicYearIndex: 1, calendarStartYear: 2027, netNeed: futureNeed }], dependencyStatus: 'dependent', priorFederalStudentPrincipal: 0, priorFederalSubsidizedPrincipal: 0, priorParentPlusPrincipal: 0, annualLoans: [{ academicYearIndex: 1, calendarStartYear: 2027, subsidizedGross: 0, unsubsidizedGross: 1000, parentPlusGross: 0, privateGross: 0, directApr: 0.0652, parentPlusApr: 0.0907 }], privateTerms: {} });
assert.strictEqual(future.ready, true);
assert.ok(future.warnings.some(x => /Future federal rates and post-current-window loan fees are unknown/.test(x)));


// Private loans are originated as separate academic-year tranches; APR and fee may differ by year.
const privateByYear = Loan.projectEducationLoans({
  annualFundingNeeds: [
    { academicYearIndex: 1, calendarStartYear: 2026, netNeed: Loan.netFromGross(5000, 0.01) },
    { academicYearIndex: 2, calendarStartYear: 2027, netNeed: Loan.netFromGross(5000, 0.02) }
  ],
  attendanceYears: 2,
  dependencyStatus: 'dependent',
  priorFederalStudentPrincipal: 0,
  priorFederalSubsidizedPrincipal: 0,
  priorParentPlusPrincipal: 0,
  annualLoans: [
    { academicYearIndex: 1, calendarStartYear: 2026, subsidizedGross: 0, unsubsidizedGross: 0, parentPlusGross: 0, privateGross: 5000, directApr: 0.0652, parentPlusApr: 0.0907, directFeeRate: 0.01057, parentPlusFeeRate: 0.04228, privateApr: 0.08, privateFeeRate: 0.01 },
    { academicYearIndex: 2, calendarStartYear: 2027, subsidizedGross: 0, unsubsidizedGross: 0, parentPlusGross: 0, privateGross: 5000, directApr: 0.0652, parentPlusApr: 0.0907, directFeeRate: 0.01057, parentPlusFeeRate: 0.04228, privateApr: 0.12, privateFeeRate: 0.02 }
  ],
  privateTerms: { termMonths: 120, graceMonths: 6, inSchoolPaymentMode: 'deferred', capitalizeAtRepayment: true },
  extraMonthlyPayment: 0
});
assert.strictEqual(privateByYear.ready, true, privateByYear.errors?.join(','));
const privateTranches = privateByYear.tranches.filter(x => x.type === 'private');
assert.strictEqual(privateTranches.length, 2);
assert.strictEqual(privateTranches[0].apr, 0.08);
assert.strictEqual(privateTranches[1].apr, 0.12);
assert.ok(privateTranches[0].accruedInterestAtGraduation !== privateTranches[1].accruedInterestAtGraduation, 'private tranches with different APR/timing should accrue different interest');
assert.strictEqual(privateByYear.annual[0].privateFeeRate, 0.01);
assert.strictEqual(privateByYear.annual[1].privateFeeRate, 0.02);

// A private principal is incomplete until both the APR and fee (including an explicit zero fee) are supplied for that year.
const missingPrivateTerms = Loan.validateLoanPlan({
  annualFundingNeeds: [{ academicYearIndex: 1, calendarStartYear: 2026, netNeed: 5000 }],
  dependencyStatus: 'dependent', priorFederalStudentPrincipal: 0, priorFederalSubsidizedPrincipal: 0, priorParentPlusPrincipal: 0,
  annualLoans: [{ academicYearIndex: 1, calendarStartYear: 2026, subsidizedGross: 0, unsubsidizedGross: 0, parentPlusGross: 0, privateGross: 5000, directApr: 0.0652, parentPlusApr: 0.0907, directFeeRate: 0.01057, parentPlusFeeRate: 0.04228, privateApr: null, privateFeeRate: null }],
  privateTerms: { termMonths: 120, graceMonths: 6, inSchoolPaymentMode: 'deferred', capitalizeAtRepayment: true }
});
assert.strictEqual(missingPrivateTerms.ready, false);
assert.ok(missingPrivateTerms.errors.includes('loan.year1.privateApr'));
assert.ok(missingPrivateTerms.errors.includes('loan.year1.privateFeeRate'));

console.log('PASS test-loan-engine');
