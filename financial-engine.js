(function (root, factory) {
  const stateData = typeof module === 'object' && module.exports
    ? require('./state-tax-data-2026.js')
    : root.CollegeTabStateTaxData2026;
  const loanEngine = typeof module === 'object' && module.exports
    ? require('./loan-engine.js')
    : root.CollegeTabLoanEngine;
  const savingsEngine = typeof module === 'object' && module.exports
    ? require('./savings-engine.js')
    : root.CollegeTabSavingsEngine;
  const api = factory(stateData, loanEngine, savingsEngine);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CollegeTabFinancialEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (stateData, loanEngine, savingsEngine) {
  'use strict';

  const ENGINE_VERSION = '2026.08.20-v5';
  const TAX_BASE_YEAR = 2026;
  const DAYS_PER_YEAR = 365.25;

  const FEDERAL_2026 = Object.freeze({
    source: Object.freeze({
      provider: 'Internal Revenue Service',
      authority: 'Revenue Procedure 2025-32 / IR-2025-103',
      taxYear: 2026,
      standardDeduction: { single: 16100, married_joint: 32200, married_separate: 16100, head_household: 24150 }
    }),
    brackets: Object.freeze({
      single: Object.freeze([[0,.10],[12400,.12],[50400,.22],[105700,.24],[201775,.32],[256225,.35],[640600,.37]]),
      married_joint: Object.freeze([[0,.10],[24800,.12],[100800,.22],[211400,.24],[403550,.32],[512450,.35],[768700,.37]]),
      married_separate: Object.freeze([[0,.10],[12400,.12],[50400,.22],[105700,.24],[201775,.32],[256225,.35],[384350,.37]]),
      head_household: Object.freeze([[0,.10],[17700,.12],[67450,.22],[105700,.24],[201750,.32],[256200,.35],[640600,.37]])
    })
  });

  const FICA_2026 = Object.freeze({
    source: Object.freeze({ provider: 'Social Security Administration / IRS', taxYear: 2026 }),
    socialSecurityRate: 0.062,
    socialSecurityWageBase: 184500,
    medicareRate: 0.0145,
    additionalMedicareRate: 0.009,
    additionalMedicareThreshold: Object.freeze({ single: 200000, head_household: 200000, married_joint: 250000, married_separate: 125000 })
  });

  const RETIREMENT_2026 = Object.freeze({
    source: Object.freeze({ provider: 'Internal Revenue Service', authority: 'Notice 2025-67 / IR-2025-111', taxYear: 2026 }),
    electiveDeferralLimit: 24500,
    annualAdditionLimit: 72000,
    compensationLimit: 360000
  });

  function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
  function roundCents(value) { return finite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : null; }
  function roundDollars(value) { return finite(value) ? Math.round(value) : null; }
  function validRate(value, min = -0.99, max = 10) { return finite(value) && value >= min && value <= max; }
  function grow(value, rate, years) {
    if (!finite(value) || !validRate(rate) || !finite(years)) return null;
    const result = value * Math.pow(1 + rate, years);
    return finite(result) ? result : null;
  }

  function canonicalize(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(canonicalize);
    return Object.keys(value).sort().reduce((out, key) => { out[key] = canonicalize(value[key]); return out; }, {});
  }

  function fingerprint(value) {
    const text = JSON.stringify(canonicalize(value));
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return `CT-${ENGINE_VERSION}-${(hash >>> 0).toString(16).padStart(8, '0').toUpperCase()}`;
  }

  function progressiveTax(taxableIncome, brackets) {
    if (!finite(taxableIncome) || taxableIncome <= 0 || !Array.isArray(brackets) || !brackets.length) return 0;
    const rows = brackets
      .map(row => Array.isArray(row) ? { threshold: row[0], rate: row[1] } : { threshold: row?.threshold, rate: row?.rate })
      .filter(row => finite(row.threshold) && row.threshold >= 0 && validRate(row.rate, 0, 1))
      .sort((a,b) => a.threshold - b.threshold);
    if (!rows.length) return 0;
    let tax = 0;
    for (let i = 0; i < rows.length; i += 1) {
      const current = rows[i];
      const nextThreshold = rows[i + 1]?.threshold ?? Infinity;
      if (taxableIncome <= current.threshold) break;
      const amount = Math.min(taxableIncome, nextThreshold) - current.threshold;
      if (amount > 0) tax += amount * current.rate;
    }
    return roundCents(Math.max(0, tax));
  }

  function scaledBrackets(brackets, scale) {
    return brackets.map(([threshold, rate]) => [threshold * scale, rate]);
  }

  function federalIncomeTax({ grossWages, pretaxRetirement = 0, filingStatus = 'single', taxYear = TAX_BASE_YEAR, policyIndexRate = 0 }) {
    if (!finite(grossWages) || grossWages < 0 || !finite(pretaxRetirement) || pretaxRetirement < 0 || pretaxRetirement > grossWages) return null;
    if (!FEDERAL_2026.brackets[filingStatus]) return null;
    if (!Number.isInteger(taxYear) || taxYear < TAX_BASE_YEAR || !validRate(policyIndexRate, 0, .2)) return null;
    const years = taxYear - TAX_BASE_YEAR;
    const scale = Math.pow(1 + policyIndexRate, years);
    const deduction = FEDERAL_2026.source.standardDeduction[filingStatus] * scale;
    const agi = grossWages - pretaxRetirement;
    const taxableIncome = Math.max(0, agi - deduction);
    const tax = progressiveTax(taxableIncome, scaledBrackets(FEDERAL_2026.brackets[filingStatus], scale));
    return Object.freeze({
      tax: roundCents(tax),
      agi: roundCents(agi),
      taxableIncome: roundCents(taxableIncome),
      standardDeduction: roundCents(deduction),
      filingStatus,
      taxYear,
      effectiveRate: grossWages > 0 ? tax / grossWages : 0,
      method: taxYear === TAX_BASE_YEAR ? '2026 statutory brackets + standard deduction' : '2026 current-law brackets + standard deduction indexed by policyIndexRate',
      exclusions: Object.freeze(['tax credits', 'itemized deductions', 'special deductions', 'non-wage income', 'AMT'])
    });
  }

  function ficaTax({ grossWages, filingStatus = 'single', taxYear = TAX_BASE_YEAR, policyIndexRate = 0 }) {
    if (!finite(grossWages) || grossWages < 0 || !FICA_2026.additionalMedicareThreshold[filingStatus]) return null;
    if (!Number.isInteger(taxYear) || taxYear < TAX_BASE_YEAR || !validRate(policyIndexRate, 0, .2)) return null;
    const years = taxYear - TAX_BASE_YEAR;
    const scale = Math.pow(1 + policyIndexRate, years);
    const wageBase = FICA_2026.socialSecurityWageBase * scale;
    const additionalThreshold = FICA_2026.additionalMedicareThreshold[filingStatus];
    const socialSecurity = Math.min(grossWages, wageBase) * FICA_2026.socialSecurityRate;
    const medicare = grossWages * FICA_2026.medicareRate;
    const additionalMedicare = Math.max(0, grossWages - additionalThreshold) * FICA_2026.additionalMedicareRate;
    return Object.freeze({
      tax: roundCents(socialSecurity + medicare + additionalMedicare),
      socialSecurity: roundCents(socialSecurity),
      medicare: roundCents(medicare),
      additionalMedicare: roundCents(additionalMedicare),
      socialSecurityWageBase: roundCents(wageBase),
      additionalMedicareThreshold: roundCents(additionalThreshold),
      taxYear,
      method: taxYear === TAX_BASE_YEAR ? '2026 statutory employee FICA rates and wage base' : '2026 statutory rates; Social Security wage base projected by policyIndexRate; Additional Medicare threshold held at statutory nominal amount'
    });
  }

  function stateIncomeTax({ grossWages, pretaxRetirement = 0, state, filingStatus = 'single', taxYear = TAX_BASE_YEAR, policyIndexRate = 0, localIncomeTaxRate = 0 }) {
    const code = String(state || '').toUpperCase();
    const rule = stateData?.STATES?.[code];
    if (!rule || !finite(grossWages) || grossWages < 0 || !finite(pretaxRetirement) || pretaxRetirement < 0 || pretaxRetirement > grossWages) return null;
    if (!['single','married_joint'].includes(filingStatus)) return null;
    if (!Number.isInteger(taxYear) || taxYear < TAX_BASE_YEAR || !validRate(policyIndexRate, 0, .2) || !validRate(localIncomeTaxRate, 0, .25)) return null;
    const statusKey = filingStatus === 'married_joint' ? 'joint' : 'single';
    const years = taxYear - TAX_BASE_YEAR;
    const scale = Math.pow(1 + policyIndexRate, years);
    const deductibleRetirement = rule.retirementPretaxDeductible === false ? 0 : pretaxRetirement;
    const stateAgi = grossWages - deductibleRetirement;
    const deduction = (rule.standardDeduction?.[statusKey] || 0) * scale;
    const exemption = (rule.exemption?.[statusKey] || 0) * scale;
    const credit = (rule.credit?.[statusKey] || 0) * scale;
    const taxableIncome = Math.max(0, stateAgi - deduction - exemption);
    const brackets = (rule[statusKey] || []).map(row => ({ threshold: row.threshold * scale, rate: row.rate }));
    const baseTax = rule.type === 'none' ? 0 : progressiveTax(taxableIncome, brackets);
    const afterCredit = Math.max(0, baseTax - credit);
    const localTax = Math.max(0, stateAgi) * localIncomeTaxRate;
    return Object.freeze({
      tax: roundCents(afterCredit + localTax),
      stateTax: roundCents(afterCredit),
      localTax: roundCents(localTax),
      stateAgi: roundCents(stateAgi),
      retirementDeductionApplied: roundCents(deductibleRetirement),
      taxableIncome: roundCents(taxableIncome),
      standardDeduction: roundCents(deduction),
      personalExemption: roundCents(exemption),
      personalCredit: roundCents(credit),
      state: code,
      stateName: rule.name,
      filingStatus,
      taxYear,
      quality: 'planning-estimate',
      notes: rule.notes || '',
      method: taxYear === TAX_BASE_YEAR ? '2026 state wage-income baseline' : '2026 state wage-income baseline indexed by policyIndexRate',
      source: stateData.SOURCE
    });
  }

  function retirementContribution({ grossWages, employeeRate = 0, employerContributionRate = 0, taxYear = TAX_BASE_YEAR, policyIndexRate = 0 }) {
    if (!finite(grossWages) || grossWages < 0 || !validRate(employeeRate, 0, 1) || !validRate(employerContributionRate, 0, 1)) return null;
    if (!Number.isInteger(taxYear) || taxYear < TAX_BASE_YEAR || !validRate(policyIndexRate, 0, .2)) return null;
    const scale = Math.pow(1 + policyIndexRate, taxYear - TAX_BASE_YEAR);
    const electiveDeferralLimit = RETIREMENT_2026.electiveDeferralLimit * scale;
    const annualAdditionLimit = RETIREMENT_2026.annualAdditionLimit * scale;
    const compensationLimit = RETIREMENT_2026.compensationLimit * scale;
    const requestedEmployee = grossWages * employeeRate;
    const employee = Math.min(requestedEmployee, electiveDeferralLimit);
    // Employer contributions use a simplified flat contribution rate and qualified-plan compensation cap.
    // The combined modeled annual addition is also capped so aggressive employer assumptions cannot create impossible balances.
    const eligibleEmployerCompensation = Math.min(grossWages, compensationLimit);
    const requestedEmployer = eligibleEmployerCompensation * employerContributionRate;
    const employer = Math.min(requestedEmployer, Math.max(0, annualAdditionLimit - employee));
    return Object.freeze({
      employee: roundCents(employee),
      employer: roundCents(employer),
      requestedEmployee: roundCents(requestedEmployee),
      total: roundCents(employee + employer),
      requestedEmployer: roundCents(requestedEmployer),
      electiveDeferralLimit: roundCents(electiveDeferralLimit),
      annualAdditionLimit: roundCents(annualAdditionLimit),
      compensationLimit: roundCents(compensationLimit),
      contributionCapped: requestedEmployee > employee + 0.005 || requestedEmployer > employer + 0.005,
      taxYear,
      method: taxYear === TAX_BASE_YEAR
        ? '2026 elective-deferral, annual-addition, and compensation limits; employer contribution modeled as flat rate of eligible compensation'
        : '2026 qualified-plan limits indexed by policyIndexRate; employer contribution modeled as flat rate of eligible compensation'
    });
  }

  function simpleInterest(principal, apr, years) {
    if (!finite(principal) || principal < 0 || !validRate(apr, 0, 1) || !finite(years) || years < 0) return null;
    return roundCents(principal * apr * years);
  }

  function dailySimpleInterest(principal, apr, days) {
    if (!finite(principal) || principal < 0 || !validRate(apr, 0, 1) || !finite(days) || days < 0) return null;
    return roundCents((principal * apr / DAYS_PER_YEAR) * days);
  }

  function monthlyPayment(principal, apr, months) {
    if (!finite(principal) || principal < 0 || !validRate(apr, 0, 1) || !Number.isInteger(months) || months < 1 || months > 600) return null;
    if (principal === 0) return 0;
    const r = apr / 12;
    if (r === 0) return roundCents(principal / months);
    return roundCents(principal * r / (1 - Math.pow(1 + r, -months)));
  }

  function repaymentSchedule({ principal, apr, termMonths, extraMonthlyPayment = 0 }) {
    if (!finite(principal) || principal < 0 || !validRate(apr, 0, 1) || !Number.isInteger(termMonths) || termMonths < 1 || termMonths > 600 || !finite(extraMonthlyPayment) || extraMonthlyPayment < 0) return null;
    if (principal === 0) return Object.freeze({ basePayment: 0, scheduledPayment: 0, payoffMonths: 0, totalInterest: 0, totalPaid: 0, rows: Object.freeze([]) });
    const monthlyRate = apr / 12;
    const exactBasePayment = apr === 0
      ? principal / termMonths
      : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -termMonths));
    const basePayment = roundCents(exactBasePayment);
    const scheduledPayment = exactBasePayment + extraMonthlyPayment;
    if (!(scheduledPayment > 0)) return null;
    let balance = principal;
    let totalInterest = 0;
    let totalPaid = 0;
    const rows = [];
    for (let month = 1; month <= 1200 && balance > 0.005; month += 1) {
      const interest = balance * monthlyRate;
      const due = balance + interest;
      const payment = Math.min(scheduledPayment, due);
      const principalPaid = Math.max(0, payment - interest);
      balance = Math.max(0, balance - principalPaid);
      totalInterest += interest;
      totalPaid += payment;
      rows.push(Object.freeze({ month, payment: roundCents(payment), interest: roundCents(interest), principal: roundCents(principalPaid), balance: roundCents(balance) }));
      if (month > termMonths + 600 && extraMonthlyPayment === 0) break;
    }
    return Object.freeze({ basePayment, scheduledPayment: roundCents(scheduledPayment), payoffMonths: rows.length, totalInterest: roundCents(totalInterest), totalPaid: roundCents(totalPaid), rows: Object.freeze(rows) });
  }

  function projectCollegeFinancing({ annualCost, annualGrowthRate, baseYear, startYear, attendanceYears, grantsAnnual = 0, familyAnnual = 0, loanApr = 0, interestAccruesInSchool = true, graceMonths = 6 }) {
    if (!finite(annualCost) || annualCost < 0 || !validRate(annualGrowthRate) || !Number.isInteger(baseYear) || !Number.isInteger(startYear) || !Number.isInteger(attendanceYears) || attendanceYears < 1 || attendanceYears > 8) return null;
    if (!finite(grantsAnnual) || grantsAnnual < 0 || !finite(familyAnnual) || familyAnnual < 0 || !validRate(loanApr, 0, 1) || !Number.isInteger(graceMonths) || graceMonths < 0 || graceMonths > 24) return null;
    const firstYearCost = grow(annualCost, annualGrowthRate, startYear - baseYear);
    if (!finite(firstYearCost) || firstYearCost < 0) return null;
    const rows = [];
    let totalCost = 0, totalGrants = 0, totalFamily = 0, totalBorrowedPrincipal = 0, inSchoolInterest = 0;
    for (let i = 0; i < attendanceYears; i += 1) {
      const cost = firstYearCost * Math.pow(1 + annualGrowthRate, i);
      const grantsUsed = Math.min(grantsAnnual, cost);
      const remainingAfterGrants = Math.max(0, cost - grantsUsed);
      const familyUsed = Math.min(familyAnnual, remainingAfterGrants);
      const borrowed = Math.max(0, remainingAfterGrants - familyUsed);
      const yearsToGraduation = attendanceYears - i - 0.5;
      const interest = interestAccruesInSchool ? borrowed * loanApr * yearsToGraduation : 0;
      totalCost += cost; totalGrants += grantsUsed; totalFamily += familyUsed; totalBorrowedPrincipal += borrowed; inSchoolInterest += interest;
      rows.push(Object.freeze({
        academicYearIndex: i + 1,
        calendarStartYear: startYear + i,
        cost: roundCents(cost),
        grants: roundCents(grantsUsed),
        familyContribution: roundCents(familyUsed),
        borrowedPrincipal: roundCents(borrowed),
        yearsToGraduation: roundCents(yearsToGraduation),
        yearsInterestAccruesToGraduation: interestAccruesInSchool ? roundCents(yearsToGraduation) : 0,
        accruedInterestAtGraduation: roundCents(interest)
      }));
    }
    const graduationDebt = totalBorrowedPrincipal + inSchoolInterest;
    const graceInterest = interestAccruesInSchool ? totalBorrowedPrincipal * loanApr * (graceMonths / 12) : 0;
    const repaymentStartDebt = graduationDebt + graceInterest;
    return Object.freeze({
      firstYearCost: roundCents(firstYearCost), totalCost: roundCents(totalCost), totalGrants: roundCents(totalGrants), totalFamily: roundCents(totalFamily),
      totalBorrowedPrincipal: roundCents(totalBorrowedPrincipal), inSchoolInterest: roundCents(inSchoolInterest), graduationDebt: roundCents(graduationDebt),
      graceInterest: roundCents(graceInterest), repaymentStartDebt: roundCents(repaymentStartDebt), graceMonths, interestAccruesInSchool,
      rows: Object.freeze(rows)
    });
  }

  function futureValueLumpSum(principal, annualReturn, years) {
    if (!finite(principal) || principal < 0 || !validRate(annualReturn) || !finite(years) || years < 0) return null;
    return roundCents(principal * Math.pow(1 + annualReturn, years));
  }

  function futureValueContributions({ startingBalance = 0, annualContribution = 0, annualReturn = 0, years = 0, contributionTiming = 'midyear' }) {
    if (!finite(startingBalance) || startingBalance < 0 || !finite(annualContribution) || annualContribution < 0 || !validRate(annualReturn) || !Number.isInteger(years) || years < 0 || years > 100) return null;
    let balance = startingBalance;
    for (let i = 0; i < years; i += 1) {
      balance = balance * (1 + annualReturn);
      if (contributionTiming === 'start') balance += annualContribution * (1 + annualReturn);
      else if (contributionTiming === 'end') balance += annualContribution;
      else balance += annualContribution * Math.sqrt(1 + annualReturn);
    }
    return roundCents(balance);
  }


  function projectSalary({ startSalary, annualGrowthRate, years }) {
    if (!finite(startSalary) || startSalary < 0 || !validRate(annualGrowthRate, -0.50, 0.50) || !finite(years) || years < 0) return null;
    return roundCents(startSalary * Math.pow(1 + annualGrowthRate, years));
  }

  function inflateExpense({ annualExpense, inflationRate, years }) {
    if (!finite(annualExpense) || annualExpense < 0 || !validRate(inflationRate, 0, 0.20) || !finite(years) || years < 0) return null;
    return roundCents(annualExpense * Math.pow(1 + inflationRate, years));
  }

  function emergencyFundTarget({ annualCoreExpenses, months }) {
    if (!finite(annualCoreExpenses) || annualCoreExpenses < 0 || !finite(months) || months < 0 || months > 24) return null;
    return roundCents((annualCoreExpenses / 12) * months);
  }

  function calculateNetWorth({ retirement = 0, taxableInvestments = 0, emergencySavings = 0, otherAssets = 0, cashDeficit = 0, loanBalance = 0, otherLiabilities = 0 }) {
    const values = [retirement, taxableInvestments, emergencySavings, otherAssets, cashDeficit, loanBalance, otherLiabilities];
    if (values.some(value => !finite(value) || value < 0)) return null;
    return roundCents(retirement + taxableInvestments + emergencySavings + otherAssets - cashDeficit - loanBalance - otherLiabilities);
  }

  function opportunityCost({ cashFlows, annualReturn, yearsToTarget }) {
    if (!Array.isArray(cashFlows) || !validRate(annualReturn) || !finite(yearsToTarget) || yearsToTarget < 0) return null;
    let futureValue = 0;
    for (const flow of cashFlows) {
      if (!flow || !finite(flow.amount) || flow.amount < 0 || !finite(flow.yearsBeforeGraduation) || flow.yearsBeforeGraduation < 0) return null;
      futureValue += flow.amount * Math.pow(1 + annualReturn, yearsToTarget + flow.yearsBeforeGraduation);
    }
    return roundCents(futureValue);
  }

  function loanPaymentMap(schedule, graceMonths) {
    const payments = new Map();
    const balances = new Map();
    if (!schedule) return { payments, balances };
    for (const row of schedule.rows) {
      const absoluteMonth = graceMonths + row.month;
      const yearIndex = Math.floor((absoluteMonth - 1) / 12);
      payments.set(yearIndex, (payments.get(yearIndex) || 0) + row.payment);
      balances.set(yearIndex, row.balance);
    }
    return { payments, balances };
  }

  function loanBalanceAtYearEnd({ yearIndex, graceMonths, collegeModel, loanApr, loanMap }) {
    if (!collegeModel || collegeModel.repaymentStartDebt <= 0) return 0;
    const yearEndMonth = (yearIndex + 1) * 12;
    if (yearEndMonth <= graceMonths) {
      const elapsedGraceYears = yearEndMonth / 12;
      return roundCents(collegeModel.graduationDebt + collegeModel.totalBorrowedPrincipal * loanApr * elapsedGraceYears);
    }
    if (loanMap.balances.has(yearIndex)) return loanMap.balances.get(yearIndex);
    return 0;
  }

  function scenarioCompleteness(input) {
    const missing = [];
    const requireMoney = (path, value, { positive = false, max = 10000000 } = {}) => {
      if (!finite(value) || value < 0 || value > max || (positive && value <= 0)) missing.push(path);
    };
    const requireRate = (path, value, min, max) => { if (!validRate(value, min, max)) missing.push(path); };

    requireMoney('college.annualCost', input?.college?.annualCost, { positive: true });
    requireRate('college.annualGrowthRate', input?.college?.annualGrowthRate, -0.25, 0.50);
    if (!Number.isInteger(input?.college?.baseYear) || input.college.baseYear < 1990 || input.college.baseYear > 2100) missing.push('college.baseYear');
    if (!Number.isInteger(input?.college?.startYear) || input.college.startYear < 1990 || input.college.startYear > 2100) missing.push('college.startYear');
    if (!Number.isInteger(input?.college?.attendanceYears) || input.college.attendanceYears < 1 || input.college.attendanceYears > 8) missing.push('college.attendanceYears');
    requireMoney('college.grantsAnnual', input?.college?.grantsAnnual);
    requireMoney('college.familyAnnual', input?.college?.familyAnnual);

    if (!loanEngine?.isDependencyStatus?.(input?.financing?.dependencyStatus)) missing.push('loan.dependencyStatus');
    requireMoney('loan.priorFederalStudentPrincipal', input?.financing?.priorFederalStudentPrincipal ?? 0);
    requireMoney('loan.priorFederalSubsidizedPrincipal', input?.financing?.priorFederalSubsidizedPrincipal ?? 0);
    requireMoney('loan.priorParentPlusPrincipal', input?.financing?.priorParentPlusPrincipal ?? 0);
    if (finite(input?.financing?.priorFederalSubsidizedPrincipal) && finite(input?.financing?.priorFederalStudentPrincipal) && input.financing.priorFederalSubsidizedPrincipal > input.financing.priorFederalStudentPrincipal) missing.push('loan.priorFederalSubsidizedPrincipal');
    requireMoney('financing.extraMonthlyPayment', input?.financing?.extraMonthlyPayment ?? 0, { max: 1000000 });
    if (!Array.isArray(input?.financing?.annualLoans)) missing.push('loan.annualLoans');

    requireMoney('career.startSalary', input?.career?.startSalary, { max: 5000000 });
    requireRate('career.salaryGrowthRate', input?.career?.salaryGrowthRate, -0.50, 0.50);
    if (!stateData?.STATES?.[String(input?.career?.workState || '').toUpperCase()]) missing.push('career.workState');
    if (!['single','married_joint'].includes(input?.career?.filingStatus)) missing.push('career.filingStatus');
    requireRate('career.localIncomeTaxRate', input?.career?.localIncomeTaxRate ?? 0, 0, 0.25);

    for (const key of ['housing','food','transportation','healthcare','entertainment','charity','misc']) {
      requireMoney(`expenses.monthly.${key}`, input?.expenses?.monthly?.[key], { max: 100000 });
    }
    requireRate('economy.inflationRate', input?.economy?.inflationRate, 0, 0.20);

    requireRate('wealth.employerContributionRate', input?.wealth?.employerContributionRate, 0, 1);
    requireRate('wealth.investmentReturnRate', input?.wealth?.investmentReturnRate, -0.50, 1);
    requireRate('wealth.cashHysaRate', input?.wealth?.cashHysaRate, 0, 1);
    requireMoney('wealth.emergencyMonths', input?.wealth?.emergencyMonths, { max: 24 });
    if (typeof input?.wealth?.k401Available !== 'boolean') missing.push('wealth.k401Available');
    if (!['none','self','family'].includes(input?.wealth?.hsaCoverage)) missing.push('wealth.hsaCoverage');
    for (const key of ['startingEmergencySavings','startingCash','starting401k','startingHsa','startingRoth','startingBrokerage']) {
      requireMoney(`wealth.${key}`, input?.wealth?.[key] ?? 0);
    }
    if (input?.wealth?.confirmed !== true) missing.push('savings.confirmed');
    const prefCheck = savingsEngine?.validatePreferences?.(input?.wealth?.allocations || {});
    if (!prefCheck?.ready) missing.push(prefCheck?.error || 'savings.allocationTotal');
    if (input?.wealth?.allocations?.k401 > 0 && input?.wealth?.k401Available === false) missing.push('savings.k401Unavailable');
    if (input?.wealth?.allocations?.hsa > 0 && input?.wealth?.hsaCoverage === 'none') missing.push('savings.hsaIneligible');

    if (!Number.isInteger(input?.ages?.graduationAge) || input.ages.graduationAge < 16 || input.ages.graduationAge > 80) missing.push('ages.graduationAge');
    if (!Number.isInteger(input?.ages?.targetAge) || input.ages.targetAge < 17 || input.ages.targetAge > 100) missing.push('ages.targetAge');
    if (Number.isInteger(input?.ages?.graduationAge) && Number.isInteger(input?.ages?.targetAge) && input.ages.targetAge <= input.ages.graduationAge) missing.push('ages.targetAge>graduationAge');
    if (input?.taxPolicy?.indexRate != null) requireRate('taxPolicy.indexRate', input.taxPolicy.indexRate, 0, 0.20);
    return Object.freeze({ ready: missing.length === 0, missing: Object.freeze([...new Set(missing)]) });
  }

  function monthlyExpenseSnapshot(monthly, inflationRate, yearIndex) {
    const factor = Math.pow(1 + inflationRate, yearIndex);
    const out = {};
    for (const key of ['housing','food','transportation','healthcare','entertainment','charity','misc']) out[key] = roundCents(monthly[key] * factor);
    return Object.freeze(out);
  }

  function studentLoanYear(loan, yearIndex) {
    const schedule = loan?.student?.schedule;
    if (!schedule) return Object.freeze({ payments: 0, endingBalance: 0 });
    const bucket = schedule.yearBuckets?.get?.(yearIndex);
    if (bucket) return Object.freeze({ payments: roundCents(bucket.payments || 0), endingBalance: roundCents(bucket.endingBalance || 0) });
    if (loan.student.debtAtRepaymentStart <= 0) return Object.freeze({ payments: 0, endingBalance: 0 });
    const month = Math.min((yearIndex + 1) * 12, schedule.rows?.length || 0);
    if (month > 0 && schedule.rows?.[month - 1]) return Object.freeze({ payments: 0, endingBalance: roundCents(schedule.rows[month - 1].balance || 0) });
    return Object.freeze({ payments: 0, endingBalance: 0 });
  }

  function projectScenario(input) {
    const completeness = scenarioCompleteness(input);
    if (!completeness.ready) return Object.freeze({ ready: false, missing: completeness.missing, fingerprint: fingerprint(input), engineVersion: ENGINE_VERSION });

    const { college, financing, career, expenses, economy, wealth, ages } = input;
    const policyIndexRate = finite(input.taxPolicy?.indexRate) ? input.taxPolicy.indexRate : economy.inflationRate;
    const collegeFunding = projectCollegeFinancing({ ...college, loanApr: 0, interestAccruesInSchool: false, graceMonths: 0 });
    if (!collegeFunding) return Object.freeze({ ready: false, missing: Object.freeze(['college.financing']), fingerprint: fingerprint(input), engineVersion: ENGINE_VERSION });
    const annualFundingNeeds = collegeFunding.rows.map(row => Object.freeze({ academicYearIndex: row.academicYearIndex, calendarStartYear: row.calendarStartYear, netNeed: row.borrowedPrincipal }));
    const annualLoans = Array.isArray(financing.annualLoans) && financing.annualLoans.length === 0 && annualFundingNeeds.every(row => row.netNeed <= 0.01)
      ? annualFundingNeeds.map((row, index) => ({
          academicYearIndex: index + 1,
          calendarStartYear: row.calendarStartYear,
          subsidizedGross: 0,
          unsubsidizedGross: 0,
          parentPlusGross: 0,
          privateGross: 0,
          directApr: loanEngine.FEDERAL_POLICY_2026.directUndergradApr,
          parentPlusApr: loanEngine.FEDERAL_POLICY_2026.parentPlusApr,
          directFeeRate: loanEngine.FEDERAL_POLICY_2026.directFeeRate,
          parentPlusFeeRate: loanEngine.FEDERAL_POLICY_2026.parentPlusFeeRate,
          privateApr: null,
          privateFeeRate: null
        }))
      : financing.annualLoans;
    const loan = loanEngine?.projectEducationLoans?.({
      annualFundingNeeds,
      attendanceYears: college.attendanceYears,
      dependencyStatus: financing.dependencyStatus,
      priorFederalStudentPrincipal: financing.priorFederalStudentPrincipal || 0,
      priorFederalSubsidizedPrincipal: financing.priorFederalSubsidizedPrincipal || 0,
      priorParentPlusPrincipal: financing.priorParentPlusPrincipal || 0,
      annualLoans,
      privateTerms: financing.privateTerms || {},
      extraMonthlyPayment: financing.extraMonthlyPayment || 0
    });
    if (!loan?.ready) return Object.freeze({ ready: false, missing: Object.freeze(loan?.errors || ['loan.annualLoans']), warnings: Object.freeze(loan?.warnings || []), fingerprint: fingerprint(input), engineVersion: ENGINE_VERSION });

    const yearsToTarget = Math.ceil(ages.targetAge - ages.graduationAge);
    const firstWorkTaxYear = college.startYear + college.attendanceYears;
    let emergencyBalance = wealth.startingEmergencySavings || 0;
    let cashBalance = wealth.startingCash || 0;
    let k401Balance = wealth.starting401k || 0;
    let hsaBalance = wealth.startingHsa || 0;
    let rothBalance = wealth.startingRoth || 0;
    let brokerageBalance = wealth.startingBrokerage || 0;
    let cashDeficit = 0;
    const timeline = [];
    const marketReturn = wealth.investmentReturnRate;
    const marketMidyearFactor = Math.sqrt(1 + marketReturn);
    const cashMidyearFactor = Math.sqrt(1 + wealth.cashHysaRate);

    for (let yearIndex = 0; yearIndex < yearsToTarget; yearIndex += 1) {
      const ageStart = ages.graduationAge + yearIndex;
      const ageEnd = Math.min(ages.targetAge, ageStart + 1);
      const taxYear = firstWorkTaxYear + yearIndex;
      const salary = projectSalary({ startSalary: career.startSalary, annualGrowthRate: career.salaryGrowthRate, years: yearIndex });
      const month = monthlyExpenseSnapshot(expenses.monthly, economy.inflationRate, yearIndex);
      const monthlyBudget = Object.values(month).reduce((sum, value) => sum + value, 0);
      const annualBudget = monthlyBudget * 12;
      const loanYear = studentLoanYear(loan, yearIndex);
      const monthlyRequiredLoan = loanYear.payments / 12;
      const essentialMonthly = month.housing + month.food + month.transportation + month.healthcare + month.misc + monthlyRequiredLoan;
      const emergencyTarget = savingsEngine.emergencyTarget({ monthlyEssentials: essentialMonthly, months: wealth.emergencyMonths });

      // Existing balances grow for the year before new contributions are added. Emergency cash is capped at its current target;
      // excess HYSA growth is released back into the year's savings pool rather than allowing the reserve to silently exceed its policy target.
      const emergencyGrown = emergencyBalance * (1 + wealth.cashHysaRate);
      emergencyBalance = Math.min(emergencyTarget, emergencyGrown);
      const emergencySweep = Math.max(0, emergencyGrown - emergencyTarget);
      cashBalance *= (1 + wealth.cashHysaRate);
      k401Balance *= (1 + marketReturn);
      hsaBalance *= (1 + marketReturn);
      rothBalance *= (1 + marketReturn);
      brokerageBalance *= (1 + marketReturn);

      const calcTaxes = employee401 => {
        const federal = federalIncomeTax({ grossWages: salary, pretaxRetirement: employee401, filingStatus: career.filingStatus, taxYear: Math.max(TAX_BASE_YEAR, taxYear), policyIndexRate });
        const state = stateIncomeTax({ grossWages: salary, pretaxRetirement: employee401, state: career.workState, filingStatus: career.filingStatus, taxYear: Math.max(TAX_BASE_YEAR, taxYear), policyIndexRate, localIncomeTaxRate: career.localIncomeTaxRate || 0 });
        const fica = ficaTax({ grossWages: salary, filingStatus: career.filingStatus, taxYear: Math.max(TAX_BASE_YEAR, taxYear), policyIndexRate });
        return { federal, state, fica, total: federal.tax + state.tax + fica.tax };
      };

      let employee401 = 0;
      let allocation = { ready: true, allocations: { k401:0,hsa:0,roth:0,brokerage:0,cash:0 }, spillToBrokerage: 0 };
      let taxes = calcTaxes(0);
      let resourceBeforeDeficit = 0;
      let emergencyAdded = 0;

      // 401(k) contributions change income tax, so solve the savings-allocation/tax interaction to a stable fixed point.
      for (let i = 0; i < 24; i += 1) {
        taxes = calcTaxes(employee401);
        resourceBeforeDeficit = salary - taxes.total - annualBudget - loanYear.payments + emergencySweep;
        const repayDeficit = Math.min(Math.max(0, resourceBeforeDeficit), cashDeficit);
        const afterDeficit = Math.max(0, resourceBeforeDeficit - repayDeficit);
        const reserveGap = Math.max(0, emergencyTarget - emergencyBalance);
        const reserveAdd = Math.min(afterDeficit, reserveGap);
        const allocPool = Math.max(0, afterDeficit - reserveAdd);
        const limits = savingsEngine.accountLimits({ taxYear: Math.max(TAX_BASE_YEAR, taxYear), age: ageStart, filingStatus: career.filingStatus, magi: Math.max(0, salary - employee401), hsaCoverage: wealth.hsaCoverage, policyIndexRate });
        allocation = savingsEngine.allocate({ amount: allocPool, preferences: wealth.allocations, limits, eligibility: { k401: wealth.k401Available, hsa: wealth.hsaCoverage !== 'none', roth: true } });
        const next401 = allocation?.ready ? allocation.allocations.k401 : 0;
        if (Math.abs(next401 - employee401) < 0.01) { employee401 = next401; break; }
        employee401 = next401;
      }

      taxes = calcTaxes(employee401);
      resourceBeforeDeficit = salary - taxes.total - annualBudget - loanYear.payments + emergencySweep;
      if (resourceBeforeDeficit >= 0) {
        const deficitPaid = Math.min(resourceBeforeDeficit, cashDeficit);
        cashDeficit -= deficitPaid;
        let distributable = resourceBeforeDeficit - deficitPaid;
        emergencyAdded = Math.min(distributable, Math.max(0, emergencyTarget - emergencyBalance));
        emergencyBalance += emergencyAdded;
        distributable -= emergencyAdded;
        const limits = savingsEngine.accountLimits({ taxYear: Math.max(TAX_BASE_YEAR, taxYear), age: ageStart, filingStatus: career.filingStatus, magi: Math.max(0, salary - employee401), hsaCoverage: wealth.hsaCoverage, policyIndexRate });
        allocation = savingsEngine.allocate({ amount: Math.max(0, distributable), preferences: wealth.allocations, limits, eligibility: { k401: wealth.k401Available, hsa: wealth.hsaCoverage !== 'none', roth: true } });
        employee401 = allocation.ready ? allocation.allocations.k401 : 0;
      } else {
        allocation = { ready: true, allocations: { k401:0,hsa:0,roth:0,brokerage:0,cash:0 }, spillToBrokerage: 0 };
        employee401 = 0;
        taxes = calcTaxes(0);
        let need = -(salary - taxes.total - annualBudget - loanYear.payments + emergencySweep);
        const fromCash = Math.min(need, cashBalance); cashBalance -= fromCash; need -= fromCash;
        const fromBrokerage = Math.min(need, brokerageBalance); brokerageBalance -= fromBrokerage; need -= fromBrokerage;
        const fromEmergency = Math.min(need, emergencyBalance); emergencyBalance -= fromEmergency; need -= fromEmergency;
        if (need > 0) cashDeficit += need;
        resourceBeforeDeficit = -need;
      }

      const retirement = retirementContribution({ grossWages: salary, employeeRate: salary > 0 ? employee401 / salary : 0, employerContributionRate: wealth.employerContributionRate, taxYear: Math.max(TAX_BASE_YEAR, taxYear), policyIndexRate });
      const finalAlloc = allocation.allocations;
      k401Balance += (finalAlloc.k401 + retirement.employer) * marketMidyearFactor;
      hsaBalance += finalAlloc.hsa * marketMidyearFactor;
      rothBalance += finalAlloc.roth * marketMidyearFactor;
      brokerageBalance += finalAlloc.brokerage * marketMidyearFactor;
      cashBalance += finalAlloc.cash * cashMidyearFactor;

      const spendableTakeHome = salary - finalAlloc.k401 - taxes.federal.tax - taxes.state.tax - taxes.fica.tax;
      const retirementBalance = k401Balance + hsaBalance + rothBalance;
      const netWorth = calculateNetWorth({ retirement: retirementBalance, taxableInvestments: brokerageBalance, emergencySavings: emergencyBalance, otherAssets: cashBalance, cashDeficit, loanBalance: loanYear.endingBalance });
      timeline.push(Object.freeze({
        yearIndex, ageStart: roundCents(ageStart), ageEnd: roundCents(ageEnd), taxYear,
        salary: roundCents(salary), employeeRetirement: roundCents(finalAlloc.k401), employerRetirement: retirement.employer,
        federalTax: taxes.federal.tax, stateTax: taxes.state.tax, ficaTax: taxes.fica.tax, takeHome: roundCents(spendableTakeHome),
        housing: roundCents(month.housing * 12), otherLiving: roundCents((monthlyBudget - month.housing) * 12), monthlyBudget: roundCents(monthlyBudget), monthlyExpenses: month,
        loanPayments: roundCents(loanYear.payments), cashFlowAfterCoreExpenses: roundCents(salary - taxes.total - annualBudget - loanYear.payments),
        emergencyTarget: roundCents(emergencyTarget), emergencyAdded: roundCents(emergencyAdded), emergencyBalance: roundCents(emergencyBalance),
        savingsAllocation: Object.freeze({ ...finalAlloc }), cashBalance: roundCents(cashBalance), k401Balance: roundCents(k401Balance), hsaBalance: roundCents(hsaBalance), rothBalance: roundCents(rothBalance), brokerageBalance: roundCents(brokerageBalance),
        retirementBalance: roundCents(retirementBalance), taxableInvestments: roundCents(brokerageBalance), cashDeficit: roundCents(cashDeficit), loanBalance: roundCents(loanYear.endingBalance), netWorth: roundCents(netWorth),
        taxDetail: Object.freeze({ federal: taxes.federal, state: taxes.state, fica: taxes.fica }), retirementDetail: retirement
      }));
    }

    const firstYear = timeline[0];
    const lastYear = timeline[timeline.length - 1];
    const debtFreeAge = loan.student.debtAtRepaymentStart <= 0 ? ages.graduationAge : ages.graduationAge + loan.student.payoffMonthsAfterGraduation / 12;
    const familyOpportunityCost = opportunityCost({
      cashFlows: collegeFunding.rows.map(row => ({ amount: row.familyContribution, yearsBeforeGraduation: row.yearsToGraduation })),
      annualReturn: wealth.investmentReturnRate,
      yearsToTarget: ages.targetAge - ages.graduationAge
    });
    const collegeModel = Object.freeze({ ...collegeFunding, graduationDebt: loan.student.debtAtGraduation, repaymentStartDebt: loan.student.debtAtRepaymentStart });
    const normalizedInput = canonicalize(input);
    return Object.freeze({
      ready: true,
      engineVersion: ENGINE_VERSION,
      fingerprint: fingerprint(normalizedInput),
      input: Object.freeze(normalizedInput),
      assumptions: Object.freeze({
        taxBaseYear: TAX_BASE_YEAR,
        futureTaxMethod: '2026 current law indexed by policyIndexRate',
        stateTaxQuality: 'planning-estimate; future state thresholds/deductions are indexed from the 2026 baseline, not predicted law',
        expenseInflationMethod: 'each monthly budget category compounds annually by economy.inflationRate',
        emergencyFundMethod: 'essential monthly expenses plus required student-loan payments, multiplied by selected reserve months; reserve HYSA is capped at that target and repriced annually',
        savingsWaterfall: 'taxes + required loan payments + monthly budget, then emergency HYSA, then user-selected 401(k)/HSA/Roth/brokerage/cash allocations',
        hsaTaxTreatment: 'HSA balance/limits are modeled; HSA payroll tax deduction effects are not yet credited, making take-home conservative when HSA allocations are used',
        investmentReturnTreatment: 'nominal pre-tax account growth; taxable brokerage tax drag not modeled',
        loanInterestMethod: 'dedicated loan-stack engine models subsidized, unsubsidized, private, and Parent PLUS tranches separately'
      }),
      college: collegeModel,
      loan,
      firstYear: Object.freeze({
        salary: firstYear?.salary ?? null,
        annualTakeHome: firstYear?.takeHome ?? null,
        monthlyTakeHome: firstYear ? roundCents(firstYear.takeHome / 12) : null,
        federalTax: firstYear?.federalTax ?? null,
        stateTax: firstYear?.stateTax ?? null,
        ficaTax: firstYear?.ficaTax ?? null,
        annualLoanPayments: firstYear?.loanPayments ?? null,
        monthlyLoanPayment: loan.student.monthlyMinimum,
        monthlyBudget: firstYear?.monthlyBudget ?? null,
        emergencyTarget: firstYear?.emergencyTarget ?? null
      }),
      debtFreeAge: roundCents(debtFreeAge),
      targetAge: ages.targetAge,
      targetNetWorth: lastYear?.netWorth ?? 0,
      familyContributionOpportunityCostAtTarget: familyOpportunityCost,
      timeline: Object.freeze(timeline)
    });
  }

  function compareScenarios(left, right) {
    if (!left?.ready || !right?.ready) return null;
    if (left.engineVersion !== right.engineVersion || left.targetAge !== right.targetAge) return null;
    const netWorthDelta = left.targetNetWorth - right.targetNetWorth;
    const costDelta = left.college.totalCost - right.college.totalCost;
    const debtDelta = left.loan.student.debtAtGraduation - right.loan.student.debtAtGraduation;
    const takeHomeDelta = left.firstYear.monthlyTakeHome - right.firstYear.monthlyTakeHome;
    return Object.freeze({
      leftFingerprint: left.fingerprint,
      rightFingerprint: right.fingerprint,
      targetAge: left.targetAge,
      netWorthDelta: roundCents(netWorthDelta),
      costDelta: roundCents(costDelta),
      graduationDebtDelta: roundCents(debtDelta),
      monthlyTakeHomeDelta: roundCents(takeHomeDelta),
      wealthLeader: netWorthDelta === 0 ? 'tie' : netWorthDelta > 0 ? 'left' : 'right',
      lowerDebt: debtDelta === 0 ? 'tie' : debtDelta < 0 ? 'left' : 'right',
      lowerCollegeCost: costDelta === 0 ? 'tie' : costDelta < 0 ? 'left' : 'right',
      targetNetWorthGap: roundCents(Math.abs(netWorthDelta))
    });
  }

  return Object.freeze({
    ENGINE_VERSION, TAX_BASE_YEAR, FEDERAL_2026, FICA_2026, RETIREMENT_2026,
    progressiveTax, federalIncomeTax, ficaTax, stateIncomeTax, retirementContribution,
    grow, projectSalary, inflateExpense, emergencyFundTarget, calculateNetWorth, futureValueLumpSum, futureValueContributions, simpleInterest, dailySimpleInterest,
    monthlyPayment, repaymentSchedule, projectCollegeFinancing, opportunityCost,
    scenarioCompleteness, projectScenario, compareScenarios, fingerprint, roundCents, roundDollars
  });
});
