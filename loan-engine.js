(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CollegeTabLoanEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LOAN_ENGINE_VERSION = '2026.08.19-loans-v4';
  const DAYS_PER_YEAR = 365.25;
  const CURRENT_AWARD_YEAR = '2026-27';

  const FEDERAL_POLICY_2026 = Object.freeze({
    awardYear: CURRENT_AWARD_YEAR,
    directUndergradApr: 0.0652,
    parentPlusApr: 0.0907,
    directFeeRate: 0.01057,
    parentPlusFeeRate: 0.04228,
    directGraceMonths: 6,
    parentPlusDeferredMonthsAfterEnrollment: 6,
    aggregateSubsidizedLimit: 23000,
    aggregateDirectLimit: Object.freeze({ dependent: 31000, independent: 57500 }),
    parentPlusAnnualLimit: 20000,
    parentPlusAggregateLimit: 65000,
    annualLimits: Object.freeze({
      dependent: Object.freeze([
        Object.freeze({ combined: 5500, subsidized: 3500 }),
        Object.freeze({ combined: 6500, subsidized: 4500 }),
        Object.freeze({ combined: 7500, subsidized: 5500 })
      ]),
      independent: Object.freeze([
        Object.freeze({ combined: 9500, subsidized: 3500 }),
        Object.freeze({ combined: 10500, subsidized: 4500 }),
        Object.freeze({ combined: 12500, subsidized: 5500 })
      ])
    }),
    sources: Object.freeze({
      rates: 'Federal Student Aid — 2026-27 Direct Loan interest rates',
      limits: 'Federal Student Aid — undergraduate annual and aggregate loan limits',
      fees: 'Federal Student Aid — Direct Loan fees effective through 2026-27',
      interest: 'Federal Student Aid — subsidized vs. unsubsidized interest rules'
    })
  });

  function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
  function cents(value) { return finite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : null; }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function validRate(value, max = 1) { return finite(value) && value >= 0 && value <= max; }
  function money(value) { return finite(value) && value >= 0 ? cents(value) : null; }

  function isDependencyStatus(value) { return ['dependent','independent','dependent_plus_denied'].includes(value); }
  function limitGroup(dependencyStatus) { return dependencyStatus === 'dependent' ? 'dependent' : (isDependencyStatus(dependencyStatus) ? 'independent' : null); }

  function annualLimit(dependencyStatus, academicYearIndex) {
    const group = limitGroup(dependencyStatus);
    if (!group || !Number.isInteger(academicYearIndex) || academicYearIndex < 1) return null;
    const rows = FEDERAL_POLICY_2026.annualLimits[group];
    return rows[Math.min(academicYearIndex - 1, 2)];
  }

  function rateStatus(calendarStartYear) {
    if (!Number.isInteger(calendarStartYear)) return 'unknown';
    return calendarStartYear === 2026 ? 'statutory-2026-27' : '2026-27-current-rate-proxy';
  }

  function tieredStandardTermMonths(outstandingPrincipal) {
    if (!finite(outstandingPrincipal) || outstandingPrincipal < 0) return null;
    if (outstandingPrincipal < 25000) return 120;
    if (outstandingPrincipal < 50000) return 180;
    if (outstandingPrincipal < 100000) return 240;
    return 300;
  }

  function grossNeededForNet(netNeed, feeRate) {
    if (!finite(netNeed) || netNeed < 0 || !validRate(feeRate, 0.25) || feeRate >= 1) return null;
    return cents(netNeed / (1 - feeRate));
  }

  function netFromGross(gross, feeRate) {
    if (!finite(gross) || gross < 0 || !validRate(feeRate, 0.25)) return null;
    return cents(gross * (1 - feeRate));
  }

  function normalizeAnnualLoanRow(row, fallbackYearIndex, fallbackCalendarYear) {
    const value = row && typeof row === 'object' ? row : {};
    const num = (v, fallback = 0) => finite(Number(v)) && Number(v) >= 0 ? cents(Number(v)) : fallback;
    const rate = (v, fallback) => finite(Number(v)) && Number(v) >= 0 && Number(v) <= 1 ? Number(v) : fallback;
    const nullableRate = (v, max = 1) => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return finite(n) && n >= 0 && n <= max ? n : null;
    };
    return {
      academicYearIndex: Number.isInteger(value.academicYearIndex) ? value.academicYearIndex : fallbackYearIndex,
      calendarStartYear: Number.isInteger(value.calendarStartYear) ? value.calendarStartYear : fallbackCalendarYear,
      subsidizedGross: num(value.subsidizedGross),
      unsubsidizedGross: num(value.unsubsidizedGross),
      parentPlusGross: num(value.parentPlusGross),
      privateGross: num(value.privateGross),
      directApr: rate(value.directApr, FEDERAL_POLICY_2026.directUndergradApr),
      parentPlusApr: rate(value.parentPlusApr, FEDERAL_POLICY_2026.parentPlusApr),
      directFeeRate: rate(value.directFeeRate, FEDERAL_POLICY_2026.directFeeRate),
      parentPlusFeeRate: rate(value.parentPlusFeeRate, FEDERAL_POLICY_2026.parentPlusFeeRate),
      privateApr: nullableRate(value.privateApr, 1),
      privateFeeRate: nullableRate(value.privateFeeRate, .25)
    };
  }

  function suggestLoanPlan({ annualFundingNeeds, dependencyStatus, priorFederalStudentPrincipal = 0, priorFederalSubsidizedPrincipal = 0 }) {
    if (!Array.isArray(annualFundingNeeds) || !isDependencyStatus(dependencyStatus) || !finite(priorFederalStudentPrincipal) || priorFederalStudentPrincipal < 0 || !finite(priorFederalSubsidizedPrincipal) || priorFederalSubsidizedPrincipal < 0 || priorFederalSubsidizedPrincipal > priorFederalStudentPrincipal) return null;
    let remainingAggregate = Math.max(0, FEDERAL_POLICY_2026.aggregateDirectLimit[limitGroup(dependencyStatus)] - priorFederalStudentPrincipal);
    return annualFundingNeeds.map((need, index) => {
      const yearIndex = Number.isInteger(need?.academicYearIndex) ? need.academicYearIndex : index + 1;
      const calendarStartYear = Number.isInteger(need?.calendarStartYear) ? need.calendarStartYear : 2026 + index;
      const netNeed = finite(need?.netNeed) && need.netNeed > 0 ? need.netNeed : 0;
      const limit = annualLimit(dependencyStatus, yearIndex);
      const directFeeRate = FEDERAL_POLICY_2026.directFeeRate;
      const grossToCoverNeed = grossNeededForNet(netNeed, directFeeRate) || 0;
      const unsubsidizedGross = cents(Math.min(limit.combined, remainingAggregate, grossToCoverNeed));
      remainingAggregate = Math.max(0, remainingAggregate - unsubsidizedGross);
      const federalNet = netFromGross(unsubsidizedGross, directFeeRate);
      const privateNetNeed = Math.max(0, netNeed - federalNet);
      // Provisional private gross assumes no fee until the user enters the actual lender fee for this tranche.
      // Validation will not treat a private tranche as complete until both APR and fee are explicit.
      const privateGross = cents(privateNetNeed);
      return Object.freeze({
        academicYearIndex: yearIndex,
        calendarStartYear,
        subsidizedGross: 0,
        unsubsidizedGross,
        parentPlusGross: 0,
        privateGross,
        directApr: FEDERAL_POLICY_2026.directUndergradApr,
        parentPlusApr: FEDERAL_POLICY_2026.parentPlusApr,
        directFeeRate: FEDERAL_POLICY_2026.directFeeRate,
        parentPlusFeeRate: FEDERAL_POLICY_2026.parentPlusFeeRate,
        privateApr: null,
        privateFeeRate: null,
        rateStatus: rateStatus(calendarStartYear),
        method: 'conservative-federal-first: no subsidized eligibility assumed; federal Direct capacity is treated as unsubsidized until the user enters an aid offer'
      });
    });
  }

  function disbursementMonthsForAcademicYear(academicYearIndex) {
    const start = (academicYearIndex - 1) * 12;
    return [start, start + 5];
  }

  function graduationMonth(attendanceYears) {
    // Planning convention: fall start through spring graduation; a four-year path is about 44 months.
    return attendanceYears * 12 - 4;
  }

  function interestToGraduation(grossPrincipal, apr, academicYearIndex, attendanceYears) {
    if (!finite(grossPrincipal) || grossPrincipal < 0 || !validRate(apr) || !Number.isInteger(academicYearIndex) || !Number.isInteger(attendanceYears)) return null;
    if (grossPrincipal === 0) return 0;
    const gradMonth = graduationMonth(attendanceYears);
    const halves = disbursementMonthsForAcademicYear(academicYearIndex);
    return cents(halves.reduce((sum, month) => {
      const monthsOutstanding = Math.max(0, gradMonth - month);
      return sum + (grossPrincipal / 2) * apr * (monthsOutstanding / 12);
    }, 0));
  }

  function validateLoanPlan({ annualFundingNeeds, dependencyStatus, priorFederalStudentPrincipal = 0, priorFederalSubsidizedPrincipal = 0, priorParentPlusPrincipal = 0, annualLoans, privateTerms }) {
    const errors = [];
    const warnings = [];
    if (!Array.isArray(annualFundingNeeds) || !annualFundingNeeds.length) errors.push('loan.annualFundingNeeds');
    if (!isDependencyStatus(dependencyStatus)) errors.push('loan.dependencyStatus');
    if (!finite(priorFederalStudentPrincipal) || priorFederalStudentPrincipal < 0) errors.push('loan.priorFederalStudentPrincipal');
    if (!finite(priorFederalSubsidizedPrincipal) || priorFederalSubsidizedPrincipal < 0 || priorFederalSubsidizedPrincipal > priorFederalStudentPrincipal) errors.push('loan.priorFederalSubsidizedPrincipal');
    if (!finite(priorParentPlusPrincipal) || priorParentPlusPrincipal < 0) errors.push('loan.priorParentPlusPrincipal');
    if (!Array.isArray(annualLoans) || annualLoans.length !== annualFundingNeeds?.length) errors.push('loan.annualLoans');
    const normalizedRows = Array.isArray(annualLoans)
      ? annualLoans.map((row, index) => normalizeAnnualLoanRow(row, index + 1, annualFundingNeeds?.[index]?.calendarStartYear ?? 2026 + index))
      : [];
    const anyPrivate = normalizedRows.some(row => row.privateGross > 0.005);
    if (anyPrivate && !Number.isInteger(privateTerms?.termMonths)) errors.push('loan.privateTermMonths');
    if (anyPrivate && (!Number.isInteger(privateTerms?.graceMonths) || privateTerms.graceMonths < 0 || privateTerms.graceMonths > 60)) errors.push('loan.privateGraceMonths');
    if (anyPrivate && !['deferred','interest_only'].includes(privateTerms?.inSchoolPaymentMode)) errors.push('loan.privateInSchoolPaymentMode');
    if (anyPrivate && typeof privateTerms?.capitalizeAtRepayment !== 'boolean') errors.push('loan.privateCapitalization');

    if (errors.length) return Object.freeze({ ready: false, errors: Object.freeze([...new Set(errors)]), warnings: Object.freeze(warnings), rows: Object.freeze(normalizedRows) });

    let newDirectTotal = 0;
    let newSubTotal = 0;
    let newPlusTotal = 0;
    normalizedRows.forEach((row, index) => {
      const need = annualFundingNeeds[index];
      const limit = annualLimit(dependencyStatus, row.academicYearIndex);
      const combined = row.subsidizedGross + row.unsubsidizedGross;
      newDirectTotal += combined;
      newSubTotal += row.subsidizedGross;
      newPlusTotal += row.parentPlusGross;
      if (combined > limit.combined + 0.01) errors.push(`loan.year${row.academicYearIndex}.directAnnualLimit`);
      if (row.subsidizedGross > limit.subsidized + 0.01) errors.push(`loan.year${row.academicYearIndex}.subsidizedAnnualLimit`);
      if (dependencyStatus !== 'dependent' && row.parentPlusGross > 0.01) errors.push(`loan.year${row.academicYearIndex}.parentPlusIndependent`);
      if (row.parentPlusGross > FEDERAL_POLICY_2026.parentPlusAnnualLimit + 0.01) errors.push(`loan.year${row.academicYearIndex}.parentPlusAnnualLimit`);
      if (!validRate(row.directApr, 1)) errors.push(`loan.year${row.academicYearIndex}.directApr`);
      if (!validRate(row.parentPlusApr, 1)) errors.push(`loan.year${row.academicYearIndex}.parentPlusApr`);
      if (!validRate(row.directFeeRate, .25)) errors.push(`loan.year${row.academicYearIndex}.directFeeRate`);
      if (!validRate(row.parentPlusFeeRate, .25)) errors.push(`loan.year${row.academicYearIndex}.parentPlusFeeRate`);
      if (row.privateGross > 0.005 && !validRate(row.privateApr, 1)) errors.push(`loan.year${row.academicYearIndex}.privateApr`);
      if (row.privateGross > 0.005 && !validRate(row.privateFeeRate, .25)) errors.push(`loan.year${row.academicYearIndex}.privateFeeRate`);

      const federalNet = netFromGross(combined, row.directFeeRate);
      const plusNet = netFromGross(row.parentPlusGross, row.parentPlusFeeRate);
      const privateNet = row.privateGross > 0.005 && validRate(row.privateFeeRate, .25) ? netFromGross(row.privateGross, row.privateFeeRate) : 0;
      const needValue = finite(need?.netNeed) ? Math.max(0, need.netNeed) : 0;
      const netProceeds = federalNet + plusNet + privateNet;
      const delta = needValue - netProceeds;
      if (delta > 1) errors.push(`loan.year${row.academicYearIndex}.unfunded`);
      if (delta < -1) errors.push(`loan.year${row.academicYearIndex}.overfunded`);
    });
    const remainingDirect = Math.max(0, FEDERAL_POLICY_2026.aggregateDirectLimit[limitGroup(dependencyStatus)] - priorFederalStudentPrincipal);
    const remainingSub = Math.max(0, FEDERAL_POLICY_2026.aggregateSubsidizedLimit - priorFederalSubsidizedPrincipal);
    const remainingPlus = Math.max(0, FEDERAL_POLICY_2026.parentPlusAggregateLimit - priorParentPlusPrincipal);
    if (newDirectTotal > remainingDirect + 0.01) errors.push('loan.directAggregateLimit');
    if (newSubTotal > remainingSub + 0.01) errors.push('loan.subsidizedAggregateLimit');
    if (newPlusTotal > remainingPlus + 0.01) errors.push('loan.parentPlusAggregateLimit');
    if (normalizedRows.some(row => row.calendarStartYear !== 2026 && (row.subsidizedGross + row.unsubsidizedGross + row.parentPlusGross) > 0.01)) {
      warnings.push('Future federal rates and post-current-window loan fees are unknown; current 2026-27 values are planning proxies unless the user overrides the annual assumptions.');
    }
    if (normalizedRows.some(row => row.subsidizedGross > 0.01)) warnings.push('Subsidized eligibility is need-based and must come from an aid offer or explicit user assumption.');
    if (normalizedRows.some(row => row.parentPlusGross > 0.01)) warnings.push('Parent PLUS is parent debt and is excluded from the student net-worth balance sheet. Deferred Parent PLUS interest is modeled to capitalize when repayment begins.');
    if (anyPrivate && privateTerms?.inSchoolPaymentMode === 'interest_only') warnings.push('Private interest-only payments are modeled as pre-graduation cash outflow, but the payer source is not assigned to student versus family assets in the post-graduation net-worth model.');
    if (priorFederalStudentPrincipal > 0.01 || priorParentPlusPrincipal > 0.01) warnings.push('Prior federal balances are used for aggregate-limit checks only. Exact repayment projection requires detailed existing-loan tranches; CollegeTab does not invent a blended historical APR.');
    return Object.freeze({ ready: errors.length === 0, errors: Object.freeze([...new Set(errors)]), warnings: Object.freeze([...new Set(warnings)]), rows: Object.freeze(normalizedRows) });
  }

  function stateAtRepaymentStart(tranche) {
    const principal = tranche.principal;
    let accruedInterest = tranche.accruedInterestAtGraduation || 0;
    if (tranche.accruesDuringGrace && tranche.graceMonths > 0) accruedInterest += principal * tranche.apr * (tranche.graceMonths / 12);
    let repaymentPrincipal = principal;
    if (tranche.capitalizeAtRepayment && accruedInterest > 0) {
      repaymentPrincipal += accruedInterest;
      accruedInterest = 0;
    }
    return { principal: repaymentPrincipal, accruedInterest, graceMonths: tranche.graceMonths };
  }

  function simulateSingleRepayment({ principal, accruedInterest, apr, payment, months }) {
    let p = principal;
    let interest = accruedInterest;
    for (let month = 0; month < months && p + interest > 0.005; month += 1) {
      interest += p * apr / 12;
      let remaining = payment;
      const payInterest = Math.min(remaining, interest);
      interest -= payInterest;
      remaining -= payInterest;
      const payPrincipal = Math.min(remaining, p);
      p -= payPrincipal;
    }
    return p + interest;
  }

  function solveFixedPayment(tranche, termMonths) {
    const start = stateAtRepaymentStart(tranche);
    if (start.principal + start.accruedInterest <= 0.005) return 0;
    let low = 0;
    let high = Math.max(1, (start.principal + start.accruedInterest) / termMonths * 3 + start.principal * tranche.apr / 12 * 2);
    while (simulateSingleRepayment({ principal: start.principal, accruedInterest: start.accruedInterest, apr: tranche.apr, payment: high, months: termMonths }) > 0.01 && high < 1e7) high *= 2;
    for (let i = 0; i < 90; i += 1) {
      const mid = (low + high) / 2;
      if (simulateSingleRepayment({ principal: start.principal, accruedInterest: start.accruedInterest, apr: tranche.apr, payment: mid, months: termMonths }) > 0.01) low = mid;
      else high = mid;
    }
    return cents(high);
  }

  function portfolioSchedule(tranches, { extraMonthlyPayment = 0, maxMonths = 720 } = {}) {
    if (!Array.isArray(tranches) || !finite(extraMonthlyPayment) || extraMonthlyPayment < 0) return null;
    const states = tranches.map((tranche, index) => {
      const start = stateAtRepaymentStart(tranche);
      return {
        ...tranche,
        id: tranche.id || `loan-${index + 1}`,
        principal: tranche.principal,
        accruedInterest: tranche.accruedInterestAtGraduation || 0,
        capitalized: false,
        basePayment: solveFixedPayment(tranche, tranche.termMonths)
      };
    });
    const rows = [];
    let totalPaid = 0;
    let totalRepaymentInterest = 0;
    let totalExtraPaid = 0;
    let payoffMonth = 0;
    for (let month = 1; month <= maxMonths; month += 1) {
      let monthlyPaid = 0;
      let monthlyInterest = 0;
      for (const state of states) {
        if (state.principal + state.accruedInterest <= 0.005) continue;
        if (month <= state.graceMonths) {
          if (state.accruesDuringGrace) {
            const i = state.principal * state.apr / 12;
            state.accruedInterest += i;
            monthlyInterest += i;
          }
          continue;
        }
        if (!state.capitalized) {
          if (state.capitalizeAtRepayment && state.accruedInterest > 0) {
            state.principal += state.accruedInterest;
            state.accruedInterest = 0;
          }
          state.capitalized = true;
        }
        const i = state.principal * state.apr / 12;
        state.accruedInterest += i;
        monthlyInterest += i;
        let remaining = state.basePayment;
        const payInterest = Math.min(remaining, state.accruedInterest);
        state.accruedInterest -= payInterest;
        remaining -= payInterest;
        const payPrincipal = Math.min(remaining, state.principal);
        state.principal -= payPrincipal;
        const paid = payInterest + payPrincipal;
        monthlyPaid += paid;
      }

      let extra = extraMonthlyPayment;
      const avalanche = states
        .filter(state => month > state.graceMonths && state.principal + state.accruedInterest > 0.005)
        .sort((a, b) => b.apr - a.apr || b.principal - a.principal);
      for (const state of avalanche) {
        if (extra <= 0.005) break;
        const payInterest = Math.min(extra, state.accruedInterest);
        state.accruedInterest -= payInterest;
        extra -= payInterest;
        const payPrincipal = Math.min(extra, state.principal);
        state.principal -= payPrincipal;
        extra -= payPrincipal;
        const paid = payInterest + payPrincipal;
        monthlyPaid += paid;
        totalExtraPaid += paid;
      }

      totalPaid += monthlyPaid;
      totalRepaymentInterest += monthlyInterest;
      const balance = states.reduce((sum, state) => sum + Math.max(0, state.principal) + Math.max(0, state.accruedInterest), 0);
      rows.push(Object.freeze({ month, payment: cents(monthlyPaid), interestAccrued: cents(monthlyInterest), balance: cents(balance) }));
      if (balance <= 0.01) { payoffMonth = month; break; }
    }
    if (!payoffMonth && rows.length) payoffMonth = rows.length;
    const fullRepaymentMonthlyMinimum = cents(states.reduce((sum, state) => sum + (state.basePayment || 0), 0));
    const yearBuckets = new Map();
    rows.forEach(row => {
      const yearIndex = Math.floor((row.month - 1) / 12);
      const bucket = yearBuckets.get(yearIndex) || { payments: 0, interest: 0, endingBalance: 0 };
      bucket.payments += row.payment;
      bucket.interest += row.interestAccrued;
      bucket.endingBalance = row.balance;
      yearBuckets.set(yearIndex, bucket);
    });
    return Object.freeze({
      monthlyMinimum: fullRepaymentMonthlyMinimum,
      payoffMonthsAfterGraduation: payoffMonth,
      totalPaid: cents(totalPaid),
      totalRepaymentInterest: cents(totalRepaymentInterest),
      totalExtraPaid: cents(totalExtraPaid),
      rows: Object.freeze(rows),
      yearBuckets
    });
  }

  function projectEducationLoans({ annualFundingNeeds, attendanceYears, dependencyStatus, priorFederalStudentPrincipal = 0, priorFederalSubsidizedPrincipal = 0, priorParentPlusPrincipal = 0, annualLoans, privateTerms, extraMonthlyPayment = 0 }) {
    if (!Number.isInteger(attendanceYears) || attendanceYears < 1 || attendanceYears > 8 || !finite(extraMonthlyPayment) || extraMonthlyPayment < 0) return Object.freeze({ ready: false, errors: Object.freeze(['loan.repaymentTerms']) });
    if (priorFederalStudentPrincipal > 0.01 || priorParentPlusPrincipal > 0.01) return Object.freeze({ ready: false, errors: Object.freeze(['loan.existingLoanDetailsRequired']), warnings: Object.freeze(['Prior balances cannot be amortized accurately without their individual loan terms.']) });
    const validation = validateLoanPlan({ annualFundingNeeds, dependencyStatus, priorFederalStudentPrincipal, priorFederalSubsidizedPrincipal, priorParentPlusPrincipal, annualLoans, privateTerms });
    if (!validation.ready) return Object.freeze({ ready: false, errors: validation.errors, warnings: validation.warnings });

    const studentTranches = [];
    const parentTranches = [];
    const annual = [];
    let totalFees = 0;
    let totalInSchoolInterest = 0;
    let totalInSchoolInterestPaid = 0;
    let studentPrincipalBorrowed = 0;
    let federalStudentPrincipal = 0;
    let subsidizedStudentPrincipal = 0;
    let unsubsidizedStudentPrincipal = 0;
    let privateStudentPrincipal = 0;
    let parentPrincipal = 0;
    let federalAccruedAtGraduation = 0;
    let privateAccruedAtGraduation = 0;
    let parentAccruedAtGraduation = 0;

    const directPrincipalForTier = validation.rows.reduce((sum, row) => sum + row.subsidizedGross + row.unsubsidizedGross, 0);
    const studentTieredTermMonths = tieredStandardTermMonths(directPrincipalForTier) || 120;
    const projectedParentRepaymentPrincipal = validation.rows.reduce((sum, row) => {
      const schoolInterest = interestToGraduation(row.parentPlusGross, row.parentPlusApr, row.academicYearIndex, attendanceYears);
      const deferredInterest = row.parentPlusGross * row.parentPlusApr * (FEDERAL_POLICY_2026.parentPlusDeferredMonthsAfterEnrollment / 12);
      return sum + row.parentPlusGross + schoolInterest + deferredInterest;
    }, 0);
    const parentTieredTermMonths = tieredStandardTermMonths(projectedParentRepaymentPrincipal) || 120;

    validation.rows.forEach((row, index) => {
      const need = annualFundingNeeds[index];
      const directFee = (row.subsidizedGross + row.unsubsidizedGross) * row.directFeeRate;
      const plusFee = row.parentPlusGross * row.parentPlusFeeRate;
      const privateFee = row.privateGross * (row.privateFeeRate || 0);
      totalFees += directFee + plusFee + privateFee;

      const subInterest = 0;
      const unsubInterest = interestToGraduation(row.unsubsidizedGross, row.directApr, row.academicYearIndex, attendanceYears);
      const plusInterest = interestToGraduation(row.parentPlusGross, row.parentPlusApr, row.academicYearIndex, attendanceYears);
      const privateInterestRaw = interestToGraduation(row.privateGross, row.privateApr || 0, row.academicYearIndex, attendanceYears);
      const privateInterestUnpaid = privateTerms?.inSchoolPaymentMode === 'interest_only' ? 0 : privateInterestRaw;
      const privateInterestPaid = privateTerms?.inSchoolPaymentMode === 'interest_only' ? privateInterestRaw : 0;
      totalInSchoolInterest += unsubInterest + plusInterest + privateInterestRaw;
      totalInSchoolInterestPaid += privateInterestPaid;

      if (row.subsidizedGross > 0) studentTranches.push({ id: `y${row.academicYearIndex}-sub`, type: 'direct_subsidized', borrower: 'student', principal: row.subsidizedGross, accruedInterestAtGraduation: subInterest, apr: row.directApr, graceMonths: FEDERAL_POLICY_2026.directGraceMonths, accruesDuringGrace: false, capitalizeAtRepayment: false, termMonths: studentTieredTermMonths });
      if (row.unsubsidizedGross > 0) studentTranches.push({ id: `y${row.academicYearIndex}-unsub`, type: 'direct_unsubsidized', borrower: 'student', principal: row.unsubsidizedGross, accruedInterestAtGraduation: unsubInterest, apr: row.directApr, graceMonths: FEDERAL_POLICY_2026.directGraceMonths, accruesDuringGrace: true, capitalizeAtRepayment: false, termMonths: studentTieredTermMonths });
      if (row.privateGross > 0) studentTranches.push({ id: `y${row.academicYearIndex}-private`, type: 'private', borrower: 'student', principal: row.privateGross, accruedInterestAtGraduation: privateInterestUnpaid, apr: row.privateApr, graceMonths: privateTerms.graceMonths, accruesDuringGrace: true, capitalizeAtRepayment: privateTerms.capitalizeAtRepayment, termMonths: privateTerms.termMonths });
      if (row.parentPlusGross > 0) parentTranches.push({ id: `y${row.academicYearIndex}-plus`, type: 'parent_plus', borrower: 'parent', principal: row.parentPlusGross, accruedInterestAtGraduation: plusInterest, apr: row.parentPlusApr, graceMonths: FEDERAL_POLICY_2026.parentPlusDeferredMonthsAfterEnrollment, accruesDuringGrace: true, capitalizeAtRepayment: true, termMonths: parentTieredTermMonths });

      subsidizedStudentPrincipal += row.subsidizedGross;
      unsubsidizedStudentPrincipal += row.unsubsidizedGross;
      federalStudentPrincipal += row.subsidizedGross + row.unsubsidizedGross;
      privateStudentPrincipal += row.privateGross;
      studentPrincipalBorrowed += row.subsidizedGross + row.unsubsidizedGross + row.privateGross;
      parentPrincipal += row.parentPlusGross;
      federalAccruedAtGraduation += unsubInterest;
      privateAccruedAtGraduation += privateInterestUnpaid;
      parentAccruedAtGraduation += plusInterest;

      const federalNet = netFromGross(row.subsidizedGross + row.unsubsidizedGross, row.directFeeRate);
      const plusNet = netFromGross(row.parentPlusGross, row.parentPlusFeeRate);
      const privateNet = netFromGross(row.privateGross, row.privateFeeRate || 0);
      const netNeed = Math.max(0, need.netNeed || 0);
      annual.push(Object.freeze({
        academicYearIndex: row.academicYearIndex,
        calendarStartYear: row.calendarStartYear,
        fundingNeed: cents(netNeed),
        subsidizedGross: row.subsidizedGross,
        unsubsidizedGross: row.unsubsidizedGross,
        parentPlusGross: row.parentPlusGross,
        privateGross: row.privateGross,
        directApr: row.directApr,
        parentPlusApr: row.parentPlusApr,
        directFeeRate: row.directFeeRate,
        parentPlusFeeRate: row.parentPlusFeeRate,
        privateApr: row.privateApr,
        privateFeeRate: row.privateFeeRate,
        directNetProceeds: cents(federalNet),
        parentPlusNetProceeds: cents(plusNet),
        privateNetProceeds: cents(privateNet),
        netProceeds: cents(federalNet + plusNet + privateNet),
        loanFees: cents(directFee + plusFee + privateFee),
        unsubsidizedInterestAtGraduation: cents(unsubInterest),
        privateInterestAtGraduation: cents(privateInterestUnpaid),
        parentPlusInterestAtGraduation: cents(plusInterest),
        privateInterestPaidInSchool: cents(privateInterestPaid),
        rateStatus: rateStatus(row.calendarStartYear)
      }));
    });

    const studentSchedule = portfolioSchedule(studentTranches, { extraMonthlyPayment });
    const parentSchedule = portfolioSchedule(parentTranches, { extraMonthlyPayment: 0 });
    const studentDebtAtRepaymentStart = studentTranches.reduce((sum, tranche) => { const start = stateAtRepaymentStart(tranche); return sum + start.principal + start.accruedInterest; }, 0);
    const parentDebtAtRepaymentStart = parentTranches.reduce((sum, tranche) => { const start = stateAtRepaymentStart(tranche); return sum + start.principal + start.accruedInterest; }, 0);
    const studentDebtAtGraduation = studentPrincipalBorrowed + federalAccruedAtGraduation + privateAccruedAtGraduation;
    const federalStudentDebtAtGraduation = federalStudentPrincipal + federalAccruedAtGraduation;
    const privateDebtAtGraduation = privateStudentPrincipal + privateAccruedAtGraduation;
    const parentDebtAtGraduation = parentPrincipal + parentAccruedAtGraduation;

    return Object.freeze({
      ready: true,
      engineVersion: LOAN_ENGINE_VERSION,
      policy: FEDERAL_POLICY_2026,
      repaymentPolicy: Object.freeze({
        federalStudentPlan: 'tiered_standard',
        federalStudentTermMonths: studentTieredTermMonths,
        parentPlusPlan: 'tiered_standard',
        parentPlusTermMonths: parentTieredTermMonths,
        method: 'Current-law fixed-payment baseline for Direct Loans first disbursed on or after July 1, 2026; term is selected from the Tiered Standard balance thresholds.'
      }),
      warnings: validation.warnings,
      annual: Object.freeze(annual),
      student: Object.freeze({
        principalBorrowed: cents(studentPrincipalBorrowed),
        federalPrincipalBorrowed: cents(federalStudentPrincipal),
        subsidizedPrincipalBorrowed: cents(subsidizedStudentPrincipal),
        unsubsidizedPrincipalBorrowed: cents(unsubsidizedStudentPrincipal),
        privatePrincipalBorrowed: cents(privateStudentPrincipal),
        federalAccruedInterestAtGraduation: cents(federalAccruedAtGraduation),
        privateAccruedInterestAtGraduation: cents(privateAccruedAtGraduation),
        federalDebtAtGraduation: cents(federalStudentDebtAtGraduation),
        privateDebtAtGraduation: cents(privateDebtAtGraduation),
        debtAtGraduation: cents(studentDebtAtGraduation),
        debtAtRepaymentStart: cents(studentDebtAtRepaymentStart),
        monthlyMinimum: studentSchedule?.monthlyMinimum || 0,
        payoffMonthsAfterGraduation: studentSchedule?.payoffMonthsAfterGraduation || 0,
        totalRepaymentPaid: studentSchedule?.totalPaid || 0,
        totalRepaymentInterest: studentSchedule?.totalRepaymentInterest || 0,
        schedule: studentSchedule
      }),
      parent: Object.freeze({
        principalBorrowed: cents(parentPrincipal),
        accruedInterestAtGraduation: cents(parentAccruedAtGraduation),
        debtAtGraduation: cents(parentDebtAtGraduation),
        debtAtRepaymentStart: cents(parentDebtAtRepaymentStart),
        monthlyMinimum: parentSchedule?.monthlyMinimum || 0,
        payoffMonthsAfterGraduation: parentSchedule?.payoffMonthsAfterGraduation || 0,
        totalRepaymentPaid: parentSchedule?.totalPaid || 0,
        totalRepaymentInterest: parentSchedule?.totalRepaymentInterest || 0,
        schedule: parentSchedule
      }),
      fees: Object.freeze({ totalOriginationFees: cents(totalFees) }),
      interest: Object.freeze({ totalInSchoolInterestAccrued: cents(totalInSchoolInterest), privateInterestPaidInSchool: cents(totalInSchoolInterestPaid) }),
      tranches: Object.freeze([...studentTranches, ...parentTranches].map(item => Object.freeze({ ...item })))
    });
  }

  return Object.freeze({
    LOAN_ENGINE_VERSION,
    FEDERAL_POLICY_2026,
    annualLimit,
    isDependencyStatus,
    rateStatus,
    tieredStandardTermMonths,
    netFromGross,
    grossNeededForNet,
    suggestLoanPlan,
    validateLoanPlan,
    interestToGraduation,
    solveFixedPayment,
    portfolioSchedule,
    projectEducationLoans
  });
});
