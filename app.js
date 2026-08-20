const CURRENT_PLAN_KEY = 'collegetab.currentPlan.v1';
const SAVED_PLANS_KEY = 'collegetab.savedPlans.v1';
const SETTINGS_KEY = 'collegetab.settings.v1';
const SESSION_KEY = 'collegetab.prototypeSession';
const LEGACY_KEYS = {
  current: 'futureledger.currentPlan.v1',
  saved: 'futureledger.savedPlans.v1',
  settings: 'futureledger.settings.v1',
  session: 'futureledger.prototypeSession'
};

const CURRENT_YEAR = new Date().getFullYear();
const START_YEAR_MIN = CURRENT_YEAR - 8;
const START_YEAR_MAX = CURRENT_YEAR + 20;
const VALID_ROLES = new Set(['student', 'family', 'advisor']);
const VALID_YEARS = new Set(['1', '2', '3', '4', '5', '6', '7', '8']);
const VALID_PROGRAMS = new Set(['', 'associate', 'bachelor', 'certificate', 'other']);
const VALID_PRIORITIES = new Set(['cost', 'debt', 'income', 'wealth']);

const routeMeta = {
  overview: ['Overview', 'Your plan, with one clear next step.'],
  onboarding: ['01 · Setup', 'Start with the basics.'],
  colleges: ['02 · College cost', 'Search, source and price the college path.'],
  projection: ['03 · Career + loans', 'Set income, location and the borrowing stack.'],
  budget: ['04 · Monthly budget', 'Turn a state preset into your monthly allowances.'],
  savings: ['05 · Savings', 'Protect the emergency fund, then allocate the rest.'],
  compare: ['06 · Compare', 'Put completed paths next to each other.'],
  saved: ['Saved plans', 'Keep the versions worth comparing.'],
  account: ['Account', 'Workspace preferences and defaults.'],
  billing: ['Billing', 'Simple pricing, clear access.']
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function safeParse(raw, fallback) {
  try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}

function readStorage(key, fallback = null) {
  try { return safeParse(localStorage.getItem(key), fallback); } catch { return fallback; }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function readSettings() {
  const raw = readStorage(SETTINGS_KEY, {});
  const defaultRole = VALID_ROLES.has(raw?.defaultRole) ? raw.defaultRole : '';
  return {
    defaultRole,
    currency: 'USD',
    reduceMotion: Boolean(raw?.reduceMotion)
  };
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `plan-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanId(value) {
  const text = typeof value === 'string' ? value : '';
  return /^[A-Za-z0-9_-]{6,100}$/.test(text) ? text : makeId();
}

function nowIso() {
  return new Date().toISOString();
}

function migrateLegacyStorage() {
  try {
    if (!localStorage.getItem(CURRENT_PLAN_KEY) && localStorage.getItem(LEGACY_KEYS.current)) localStorage.setItem(CURRENT_PLAN_KEY, localStorage.getItem(LEGACY_KEYS.current));
    if (!localStorage.getItem(SAVED_PLANS_KEY) && localStorage.getItem(LEGACY_KEYS.saved)) localStorage.setItem(SAVED_PLANS_KEY, localStorage.getItem(LEGACY_KEYS.saved));
    if (!localStorage.getItem(SETTINGS_KEY) && localStorage.getItem(LEGACY_KEYS.settings)) localStorage.setItem(SETTINGS_KEY, localStorage.getItem(LEGACY_KEYS.settings));
  } catch { /* Migration is best-effort only. */ }
}

function nullableMoney(value, max = 250000) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= max ? Math.round(number) : null;
}

function nullableRate(value) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= -10 && number <= 25 ? Math.round(number * 10) / 10 : null;
}

function nullableNumber(value, min, max, precision = 2) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  const factor = 10 ** precision;
  return Math.round(number * factor) / factor;
}

function normalizeLoanRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 8).map((row, index) => ({
    academicYearIndex: Number.isInteger(Number(row?.academicYearIndex)) ? Number(row.academicYearIndex) : index + 1,
    calendarStartYear: Number.isInteger(Number(row?.calendarStartYear)) ? Number(row.calendarStartYear) : CURRENT_YEAR + index,
    subsidizedGross: nullableMoney(row?.subsidizedGross, 100000) ?? 0,
    unsubsidizedGross: nullableMoney(row?.unsubsidizedGross, 100000) ?? 0,
    parentPlusGross: nullableMoney(row?.parentPlusGross, 100000) ?? 0,
    privateGross: nullableMoney(row?.privateGross, 500000) ?? 0,
    directApr: nullableNumber(row?.directApr, 0, 100, 3) ?? 6.52,
    parentPlusApr: nullableNumber(row?.parentPlusApr, 0, 100, 3) ?? 9.07,
    directFeeRate: nullableNumber(row?.directFeeRate, 0, 25, 3) ?? 1.057,
    parentPlusFeeRate: nullableNumber(row?.parentPlusFeeRate, 0, 25, 3) ?? 4.228,
    privateApr: nullableNumber(row?.privateApr, 0, 100, 3),
    privateFeeRate: nullableNumber(row?.privateFeeRate, 0, 25, 3)
  }));
}

function normalizeBudget(value = {}) {
  const legacyHousing = nullableMoney(value.housingAnnual, 1000000);
  const legacyOther = nullableMoney(value.otherAnnual, 1000000);
  const raw = value.budget && typeof value.budget === 'object' ? value.budget : {};
  return {
    food: nullableMoney(raw.food, 100000),
    housing: nullableMoney(raw.housing, 100000) ?? (legacyHousing == null ? null : Math.round(legacyHousing / 12)),
    transportation: nullableMoney(raw.transportation, 100000),
    healthcare: nullableMoney(raw.healthcare, 100000),
    entertainment: nullableMoney(raw.entertainment, 100000),
    charity: nullableMoney(raw.charity, 100000),
    misc: nullableMoney(raw.misc, 100000) ?? (legacyOther == null ? null : Math.round(legacyOther / 12)),
    source: typeof raw.source === 'string' ? raw.source : (legacyHousing != null || legacyOther != null ? 'legacy-custom' : ''),
    sourceState: /^[A-Z]{2}$/.test(String(raw.sourceState || '').toUpperCase()) ? String(raw.sourceState).toUpperCase() : ''
  };
}

function normalizeScenario(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const legacyPrivateApr = nullableNumber(value.privateApr, 0, 100, 3);
  const legacyPrivateFeeRate = nullableNumber(value.privateOriginationFeeRate, 0, 25, 3);
  const normalizedLoanRows = normalizeLoanRows(value.loanRows).map(row => ({ ...row,
    privateApr: row.privateApr == null && row.privateGross > 0 && legacyPrivateApr != null ? legacyPrivateApr : row.privateApr,
    privateFeeRate: row.privateFeeRate == null && row.privateGross > 0 && legacyPrivateFeeRate != null ? legacyPrivateFeeRate : row.privateFeeRate
  }));
  return {
    startSalary: nullableMoney(value.startSalary, 5000000),
    workState: /^[A-Z]{2}$/.test(String(value.workState || '').toUpperCase()) ? String(value.workState).toUpperCase() : '',
    localIncomeTaxRate: nullableNumber(value.localIncomeTaxRate, 0, 25, 2) ?? 0,
    budget: normalizeBudget(value),
    dependencyStatus: ['dependent','independent','dependent_plus_denied'].includes(value.dependencyStatus) ? value.dependencyStatus : '',
    priorFederalStudentPrincipal: nullableMoney(value.priorFederalStudentPrincipal, 1000000) ?? 0,
    priorFederalSubsidizedPrincipal: nullableMoney(value.priorFederalSubsidizedPrincipal, 1000000) ?? 0,
    priorParentPlusPrincipal: nullableMoney(value.priorParentPlusPrincipal, 1000000) ?? 0,
    privateTermYears: nullableNumber(value.privateTermYears, 1, 50, 0) ?? 10,
    privateGraceMonths: nullableNumber(value.privateGraceMonths, 0, 60, 0) ?? 6,
    privateInSchoolPaymentMode: ['deferred','interest_only'].includes(value.privateInSchoolPaymentMode) ? value.privateInSchoolPaymentMode : 'deferred',
    privateCapitalizeAtRepayment: typeof value.privateCapitalizeAtRepayment === 'boolean' ? value.privateCapitalizeAtRepayment : true,
    extraMonthlyPayment: nullableMoney(value.extraMonthlyPayment, 1000000) ?? 0,
    loanRows: normalizedLoanRows
  };
}

function normalizeProjection(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const legacyRetirement = nullableNumber(value.retirementRate, 0, 100, 2);
  const rawAlloc = value.allocations && typeof value.allocations === 'object' ? value.allocations : {};
  const default401 = legacyRetirement != null ? Math.min(100, legacyRetirement) : 50;
  return {
    graduationAge: nullableNumber(value.graduationAge, 16, 80, 0) ?? 22,
    targetAge: nullableNumber(value.targetAge, 17, 100, 0) ?? 40,
    filingStatus: ['single', 'married_joint'].includes(value.filingStatus) ? value.filingStatus : 'single',
    salaryGrowthRate: nullableNumber(value.salaryGrowthRate, -50, 50, 2) ?? 3,
    inflationRate: nullableNumber(value.inflationRate, 0, 20, 2) ?? 2.5,
    employerContributionRate: nullableNumber(value.employerContributionRate ?? value.employerMatchRate, 0, 100, 2) ?? 0,
    investmentReturnRate: nullableNumber(value.investmentReturnRate, -50, 100, 2) ?? 7,
    emergencyMonths: nullableNumber(value.emergencyMonths, 0, 24, 2) ?? 3,
    cashHysaRate: nullableNumber(value.cashHysaRate, 0, 25, 2) ?? 3.5,
    k401Available: typeof value.k401Available === 'boolean' ? value.k401Available : true,
    hsaCoverage: ['none','self','family'].includes(value.hsaCoverage) ? value.hsaCoverage : 'none',
    allocations: {
      k401: nullableNumber(rawAlloc.k401, 0, 100, 2) ?? default401,
      hsa: nullableNumber(rawAlloc.hsa, 0, 100, 2) ?? 0,
      roth: nullableNumber(rawAlloc.roth, 0, 100, 2) ?? (legacyRetirement != null ? 0 : 25),
      brokerage: nullableNumber(rawAlloc.brokerage, 0, 100, 2) ?? (legacyRetirement != null ? 100-default401 : 25),
      cash: nullableNumber(rawAlloc.cash, 0, 100, 2) ?? 0
    },
    startingEmergencySavings: nullableMoney(value.startingEmergencySavings, 10000000) ?? 0,
    startingCash: nullableMoney(value.startingCash, 10000000) ?? 0,
    starting401k: nullableMoney(value.starting401k ?? value.startingRetirement, 10000000) ?? 0,
    startingHsa: nullableMoney(value.startingHsa, 10000000) ?? 0,
    startingRoth: nullableMoney(value.startingRoth, 10000000) ?? 0,
    startingBrokerage: nullableMoney(value.startingBrokerage ?? value.startingInvestments, 10000000) ?? 0,
    savingsConfirmed: value.savingsConfirmed === true
  };
}

function normalizeSchool(school) {
  if (!school || typeof school !== 'object' || typeof school.name !== 'string') return null;
  const name = school.name.trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!name) return null;
  const rawUnitId = String(school.unitId || school.record?.unitId || '').replace(/\D/g, '').slice(0, 12);
  const record = school.record && typeof school.record === 'object' ? JSON.parse(JSON.stringify(school.record)) : null;
  const id = rawUnitId ? `ipeds-${rawUnitId}` : cleanId(school.id);
  const rawCost = school.cost && typeof school.cost === 'object' ? school.cost : {};
  const rawOverrides = rawCost.overrides && typeof rawCost.overrides === 'object' ? rawCost.overrides : {};
  const yearsCandidate = String(rawCost.years || '');
  return {
    id,
    unitId: rawUnitId,
    name,
    location: typeof school.location === 'string' ? school.location.slice(0, 120) : '',
    ownership: typeof school.ownership === 'string' ? school.ownership.slice(0, 60) : '',
    record,
    cost: {
      residency: rawCost.residency === 'out_of_state' ? 'out_of_state' : 'in_state',
      living: ['oncampus', 'offcampus', 'withfamily'].includes(rawCost.living) ? rawCost.living : 'oncampus',
      years: VALID_YEARS.has(yearsCandidate) ? yearsCandidate : '',
      growthRate: nullableRate(rawCost.growthRate),
      overrides: {
        tuition: nullableMoney(rawOverrides.tuition),
        mandatoryFees: nullableMoney(rawOverrides.mandatoryFees, 100000),
        roomBoard: nullableMoney(rawOverrides.roomBoard, 150000),
        booksSupplies: nullableMoney(rawOverrides.booksSupplies, 50000),
        transportation: nullableMoney(rawOverrides.transportation, 75000),
        personalExpenses: nullableMoney(rawOverrides.personalExpenses, 75000),
        grantsScholarships: nullableMoney(rawOverrides.grantsScholarships),
        familyContribution: nullableMoney(rawOverrides.familyContribution)
      }
    },
    scenario: normalizeScenario(school.scenario)
  };
}

function freshPlan(name = 'Untitled plan', { applyDefaults = false } = {}) {
  const now = nowIso();
  const defaultRole = applyDefaults ? readSettings().defaultRole : '';
  return {
    id: makeId(),
    name: String(name || '').trim().slice(0, 60) || 'Untitled plan',
    createdAt: now,
    updatedAt: now,
    profile: {
      role: defaultRole,
      startYear: '',
      yearsEnrolled: '',
      programType: '',
      priorities: []
    },
    schools: [],
    compare: { aId: '', bId: '' },
    career: { careerName: '', startSalary: '' },
    projection: normalizeProjection({})
  };
}

function normalizePlan(input) {
  const base = freshPlan();
  if (!input || typeof input !== 'object') return base;

  const rawProfile = input.profile && typeof input.profile === 'object' ? input.profile : {};
  const startYearNumber = Number(rawProfile.startYear);
  const startYear = Number.isInteger(startYearNumber) && startYearNumber >= START_YEAR_MIN && startYearNumber <= START_YEAR_MAX
    ? String(startYearNumber)
    : '';
  const yearsEnrolled = VALID_YEARS.has(String(rawProfile.yearsEnrolled || '')) ? String(rawProfile.yearsEnrolled) : '';
  const programType = VALID_PROGRAMS.has(String(rawProfile.programType || '')) ? String(rawProfile.programType || '') : '';
  const priorities = Array.isArray(rawProfile.priorities)
    ? [...new Set(rawProfile.priorities.map(String).filter(value => VALID_PRIORITIES.has(value)))]
    : [];

  const seenKeys = new Set();
  const schools = Array.isArray(input.schools)
    ? input.schools.reduce((result, rawSchool) => {
        const school = normalizeSchool(rawSchool);
        if (!school) return result;
        const key = school.unitId ? `unit:${school.unitId}` : `name:${school.name.toLocaleLowerCase()}`;
        if (seenKeys.has(key)) return result;
        seenKeys.add(key);
        result.push(school);
        return result;
      }, [])
    : [];

  const rawCareer = input.career && typeof input.career === 'object' ? input.career : {};
  const careerName = typeof rawCareer.careerName === 'string' ? rawCareer.careerName.trim().slice(0, 80) : '';
  const salaryCandidate = rawCareer.startSalary === '' || rawCareer.startSalary == null ? '' : Number(rawCareer.startSalary);
  const startSalary = salaryCandidate === '' || !Number.isFinite(salaryCandidate) || salaryCandidate < 0 || salaryCandidate > 1000000
    ? ''
    : Math.round(salaryCandidate);

  const compareInput = input.compare && typeof input.compare === 'object' ? input.compare : {};
  const schoolIds = new Set(schools.map(school => school.id));
  const aId = schoolIds.has(compareInput.aId) ? compareInput.aId : '';
  const bId = schoolIds.has(compareInput.bId) && compareInput.bId !== aId ? compareInput.bId : '';

  const createdAt = typeof input.createdAt === 'string' && !Number.isNaN(new Date(input.createdAt).valueOf()) ? input.createdAt : base.createdAt;
  const updatedAt = typeof input.updatedAt === 'string' && !Number.isNaN(new Date(input.updatedAt).valueOf()) ? input.updatedAt : createdAt;

  return {
    ...base,
    id: cleanId(input.id),
    name: typeof input.name === 'string' && input.name.trim() ? input.name.trim().slice(0, 60) : 'Untitled plan',
    createdAt,
    updatedAt,
    profile: {
      role: VALID_ROLES.has(rawProfile.role) ? rawProfile.role : '',
      startYear,
      yearsEnrolled,
      programType,
      priorities
    },
    schools,
    compare: { aId, bId },
    career: { careerName, startSalary },
    projection: normalizeProjection(input.projection)
  };
}

migrateLegacyStorage();

const storedCurrent = readStorage(CURRENT_PLAN_KEY, null);
let plan = storedCurrent ? normalizePlan(storedCurrent) : freshPlan('Untitled plan', { applyDefaults: true });
let savedPlans = readStorage(SAVED_PLANS_KEY, []);
if (!Array.isArray(savedPlans)) savedPlans = [];
savedPlans = savedPlans.filter(item => item && typeof item === 'object').map(normalizePlan).filter(hasMeaningfulPlanData);
let onboardingStep = 1;
let pendingDeletePlanId = '';
let toastTimer;
let selectedSchoolId = plan.schools[0]?.id || '';
let projectionSchoolId = plan.schools[0]?.id || '';
let collegeSearchTimer;
let collegeSearchToken = 0;
let lastCollegeSearchResults = [];
let costPersistTimer;

function hasMeaningfulPlanData(candidate) {
  const item = normalizePlan(candidate);
  return item.name !== 'Untitled plan'
    || Boolean(item.profile.role || item.profile.startYear || item.profile.yearsEnrolled || item.profile.programType || item.profile.priorities.length)
    || item.schools.length > 0
    || Boolean(item.career.careerName || item.career.startSalary !== '');
}

function ensureCompareSelection() {
  const ids = plan.schools.map(school => school.id);
  let aId = ids.includes(plan.compare?.aId) ? plan.compare.aId : (ids[0] || '');
  let bId = ids.includes(plan.compare?.bId) && plan.compare.bId !== aId ? plan.compare.bId : '';
  if (!bId) bId = ids.find(id => id !== aId) || '';
  if (!aId && bId) aId = ids.find(id => id !== bId) || '';
  plan.compare = { aId, bId };
}

function markSaving() {
  const status = $('#saveStatus');
  if (!status) return;
  status.classList.add('is-saving');
  status.innerHTML = '<i></i>Saving…';
}

function markSaved() {
  const status = $('#saveStatus');
  if (!status) return;
  requestAnimationFrame(() => {
    status.classList.remove('is-saving', 'is-error');
    status.innerHTML = '<i></i>Saved locally';
  });
}

function markSaveFailed() {
  const status = $('#saveStatus');
  if (!status) return;
  requestAnimationFrame(() => {
    status.classList.remove('is-saving');
    status.classList.add('is-error');
    status.innerHTML = '<i></i>Local save unavailable';
  });
}

function archivePlan(planToArchive) {
  if (!hasMeaningfulPlanData(planToArchive)) return true;
  const snapshot = normalizePlan(JSON.parse(JSON.stringify(planToArchive)));
  const existingIndex = savedPlans.findIndex(item => item.id === snapshot.id);
  if (existingIndex >= 0) savedPlans[existingIndex] = snapshot;
  else savedPlans.unshift(snapshot);
  savedPlans = savedPlans.slice(0, 20);
  return writeStorage(SAVED_PLANS_KEY, savedPlans);
}

function persistPlan({ archive = false } = {}) {
  markSaving();
  ensureCompareSelection();
  plan.updatedAt = nowIso();
  const currentSaved = writeStorage(CURRENT_PLAN_KEY, plan);
  const archiveSaved = archive ? archivePlan(plan) : true;
  renderAll();
  const saved = currentSaved && archiveSaved;
  if (saved) markSaved();
  else {
    markSaveFailed();
    showToast('This browser could not save the latest local change.');
  }
  return saved;
}

function showToast(message) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

function closeMobileRail() {
  const rail = $('#appRail');
  rail?.classList.remove('is-open');
  $('#mobileMenuButton')?.setAttribute('aria-expanded', 'false');
  syncMobileRailAccessibility();
}

function setRoute(route, { pushHash = false } = {}) {
  const validRoute = routeMeta[route] ? route : 'overview';
  $$('.workspace-view').forEach(view => {
    const active = view.dataset.view === validRoute;
    view.classList.toggle('is-active', active);
    view.setAttribute('aria-hidden', String(!active));
  });
  $$('[data-route]').forEach(link => {
    const active = link.dataset.route === validRoute;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  const [label, title] = routeMeta[validRoute];
  $('#workspaceSection').textContent = label;
  $('#workspaceTitle').textContent = title;
  document.title = `CollegeTab — ${label}`;

  if (pushHash && location.hash !== `#${validRoute}`) history.pushState(null, '', `#${validRoute}`);
  closeMobileRail();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('reduce-motion');
  window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
}

function budgetComplete(school) {
  const b = school?.scenario?.budget || {};
  const valuesReady=['food','housing','transportation','healthcare','entertainment','charity','misc'].every(key => Number.isFinite(b[key]) && b[key] >= 0);
  const stateAligned=!b.sourceState || !school?.scenario?.workState || b.sourceState===school.scenario.workState;
  return valuesReady && stateAligned;
}
function careerLoansComplete(school) {
  if (!school?.scenario?.startSalary && school?.scenario?.startSalary !== 0) return false;
  if (!school?.scenario?.workState) return false;
  const built = scenarioInputForSchool(school);
  const missing = window.CollegeTabFinancialEngine?.scenarioCompleteness?.(built.input)?.missing || [];
  return !missing.some(item => String(item).startsWith('college.') || String(item).startsWith('loan.') || String(item).startsWith('career.') || String(item).startsWith('ages.'));
}
function savingsComplete() {
  const p = plan.projection || {};
  const a = p.allocations || {};
  const total = ['k401','hsa','roth','brokerage','cash'].reduce((sum,key)=>sum+(Number(a[key])||0),0);
  return p.savingsConfirmed===true && Number.isFinite(p.emergencyMonths) && Number.isFinite(p.cashHysaRate) && Number.isFinite(p.investmentReturnRate) && Math.abs(total-100)<0.01 && !(a.k401>0 && p.k401Available===false) && !(a.hsa>0 && p.hsaCoverage==='none');
}
function readiness() {
  const profileDone = Boolean(plan.profile.role && plan.profile.startYear && plan.profile.yearsEnrolled);
  const schoolDone = plan.schools.some(school => { const m=calculateSchoolModel(school); return m.projectedCost != null && m.fundingInputsComplete; });
  const careerDone = plan.schools.some(careerLoansComplete);
  const budgetDone = plan.schools.some(school => careerLoansComplete(school) && budgetComplete(school));
  const savingsDone = savingsComplete();
  const compareDone = plan.schools.filter(school => calculateScenarioForSchool(school).result?.ready).length >= 2;
  const items = {
    profile:{done:profileDone,partial:false}, school:{done:schoolDone,partial:plan.schools.length>0&&!schoolDone},
    career:{done:careerDone,partial:plan.schools.some(s=>s.scenario?.startSalary!=null)&&!careerDone},
    budget:{done:budgetDone,partial:plan.schools.some(s=>Object.values(s.scenario?.budget||{}).some(Number.isFinite))&&!budgetDone},
    savings:{done:savingsDone,partial:false}, compare:{done:compareDone,partial:false}
  };
  const completeCount=Object.values(items).filter(x=>x.done).length;
  return {items,percent:Math.round(completeCount/6*100)};
}
function nextIncompleteRoute() {
  const state=readiness().items;
  if(!state.profile.done) return 'onboarding';
  if(!state.school.done) return 'colleges';
  if(!state.career.done) return 'projection';
  if(!state.budget.done) return 'budget';
  if(!state.savings.done) return 'savings';
  return 'compare';
}
function renderReadiness() {
  const state=readiness();
  $('#readinessPercent').textContent=`${state.percent}%`; $('#readinessBar').style.width=`${state.percent}%`;
  Object.entries(state.items).forEach(([key,item])=>{ const row=$(`[data-readiness="${key}"]`); if(!row)return; row.classList.toggle('is-done',item.done); row.classList.toggle('is-partial',item.partial); const status=$('em',row); status.textContent=item.done?'Complete':item.partial?'In progress':'Not started'; });
  const route=nextIncompleteRoute();
  const copy={
    onboarding:['Start with the basics.','Complete Step 01 once, then move straight into college cost.','Continue to Step 01'],
    colleges:['Price a college path.','Add a school and finish its sourced cost and funding inputs.','Continue to Step 02'],
    projection:['Set career + financing.','Choose the expected work state, starting salary and loan stack for a college path.','Continue to Step 03'],
    budget:['Build the monthly budget.','CollegeTab will preload a state-level monthly allowance that you can change category by category.','Continue to Step 04'],
    savings:['Choose the savings waterfall.','Set the emergency reserve and decide where surplus savings should go after it is full.','Continue to Step 05'],
    compare:['Compare completed paths.','Your setup is ready. Add a second complete path if you want a side-by-side decision.','Continue to Step 06']
  }[route];
  $('#nextActionTitle').textContent=copy[0]; $('#nextActionCopy').textContent=copy[1]; const button=$('#nextActionButton'); button.querySelector('span:first-child').textContent=copy[2]; button.dataset.routeButton=route;
  const hero=$('#heroContinueButton'); if(hero){ hero.dataset.routeButton=route; hero.querySelector('span:first-child').textContent=route==='compare'?'Review your plan':'Continue setup'; }
}

function renderPlanIdentity() {
  $('#railPlanName').textContent = plan.name;
  const nameInput = $('#planNameInput');
  if (nameInput && document.activeElement !== nameInput) nameInput.value = plan.name === 'Untitled plan' ? '' : plan.name;
  $('#metricColleges').textContent = plan.schools.length ? String(plan.schools.length) : '—';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function sourceValue(record, key) {
  const value = record?.costs?.[key]?.value;
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}


function selectedCostSources(school) {
  const record = school?.record;
  const residency = school?.cost?.residency === 'out_of_state' ? 'out_of_state' : 'in_state';
  const living = school?.cost?.living || 'oncampus';
  const tuitionKey = residency === 'out_of_state' ? 'tuitionFeesOutOfState' : 'tuitionFeesInState';
  const roomKey = living === 'oncampus' ? 'roomBoardOnCampus' : living === 'offcampus' ? 'roomBoardOffCampus' : null;
  const otherKey = living === 'oncampus' ? 'otherExpensesOnCampus' : living === 'offcampus' ? 'otherExpensesOffCampus' : 'otherExpensesWithFamily';

  const completeHistory = (record?.history || [])
    .slice()
    .sort((a, b) => Number(b.year) - Number(a.year))
    .find(entry => {
      if (!roomKey) return false;
      return [entry?.[tuitionKey]?.value, entry?.[roomKey]?.value, entry?.booksSupplies?.value, entry?.[otherKey]?.value]
        .every(value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0);
    });

  if (completeHistory) {
    return {
      tuitionFees: Number(completeHistory[tuitionKey].value),
      roomBoard: Number(completeHistory[roomKey].value),
      booksSupplies: Number(completeHistory.booksSupplies.value),
      otherCombined: Number(completeHistory[otherKey].value),
      tuitionSource: completeHistory[tuitionKey].source,
      roomSource: completeHistory[roomKey].source,
      booksSource: completeHistory.booksSupplies.source,
      otherSource: completeHistory[otherKey].source,
      tuitionKey,
      roomKey,
      otherKey,
      alignedAcademicYear: completeHistory.label,
      sourceMode: 'latest_complete_history'
    };
  }

  return {
    tuitionFees: sourceValue(record, tuitionKey),
    roomBoard: roomKey ? sourceValue(record, roomKey) : null,
    booksSupplies: sourceValue(record, 'booksSupplies'),
    otherCombined: sourceValue(record, otherKey),
    tuitionSource: record?.costs?.[tuitionKey]?.source || null,
    roomSource: roomKey ? record?.costs?.[roomKey]?.source || null : null,
    booksSource: record?.costs?.booksSupplies?.source || null,
    otherSource: record?.costs?.[otherKey]?.source || null,
    tuitionKey,
    roomKey,
    otherKey,
    alignedAcademicYear: '',
    sourceMode: 'latest_alias'
  };
}

function sourceAcademicStartYear(source) {
  const match = String(source?.academicYear || '').match(/^(20\d{2})-/);
  return match ? Number(match[1]) : null;
}

function historyAnnualCost(entry, school) {
  const residency = school?.cost?.residency === 'out_of_state' ? 'out_of_state' : 'in_state';
  const living = school?.cost?.living || 'oncampus';
  const tuition = entry?.[residency === 'out_of_state' ? 'tuitionFeesOutOfState' : 'tuitionFeesInState']?.value;
  const books = entry?.booksSupplies?.value;
  const room = living === 'oncampus' ? entry?.roomBoardOnCampus?.value : living === 'offcampus' ? entry?.roomBoardOffCampus?.value : null;
  const other = living === 'oncampus' ? entry?.otherExpensesOnCampus?.value : living === 'offcampus' ? entry?.otherExpensesOffCampus?.value : entry?.otherExpensesWithFamily?.value;
  const rawValues = [tuition, room, books, other];
  if (rawValues.some(value => value === null || value === undefined || value === '')) return null;
  const values = rawValues.map(value => Number(value));
  if (values.some(value => !Number.isFinite(value) || value < 0)) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

function historicalGrowthForSchool(school) {
  const observations = (school?.record?.history || [])
    .map(entry => ({ year: Number(entry.year), label: entry.label, value: historyAnnualCost(entry, school) }))
    .filter(item => Number.isInteger(item.year) && Number.isFinite(item.value) && item.value > 0)
    .sort((a, b) => a.year - b.year);
  const recent = observations.slice(-6);
  if (recent.length < 2) return { rate: null, period: '', observations: recent };
  const first = recent[0];
  const last = recent[recent.length - 1];
  const years = last.year - first.year;
  if (years <= 0 || first.value <= 0 || last.value <= 0) return { rate: null, period: '', observations: recent };
  const rate = window.CollegeTabCostMath?.cagr(first.value, last.value, years);
  if (!Number.isFinite(rate) || rate > 1) return { rate: null, period: '', observations: recent };
  return { rate, period: `${first.label} → ${last.label}`, observations: recent };
}

function calculateSchoolModel(school) {
  const source = selectedCostSources(school);
  const overrides = school?.cost?.overrides || {};
  const splitTuition = overrides.tuition != null && overrides.mandatoryFees != null;
  const splitOther = overrides.transportation != null && overrides.personalExpenses != null;
  const tuitionFees = splitTuition ? overrides.tuition + overrides.mandatoryFees : source.tuitionFees;
  const roomBoard = overrides.roomBoard != null ? overrides.roomBoard : source.roomBoard;
  const booksSupplies = overrides.booksSupplies != null ? overrides.booksSupplies : source.booksSupplies;
  const otherExpenses = splitOther ? overrides.transportation + overrides.personalExpenses : source.otherCombined;
  const components = [tuitionFees, roomBoard, booksSupplies, otherExpenses];
  const annualCost = window.CollegeTabCostMath?.sumComplete(components) ?? null;
  const complete = annualCost != null;
  const history = historicalGrowthForSchool(school);
  const growthRate = school?.cost?.growthRate != null ? school.cost.growthRate / 100 : history.rate;
  const years = Number(school?.cost?.years || plan.profile.yearsEnrolled || inferSchoolYears(school?.record) || 0);
  const validYears = Number.isInteger(years) && years >= 1 && years <= 8 ? years : 0;
  const hasCostOverride = splitTuition || overrides.roomBoard != null || overrides.booksSupplies != null || splitOther;
  const sourceYears = [source.tuitionSource, source.roomSource, source.booksSource, source.otherSource]
    .map(sourceAcademicStartYear)
    .filter(Number.isInteger);
  const sameKnownSourceYear = !hasCostOverride && sourceYears.length === 4 && new Set(sourceYears).size === 1;
  const startYear = Number(plan.profile.startYear);
  const projectionBaseYear = sameKnownSourceYear ? sourceYears[0] : CURRENT_YEAR;
  const projectionStartYear = Number.isInteger(startYear) ? startYear : projectionBaseYear;
  const projectedCost = annualCost != null && growthRate != null && validYears
    ? window.CollegeTabCostMath?.projectTotal({
        annualCost,
        annualGrowthRate: growthRate,
        baseYear: projectionBaseYear,
        startYear: projectionStartYear,
        attendanceYears: validYears
      }) ?? null
    : null;
  const grantsAnnual = overrides.grantsScholarships;
  const familyAnnual = overrides.familyContribution;
  const fundingInputsComplete = grantsAnnual != null && familyAnnual != null;
  const funding = validYears && fundingInputsComplete
    ? window.CollegeTabCostMath?.fundingTotal({ grantsAnnual, familyAnnual, attendanceYears: validYears }) ?? null
    : null;
  const borrowing = projectedCost != null && funding != null
    ? window.CollegeTabCostMath?.borrowingRequirement(projectedCost, funding) ?? null
    : null;
  return {
    source,
    splitTuition,
    splitOther,
    tuitionFees,
    roomBoard,
    booksSupplies,
    otherExpenses,
    annualCost,
    history,
    growthRate,
    validYears,
    projectionBaseYear,
    projectionStartYear,
    projectedCost,
    funding,
    borrowing,
    grantsAnnual,
    familyAnnual,
    fundingInputsComplete,
    hasCostOverride,
    sourceYearAligned: sameKnownSourceYear,
    complete
  };
}

function formatMoneyOrDash(value) {
  return Number.isFinite(value) ? money.format(Math.round(value)) : '—';
}

function sourceText(source) {
  if (!source) return 'Source unavailable';
  const bits = [source.provider, source.dataset, source.variable, source.academicYear].filter(Boolean);
  return bits.join(' · ');
}

function inferSchoolYears(record) {
  const degree = Number(record?.identity?.predominantDegreeCode);
  if (degree === 3) return '4';
  if (degree === 2) return '2';
  if (degree === 1) return '1';
  return '';
}

function renderSchoolList() {
  const shell = $('#schoolList');
  if (!shell) return;
  const count = plan.schools.length;
  $('#collegeCountLabel').textContent = `${count} ${count === 1 ? 'school' : 'schools'} added`;

  if (!count) {
    selectedSchoolId = '';
    shell.innerHTML = `
      <div class="school-empty">
        <div class="empty-graphic" aria-hidden="true"></div>
        <div><h3>NO SCHOOLS YET.</h3><p>Search the federal database above. CollegeTab stores the school by IPEDS UNITID so later data refreshes do not depend on matching a name.</p></div>
      </div>`;
    return;
  }

  if (!plan.schools.some(school => school.id === selectedSchoolId)) selectedSchoolId = plan.schools[0].id;

  shell.innerHTML = `<div class="school-items">${plan.schools.map((school, index) => {
    const model = calculateSchoolModel(school);
    const location = school.location || [school.record?.identity?.city, school.record?.identity?.state].filter(Boolean).join(', ') || 'Location unavailable';
    const dataReady = Boolean(Object.values(school.record?.costs || {}).some(item => item?.value != null) || school.record?.history?.length);
    return `
    <article class="school-item${school.id === selectedSchoolId ? ' is-selected' : ''}" data-school-id="${escapeHtml(school.id)}" data-select-school="${escapeHtml(school.id)}" tabindex="0" role="button" aria-pressed="${school.id === selectedSchoolId}">
      <span class="school-item__num">${String(index + 1).padStart(2, '0')}</span>
      <div><strong>${escapeHtml(school.name)}</strong><small class="school-item__location">${escapeHtml(location)}${school.unitId ? ` · UNITID ${escapeHtml(school.unitId)}` : ''}</small></div>
      <div class="school-item__cost"><b>${formatMoneyOrDash(model.annualCost)}</b><small>current annual</small></div>
      <span class="school-item__status${dataReady ? ' is-ready' : ''}">${dataReady ? 'COST DATA' : 'COST SOURCE NEEDED'}</span>
      <button class="school-remove" type="button" aria-label="Remove ${escapeHtml(school.name)}" data-remove-school="${escapeHtml(school.id)}">×</button>
    </article>`;
  }).join('')}</div>`;
}

function setFormValue(id, value, placeholder = '') {
  const input = document.getElementById(id);
  if (!input) return;
  input.placeholder = placeholder;
  if (document.activeElement !== input) input.value = value == null ? '' : String(value);
}

function renderSourceLedger(school, model) {
  const body = $('#sourceLedgerBody');
  if (!body) return;
  const record = school.record;
  const fields = [
    ['Canonical institution ID', { provider: 'IPEDS / NCES', variable: 'UNITID', academicYear: '', releaseDate: window.CollegeTabData?.DATASET_RELEASE_DATE, note: 'Stable institution key used by CollegeTab.' }, school.unitId || '—'],
    ['Tuition + required fees', model.source.tuitionSource, formatMoneyOrDash(model.source.tuitionFees)],
    ['Room + board', model.source.roomSource, formatMoneyOrDash(model.source.roomBoard)],
    ['Books + supplies', model.source.booksSource, formatMoneyOrDash(model.source.booksSupplies)],
    ['Other expenses', model.source.otherSource, formatMoneyOrDash(model.source.otherCombined)]
  ];
  body.className = 'source-ledger-body';
  body.innerHTML = fields.map(([label, source, value]) => `
    <div class="source-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(source ? sourceText(source) + (source.note ? ` — ${source.note}` : '') : 'No federal value is available for this selected context; use a verified school-published value or user override.')}</p>
      <time>${escapeHtml(source?.releaseDate || '—')}</time>
    </div>`).join('');
}

function renderCostOutputs(school = plan.schools.find(item => item.id === selectedSchoolId)) {
  if (!school) return;
  const model = calculateSchoolModel(school);
  $('#annualCostOutput').textContent = formatMoneyOrDash(model.annualCost);
  $('#annualCostNote').textContent = model.complete
    ? `${school.cost.residency === 'out_of_state' ? 'Out-of-state' : 'In-state'} · ${school.cost.living === 'oncampus' ? 'on campus' : school.cost.living === 'offcampus' ? 'off campus' : 'with family'}${model.hasCostOverride ? ' · includes user override(s), treated as current-year values' : model.source.alignedAcademicYear ? ` · latest complete federal year ${model.source.alignedAcademicYear}` : ' · latest available federal values'}.`
    : 'One or more selected cost components need a source or override.';
  $('#projectedCostOutput').textContent = formatMoneyOrDash(model.projectedCost);
  if (!model.validYears) $('#projectedCostNote').textContent = 'Choose expected years of attendance.';
  else if (model.growthRate == null) $('#projectedCostNote').textContent = 'Enter a growth rate or load enough historical observations.';
  else $('#projectedCostNote').textContent = `${model.validYears} year${model.validYears === 1 ? '' : 's'} · ${(model.growthRate * 100).toFixed(1)}% annual growth${plan.profile.startYear ? ` · starts ${plan.profile.startYear}` : ''}${model.sourceYearAligned ? ` · baseline ${model.projectionBaseYear}-${String(model.projectionBaseYear + 1).slice(-2)}` : ' · mixed/latest source vintages treated as current baseline'}.`;
  $('#fundingOutput').textContent = formatMoneyOrDash(model.funding);
  $('#fundingNote').textContent = model.fundingInputsComplete ? 'Annual gift aid + family contribution across the selected attendance period.' : 'Enter both values explicitly; use $0 when none is expected.';
  $('#borrowingOutput').textContent = formatMoneyOrDash(model.borrowing);
  $('#borrowingNote').textContent = model.borrowing == null
    ? 'Complete the cost projection first.'
    : 'Projected cost minus explicitly entered grants/scholarships and family contribution; loan interest is not included.';
  renderSourceLedger(school, model);
}

function renderCollegeCostWorkspace() {
  const workspace = $('#collegeCostWorkspace');
  if (!workspace) return;
  const school = plan.schools.find(item => item.id === selectedSchoolId);
  if (!school) {
    workspace.hidden = true;
    return;
  }
  workspace.hidden = false;
  const model = calculateSchoolModel(school);
  const record = school.record;
  const identity = record?.identity || {};
  $('#costWorkspaceHeading').textContent = school.name.toUpperCase();
  $('#costWorkspaceMeta').textContent = school.unitId ? `IPEDS UNITID ${school.unitId} · ${identity.ownership || school.ownership || 'OWNERSHIP UNAVAILABLE'}` : 'UNVERIFIED MANUAL RECORD';
  $('#costWorkspaceLocation').textContent = [identity.city, identity.state].filter(Boolean).join(', ') || school.location || 'Location unavailable';
  const dataStatus = $('#costDataStatus');
  const hasFederalCosts = Boolean(Object.values(record?.costs || {}).some(item => item?.value != null) || record?.history?.length);
  if (hasFederalCosts) {
    dataStatus.textContent = record?.historyError ? 'FEDERAL COSTS · HISTORY LIMITED' : 'FEDERAL COST DATA';
    dataStatus.className = `cost-data-status fl-status ${record?.historyError ? 'fl-status--warning' : 'fl-status--good'}`;
  } else {
    dataStatus.textContent = record?.unitId ? 'UNITID VERIFIED · COST SOURCE NEEDED' : 'SOURCE NEEDED';
    dataStatus.className = 'cost-data-status fl-status fl-status--danger';
  }

  $('#costResidency').value = school.cost.residency;
  $('#costLiving').value = school.cost.living;
  $('#costYears').value = school.cost.years || plan.profile.yearsEnrolled || inferSchoolYears(record) || '1';

  const inState = sourceValue(record, 'tuitionFeesInState');
  const outState = sourceValue(record, 'tuitionFeesOutOfState');
  const residencyDifference = inState != null && outState != null ? outState - inState : null;
  $('#residencyHelp').textContent = residencyDifference != null && residencyDifference !== 0
    ? `Federal reported difference: ${money.format(Math.abs(residencyDifference))} ${residencyDifference > 0 ? 'more for out-of-state' : 'less for out-of-state'}. Eligibility remains school-specific.`
    : 'No federal residency price difference is reported for this institution; eligibility rules can still vary.';

  $('#tuitionCombinedDisplay').textContent = formatMoneyOrDash(model.source.tuitionFees);
  $('#otherCombinedDisplay').textContent = formatMoneyOrDash(model.source.otherCombined);
  $('#tuitionCombinedSource').textContent = sourceText(model.source.tuitionSource);
  $('#otherCombinedSource').textContent = sourceText(model.source.otherSource);

  const overrides = school.cost.overrides;
  setFormValue('costTuition', overrides.tuition, 'Leave blank to use federal combined total');
  setFormValue('costMandatoryFees', overrides.mandatoryFees, 'Leave blank unless verified');
  setFormValue('costRoomBoard', overrides.roomBoard ?? model.source.roomBoard, model.source.roomBoard == null ? 'No federal value — enter override' : '');
  setFormValue('costBooks', overrides.booksSupplies ?? model.source.booksSupplies, model.source.booksSupplies == null ? 'No federal value — enter override' : '');
  setFormValue('costTransportation', overrides.transportation, 'Leave blank to preserve federal combined total');
  setFormValue('costPersonal', overrides.personalExpenses, 'Leave blank to preserve federal combined total');
  setFormValue('costGrants', overrides.grantsScholarships, '0');
  setFormValue('costFamily', overrides.familyContribution, '0');
  setFormValue('costGrowthRate', school.cost.growthRate, model.history.rate != null ? (model.history.rate * 100).toFixed(1) : 'Enter rate');

  $('#roomBoardSource').textContent = overrides.roomBoard != null ? 'USER OVERRIDE' : sourceText(model.source.roomSource);
  $('#booksSource').textContent = overrides.booksSupplies != null ? 'USER OVERRIDE' : sourceText(model.source.booksSource);
  $('[data-reset-cost="roomBoard"]').disabled = model.source.roomBoard == null;
  $('[data-reset-cost="booksSupplies"]').disabled = model.source.booksSupplies == null;

  $('#historicalGrowthDisplay').textContent = model.history.rate != null ? `${(model.history.rate * 100).toFixed(1)}% / YR` : '—';
  if (model.history.rate != null) $('#historicalGrowthPeriod').textContent = `${model.history.period} CAGR · ${model.history.observations.length} usable annual observations.`;
  else if (record?.historyError) $('#historicalGrowthPeriod').textContent = 'Historical federal data could not be loaded. Enter a projection growth-rate override to continue.';
  else if (record?.history?.length) $('#historicalGrowthPeriod').textContent = 'Not enough complete annual observations for the selected residency/living arrangement.';
  else $('#historicalGrowthPeriod').textContent = 'Loading annual IPEDS history…';

  renderCostOutputs(school);
}

function annualFundingNeedsForModel(model) {
  return Array.isArray(model?.rows) ? model.rows.map(row => ({
    academicYearIndex: row.academicYearIndex,
    calendarStartYear: row.calendarStartYear,
    netNeed: row.borrowedPrincipal
  })) : [];
}

function effectiveLoanRows(school, model) {
  const scenario = school?.scenario || normalizeScenario({});
  const needs = annualFundingNeedsForModel(model);
  if (!needs.length || !['dependent','independent','dependent_plus_denied'].includes(scenario.dependencyStatus)) return scenario.loanRows || [];
  if (Array.isArray(scenario.loanRows) && scenario.loanRows.length === needs.length) return scenario.loanRows;
  const suggested = window.CollegeTabLoanEngine?.suggestLoanPlan?.({
    annualFundingNeeds: needs,
    dependencyStatus: scenario.dependencyStatus,
    priorFederalStudentPrincipal: scenario.priorFederalStudentPrincipal || 0,
    priorFederalSubsidizedPrincipal: scenario.priorFederalSubsidizedPrincipal || 0
  });
  return suggested ? suggested.map(row => ({
    ...row,
    directApr: row.directApr * 100,
    parentPlusApr: row.parentPlusApr * 100,
    directFeeRate: row.directFeeRate * 100,
    parentPlusFeeRate: row.parentPlusFeeRate * 100
  })) : [];
}

function scenarioInputForSchool(school) {
  const model = calculateSchoolModel(school);
  const scenario = school?.scenario || normalizeScenario({});
  const shared = plan.projection || normalizeProjection({});
  const rows = effectiveLoanRows(school, model);
  return {
    model,
    input: {
      college: {
        annualCost: model.annualCost,
        annualGrowthRate: model.growthRate,
        baseYear: model.projectionBaseYear,
        startYear: model.projectionStartYear,
        attendanceYears: model.validYears || null,
        grantsAnnual: model.grantsAnnual,
        familyAnnual: model.familyAnnual
      },
      financing: {
        dependencyStatus: scenario.dependencyStatus,
        priorFederalStudentPrincipal: scenario.priorFederalStudentPrincipal,
        priorFederalSubsidizedPrincipal: scenario.priorFederalSubsidizedPrincipal,
        priorParentPlusPrincipal: scenario.priorParentPlusPrincipal,
        extraMonthlyPayment: scenario.extraMonthlyPayment,
        annualLoans: rows.map(row => ({
          academicYearIndex: row.academicYearIndex,
          calendarStartYear: row.calendarStartYear,
          subsidizedGross: row.subsidizedGross,
          unsubsidizedGross: row.unsubsidizedGross,
          parentPlusGross: row.parentPlusGross,
          privateGross: row.privateGross,
          directApr: row.directApr / 100,
          parentPlusApr: row.parentPlusApr / 100,
          directFeeRate: row.directFeeRate / 100,
          parentPlusFeeRate: row.parentPlusFeeRate / 100,
          privateApr: row.privateApr == null ? null : row.privateApr / 100,
          privateFeeRate: row.privateFeeRate == null ? null : row.privateFeeRate / 100
        })),
        privateTerms: {
          termMonths: scenario.privateTermYears * 12,
          graceMonths: scenario.privateGraceMonths,
          inSchoolPaymentMode: scenario.privateInSchoolPaymentMode,
          capitalizeAtRepayment: scenario.privateCapitalizeAtRepayment
        }
      },
      career: {
        startSalary: scenario.startSalary,
        salaryGrowthRate: shared.salaryGrowthRate / 100,
        workState: scenario.workState,
        filingStatus: shared.filingStatus,
        localIncomeTaxRate: scenario.localIncomeTaxRate / 100
      },
      expenses: { monthly: { ...scenario.budget } },
      economy: { inflationRate: shared.inflationRate / 100 },
      wealth: {
        employerContributionRate: shared.employerContributionRate / 100,
        investmentReturnRate: shared.investmentReturnRate / 100,
        emergencyMonths: shared.emergencyMonths,
        cashHysaRate: shared.cashHysaRate / 100,
        k401Available: shared.k401Available,
        hsaCoverage: shared.hsaCoverage,
        allocations: { ...shared.allocations },
        startingEmergencySavings: shared.startingEmergencySavings,
        startingCash: shared.startingCash,
        starting401k: shared.starting401k,
        startingHsa: shared.startingHsa,
        startingRoth: shared.startingRoth,
        startingBrokerage: shared.startingBrokerage,
        confirmed: shared.savingsConfirmed === true
      },
      ages: { graduationAge: shared.graduationAge, targetAge: shared.targetAge },
      taxPolicy: { indexRate: shared.inflationRate / 100 }
    }
  };
}

function calculateScenarioForSchool(school) {
  if (!school || !window.CollegeTabFinancialEngine?.projectScenario) return { result: null, model: null, input: null };
  const built = scenarioInputForSchool(school);
  return { ...built, result: window.CollegeTabFinancialEngine.projectScenario(built.input) };
}

const SCENARIO_MISSING_LABELS = {
  'college.annualCost': 'complete annual college cost',
  'college.annualGrowthRate': 'college cost-growth rate',
  'college.baseYear': 'college cost base year',
  'college.startYear': 'college start year',
  'college.attendanceYears': 'years of attendance',
  'college.grantsAnnual': 'grants / scholarships (enter $0 if none)',
  'college.familyAnnual': 'family contribution (enter $0 if none)',
  'loan.dependencyStatus': 'federal dependency status',
  'loan.priorFederalStudentPrincipal': 'prior federal student debt',
  'loan.priorFederalSubsidizedPrincipal': 'prior subsidized federal principal',
  'loan.priorParentPlusPrincipal': 'prior Parent PLUS borrowing for this student',
  'loan.existingLoanDetailsRequired': 'detailed terms for existing federal loans (prior balances cannot be safely blended)',
  'loan.annualLoans': 'annual federal/private loan plan',
  'loan.privateApr': 'private-loan APR',
  'loan.privateFeeRate': 'private-loan origination fee',
  'loan.privateTermMonths': 'private-loan repayment term',
  'loan.privateGraceMonths': 'private-loan grace period',
  'loan.privateInSchoolPaymentMode': 'private in-school payment choice',
  'loan.privateCapitalization': 'private interest-capitalization choice',
  'loan.directAggregateLimit': 'federal Direct aggregate limit',
  'loan.subsidizedAggregateLimit': 'subsidized aggregate limit',
  'loan.parentPlusAggregateLimit': 'Parent PLUS aggregate limit',
  'career.startSalary': 'starting salary',
  'career.salaryGrowthRate': 'salary-growth assumption',
  'career.workState': 'work state',
  'career.filingStatus': 'tax filing status',
  'expenses.monthly.food': 'monthly food allowance',
  'expenses.monthly.housing': 'monthly housing allowance',
  'expenses.monthly.transportation': 'monthly transportation allowance',
  'expenses.monthly.healthcare': 'monthly healthcare allowance',
  'expenses.monthly.entertainment': 'monthly entertainment allowance',
  'expenses.monthly.charity': 'monthly charity allowance',
  'expenses.monthly.misc': 'monthly miscellaneous allowance',
  'economy.inflationRate': 'inflation assumption',
  'wealth.cashHysaRate': 'cash / HYSA yield assumption',
  'wealth.k401Available': '401(k) availability',
  'wealth.hsaCoverage': 'HSA eligibility',
  'savings.confirmed': 'confirm savings preferences in Step 05',
  'savings.allocationTotal': 'savings allocations totaling 100%',
  'savings.k401Unavailable': 'remove 401(k) allocation or enable 401(k)',
  'savings.hsaIneligible': 'remove HSA allocation or choose HSA eligibility',
  'wealth.employerContributionRate': 'employer retirement contribution',
  'wealth.investmentReturnRate': 'investment-return assumption',
  'wealth.emergencyMonths': 'emergency-reserve target',
  'ages.graduationAge': 'graduation age',
  'ages.targetAge': 'target age',
  'ages.targetAge>graduationAge': 'target age after graduation age'
};

function scenarioMissingCopy(result, max = 5) {
  const items = (result?.missing || []).map(key => {
    if (SCENARIO_MISSING_LABELS[key]) return SCENARIO_MISSING_LABELS[key];
    const yearMatch = String(key).match(/^loan\.year(\d+)\.(.+)$/);
    if (yearMatch) {
      const labels = { directAnnualLimit: 'federal Direct annual limit exceeded', subsidizedAnnualLimit: 'subsidized annual limit exceeded', parentPlusAnnualLimit: 'Parent PLUS annual limit exceeded', parentPlusIndependent: 'Parent PLUS used for an independent student', directApr: 'Direct Loan APR', directFeeRate: 'Direct Loan origination fee', parentPlusApr: 'Parent PLUS APR', parentPlusFeeRate: 'Parent PLUS origination fee', privateApr: 'private-loan APR', privateFeeRate: 'private-loan origination fee (enter 0 if none)', unfunded: 'unfunded college cost remains', overfunded: 'loan plan exceeds the funding need' };
      return `year ${yearMatch[1]}: ${labels[yearMatch[2]] || yearMatch[2]}`;
    }
    return key;
  });
  if (!items.length) return 'Scenario inputs are incomplete.';
  const visible = items.slice(0, max);
  const remainder = items.length - visible.length;
  return `${visible.join(' · ')}${remainder > 0 ? ` · +${remainder} more` : ''}`;
}

function setMetric(id, value, formatter = formatMoneyOrDash) {
  const node = document.getElementById(id);
  if (node) node.textContent = value == null ? '—' : formatter(value);
}

function formatAge(value) {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function renderScenarioReadiness(node, school, bundle, side) {
  if (!node) return;
  if (!school) {
    node.className = 'scenario-readiness scenario-readiness--empty';
    node.innerHTML = '<span class="fl-mono">MODEL INCOMPLETE</span><strong>ADD A COLLEGE.</strong><small>Choose a college path before building this scenario.</small>';
    return;
  }
  if (bundle.result?.ready) {
    node.className = `scenario-readiness scenario-readiness--ready scenario-readiness--${side}`;
    node.innerHTML = `<span class="fl-mono">MODEL READY · ${escapeHtml(bundle.result.fingerprint)}</span><strong>${escapeHtml(school.name)}</strong><small>All required scenario inputs are present. Recalculates deterministically from the stored assumptions.</small><button type="button" data-edit-scenario="${escapeHtml(school.id)}">EDIT MODEL →</button>`;
  } else {
    node.className = 'scenario-readiness scenario-readiness--missing';
    node.innerHTML = `<span class="fl-mono">INPUTS REQUIRED</span><strong>${escapeHtml(school.name)}</strong><small>${escapeHtml(scenarioMissingCopy(bundle.result))}</small><button type="button" data-edit-scenario="${escapeHtml(school.id)}">COMPLETE MODEL →</button>`;
  }
}

function renderCompare() {
  ensureCompareSelection();
  const selectA = $('#compareSelectA');
  const selectB = $('#compareSelectB');
  const ids = plan.schools.map(school => school.id);

  function optionsFor(side) {
    if (!plan.schools.length) return '<option value="">Add a college first</option>';
    const selected = side === 'a' ? plan.compare.aId : plan.compare.bId;
    const other = side === 'a' ? plan.compare.bId : plan.compare.aId;
    const placeholder = side === 'b' && plan.schools.length < 2 ? '<option value="">Add another college</option>' : '';
    return `${placeholder}${plan.schools.map(school => {
      const disabled = plan.schools.length > 1 && school.id === other;
      return `<option value="${escapeHtml(school.id)}"${school.id === selected ? ' selected' : ''}${disabled ? ' disabled' : ''}>${escapeHtml(school.name)}</option>`;
    }).join('')}`;
  }

  if (selectA) { selectA.innerHTML = optionsFor('a'); selectA.disabled = ids.length === 0; }
  if (selectB) { selectB.innerHTML = optionsFor('b'); selectB.disabled = ids.length < 2; }

  const a = plan.schools.find(school => school.id === plan.compare.aId);
  const b = plan.schools.find(school => school.id === plan.compare.bId);
  const bundleA = calculateScenarioForSchool(a);
  const bundleB = calculateScenarioForSchool(b);
  const resultA = bundleA.result;
  const resultB = bundleB.result;

  const headA = $('#compareHeadA');
  const headB = $('#compareHeadB');
  if (headA) headA.innerHTML = `<b>${a ? escapeHtml(a.name) : 'School A'}</b><small>${resultA?.ready ? escapeHtml(resultA.fingerprint) : a ? 'Model inputs required' : 'Add a college'}</small>`;
  if (headB) headB.innerHTML = `<b>${b ? escapeHtml(b.name) : 'School B'}</b><small>${resultB?.ready ? escapeHtml(resultB.fingerprint) : b ? 'Model inputs required' : 'Add another college'}</small>`;
  renderScenarioReadiness($('#compareReadinessA'), a, bundleA, 'a');
  renderScenarioReadiness($('#compareReadinessB'), b, bundleB, 'b');

  const map = [
    ['compareTotalCost', r => r.college.totalCost, formatMoneyOrDash],
    ['compareDebt', r => r.college.graduationDebt, formatMoneyOrDash],
    ['compareFederalDebt', r => r.loan.student.federalDebtAtGraduation, formatMoneyOrDash],
    ['comparePrivateDebt', r => r.loan.student.privateDebtAtGraduation, formatMoneyOrDash],
    ['compareParentDebt', r => r.loan.parent.debtAtGraduation, formatMoneyOrDash],
    ['compareSalary', r => r.firstYear.salary, formatMoneyOrDash],
    ['compareTakeHome', r => r.firstYear.monthlyTakeHome, formatMoneyOrDash],
    ['compareLoanPayment', r => r.firstYear.monthlyLoanPayment, formatMoneyOrDash],
    ['compareDebtFree', r => r.debtFreeAge, formatAge],
    ['compareNetWorth', r => r.targetNetWorth, formatMoneyOrDash],
    ['compareFamilyOpportunity', r => r.familyContributionOpportunityCostAtTarget, formatMoneyOrDash]
  ];
  for (const [prefix, getter, formatter] of map) {
    setMetric(`${prefix}A`, resultA?.ready ? getter(resultA) : null, formatter);
    setMetric(`${prefix}B`, resultB?.ready ? getter(resultB) : null, formatter);
  }

  const targetAge = plan.projection?.targetAge || 40;
  $('#compareNetWorthLabel').textContent = `Net worth at age ${targetAge}`;
  $('#compareFamilyOpportunityLabel').textContent = `Family contribution future value at age ${targetAge}`;
  const verdict = $('#comparisonVerdict');
  if (verdict) {
    if (resultA?.ready && resultB?.ready) {
      const comparison = window.CollegeTabFinancialEngine.compareScenarios(resultA, resultB);
      const leader = comparison.wealthLeader === 'tie' ? null : comparison.wealthLeader === 'left' ? a : b;
      verdict.className = 'scenario-verdict scenario-verdict--ready';
      verdict.innerHTML = `<span class="fl-mono">MODELED NET-WORTH GAP AT AGE ${targetAge}</span><strong>${leader ? `${escapeHtml(leader.name)} LEADS BY ${formatMoneyOrDash(Math.abs(comparison.netWorthDelta))}` : 'MODELED NET WORTH IS EVEN'}</strong><small>That gap comes only from the inputs in these two models. Cost, debt, salary and cash-flow tradeoffs can point in different directions; CollegeTab does not convert them into an overall school ranking.</small>`;
    } else {
      verdict.className = 'scenario-verdict';
      verdict.innerHTML = '<span class="fl-mono">SCENARIO SIGNAL</span><strong>COMPLETE BOTH MODELS TO SEE THE LONG-RANGE DIFFERENCE.</strong><small>CollegeTab does not label a school “better.” It shows which assumptions drive cost, debt, take-home pay and modeled net worth.</small>';
    }
  }
}

function ensureProjectionSelection() {
  const ids = plan.schools.map(school => school.id);
  if (!ids.includes(projectionSchoolId)) projectionSchoolId = plan.compare?.aId && ids.includes(plan.compare.aId) ? plan.compare.aId : (ids[0] || '');
}

function stateOptions(selected = '') {
  const states = Object.entries(window.CollegeTabStateTaxData2026?.STATES || {})
    .sort((a, b) => a[1].name.localeCompare(b[1].name));
  return `<option value="">Choose state</option>${states.map(([code, item]) => `<option value="${escapeHtml(code)}"${code === selected ? ' selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}`;
}

function setFormElementValue(form, name, value) {
  const input = form?.elements?.[name];
  if (!input || document.activeElement === input) return;
  input.value = value == null ? '' : String(value);
}

function currentLoanRowsFromForm(form, fallbackRows = []) {
  const table = $('#loanPlanTable');
  if (!form || !table) return fallbackRows;
  const rowNodes = $$('[data-loan-year]', table);
  if (!rowNodes.length) return fallbackRows;
  const rates = new Map($$('[data-rate-year]', $('#loanRateTable')).map(node => [Number(node.dataset.rateYear), {
    directApr: nullableNumber($('[data-rate-field="directApr"]', node)?.value, 0, 100, 3) ?? 6.52,
    parentPlusApr: nullableNumber($('[data-rate-field="parentPlusApr"]', node)?.value, 0, 100, 3) ?? 9.07,
    directFeeRate: nullableNumber($('[data-rate-field="directFeeRate"]', node)?.value, 0, 25, 3) ?? 1.057,
    parentPlusFeeRate: nullableNumber($('[data-rate-field="parentPlusFeeRate"]', node)?.value, 0, 25, 3) ?? 4.228,
    privateApr: nullableNumber($('[data-rate-field="privateApr"]', node)?.value, 0, 100, 3),
    privateFeeRate: nullableNumber($('[data-rate-field="privateFeeRate"]', node)?.value, 0, 25, 3)
  }]));
  return rowNodes.map((node, index) => {
    const yearIndex = Number(node.dataset.loanYear) || index + 1;
    const prior = fallbackRows.find(row => Number(row.academicYearIndex) === yearIndex) || {};
    const rate = rates.get(yearIndex) || prior;
    return {
      academicYearIndex: yearIndex,
      calendarStartYear: Number(node.dataset.calendarYear) || prior.calendarStartYear || CURRENT_YEAR + index,
      subsidizedGross: nullableMoney($('[data-loan-field="subsidizedGross"]', node)?.value, 100000) ?? 0,
      unsubsidizedGross: nullableMoney($('[data-loan-field="unsubsidizedGross"]', node)?.value, 100000) ?? 0,
      parentPlusGross: nullableMoney($('[data-loan-field="parentPlusGross"]', node)?.value, 100000) ?? 0,
      privateGross: nullableMoney($('[data-loan-field="privateGross"]', node)?.value, 500000) ?? 0,
      directApr: rate.directApr ?? 6.52,
      parentPlusApr: rate.parentPlusApr ?? 9.07,
      directFeeRate: rate.directFeeRate ?? 1.057,
      parentPlusFeeRate: rate.parentPlusFeeRate ?? 4.228,
      privateApr: rate.privateApr ?? null,
      privateFeeRate: rate.privateFeeRate ?? null
    };
  });
}

function loanRowFundingStatus(row, need) {
  const Loan = window.CollegeTabLoanEngine;
  if (!Loan) return { delta: null, label: 'ENGINE UNAVAILABLE', className: 'is-warn' };
  if ((row.privateGross || 0) > 0.005 && (row.privateApr == null || row.privateFeeRate == null)) {
    return { delta: null, label: 'ENTER PRIVATE APR + FEE', className: 'is-warn' };
  }
  const directNet = Loan.netFromGross((row.subsidizedGross || 0) + (row.unsubsidizedGross || 0), (row.directFeeRate || 0) / 100) || 0;
  const plusNet = Loan.netFromGross(row.parentPlusGross || 0, (row.parentPlusFeeRate || 0) / 100) || 0;
  const privateNet = Loan.netFromGross(row.privateGross || 0, ((row.privateFeeRate ?? 0) / 100)) || 0;
  const delta = (need?.netNeed || 0) - directNet - plusNet - privateNet;
  if (Math.abs(delta) <= 1) return { delta, label: 'FULLY FUNDED', className: 'is-good' };
  if (delta > 0) return { delta, label: `${money.format(delta)} UNFUNDED`, className: 'is-warn' };
  return { delta, label: `${money.format(Math.abs(delta))} OVER`, className: 'is-warn' };
}

function renderLoanPlanner(school, { preserveDomRows = false } = {}) {
  const table = $('#loanPlanTable');
  const rateShell = $('#loanRateTable');
  const status = $('#loanPlanStatus');
  const form = $('#projectionScenarioForm');
  if (!table || !rateShell || !status || !form) return;
  if (!school) {
    table.innerHTML = '<p class="loan-plan-empty">Choose a college to build its financing stack.</p>';
    rateShell.innerHTML = '';
    status.textContent = '';
    return;
  }
  const model = calculateSchoolModel(school);
  const needs = annualFundingNeedsForModel(model);
  const scenario = school.scenario || normalizeScenario({});
  if (!needs.length || model.borrowing == null) {
    table.innerHTML = '<p class="loan-plan-empty">Complete the college-cost workflow first. CollegeTab needs the annual funding gap before it can build loan tranches.</p>';
    rateShell.innerHTML = '';
    status.textContent = '';
    return;
  }
  if (model.borrowing <= 0.01) {
    table.innerHTML = '<p class="loan-plan-empty">This college path has no modeled borrowing requirement after grants and family contribution. No loan assumptions are required.</p>';
    rateShell.innerHTML = '';
    status.className = 'loan-plan-status is-good';
    status.textContent = 'NO STUDENT OR PARENT BORROWING REQUIRED UNDER THE CURRENT COLLEGE-COST INPUTS.';
    return;
  }
  const dependency = form.elements.dependencyStatus?.value || scenario.dependencyStatus;
  if (!['dependent','independent','dependent_plus_denied'].includes(dependency)) {
    table.innerHTML = '<p class="loan-plan-empty">Choose federal dependency status above. CollegeTab will then build a conservative federal-first starting plan you can override year by year.</p>';
    rateShell.innerHTML = '';
    status.className = 'loan-plan-status is-warn';
    status.textContent = 'DEPENDENCY STATUS IS REQUIRED BECAUSE FEDERAL DIRECT LOAN LIMITS DIFFER.';
    return;
  }
  const prior = nullableMoney(form.elements.priorFederalStudentPrincipal?.value, 1000000) ?? scenario.priorFederalStudentPrincipal ?? 0;
  const priorSubsidized = nullableMoney(form.elements.priorFederalSubsidizedPrincipal?.value, 1000000) ?? scenario.priorFederalSubsidizedPrincipal ?? 0;
  const priorParentPlus = nullableMoney(form.elements.priorParentPlusPrincipal?.value, 1000000) ?? scenario.priorParentPlusPrincipal ?? 0;
  const fallbackRows = effectiveLoanRows({ ...school, scenario: { ...scenario, dependencyStatus: dependency, priorFederalStudentPrincipal: prior, priorFederalSubsidizedPrincipal: priorSubsidized, priorParentPlusPrincipal: priorParentPlus } }, model);
  const rows = preserveDomRows ? currentLoanRowsFromForm(form, fallbackRows) : fallbackRows;
  table.innerHTML = `
    <div class="loan-plan-row loan-plan-row--head"><span>Year</span><span>Net need</span><span>Direct subsidized</span><span>Direct unsubsidized</span><span>Parent PLUS</span><span>Private</span><span>Status</span></div>
    ${rows.map((row, index) => {
      const need = needs[index] || { netNeed: 0 };
      const funding = loanRowFundingStatus(row, need);
      const limit = window.CollegeTabLoanEngine?.annualLimit?.(dependency, row.academicYearIndex);
      return `<div class="loan-plan-row" data-loan-year="${row.academicYearIndex}" data-calendar-year="${row.calendarStartYear}">
        <div class="loan-plan-cell"><span>YEAR ${row.academicYearIndex}</span><strong>${escapeHtml(String(row.calendarStartYear))}</strong></div>
        <div class="loan-plan-cell loan-plan-cell--need"><span>AFTER AID + FAMILY</span><strong>${formatMoneyOrDash(need.netNeed)}</strong></div>
        <label class="loan-plan-cell loan-plan-cell--sub"><span>MAX ${formatMoneyOrDash(limit?.subsidized)}</span><input class="fl-input" data-loan-field="subsidizedGross" aria-label="Year ${row.academicYearIndex} Direct Subsidized gross loan" type="number" min="0" max="100000" step="50" value="${row.subsidizedGross || 0}"></label>
        <label class="loan-plan-cell loan-plan-cell--unsub"><span>DIRECT TOTAL MAX ${formatMoneyOrDash(limit?.combined)}</span><input class="fl-input" data-loan-field="unsubsidizedGross" aria-label="Year ${row.academicYearIndex} Direct Unsubsidized gross loan" type="number" min="0" max="100000" step="50" value="${row.unsubsidizedGross || 0}"></label>
        <label class="loan-plan-cell loan-plan-cell--plus"><span>${dependency === 'dependent' ? 'PARENT DEBT' : 'NOT AVAILABLE'}</span><input class="fl-input" data-loan-field="parentPlusGross" aria-label="Year ${row.academicYearIndex} Parent PLUS gross loan" type="number" min="0" max="20000" step="50" value="${row.parentPlusGross || 0}" ${dependency !== 'dependent' ? 'disabled' : ''}></label>
        <label class="loan-plan-cell loan-plan-cell--private"><span>STUDENT PRIVATE</span><input class="fl-input" data-loan-field="privateGross" aria-label="Year ${row.academicYearIndex} private gross loan" type="number" min="0" max="500000" step="50" value="${Math.round((row.privateGross || 0) * 100) / 100}"></label>
        <div class="loan-plan-cell loan-plan-cell--status ${funding.className}"><span>NET PROCEEDS</span><strong>${escapeHtml(funding.label)}</strong></div>
      </div>`;
    }).join('')}`;
  rateShell.innerHTML = `<div class="loan-rate-grid">
    <div class="loan-rate-row loan-rate-row--head"><span>Year</span><span>Direct APR</span><span>Direct fee</span><span>Parent PLUS APR</span><span>PLUS fee</span><span>Private APR</span><span>Private fee</span><span>Source status</span></div>
    ${rows.map(row => `<div class="loan-rate-row" data-rate-year="${row.academicYearIndex}">
      <strong>YEAR ${row.academicYearIndex}</strong>
      <label><input class="fl-input" data-rate-field="directApr" aria-label="Year ${row.academicYearIndex} Direct Loan APR" type="number" min="0" max="100" step="0.01" value="${row.directApr}"></label>
      <label><input class="fl-input" data-rate-field="directFeeRate" aria-label="Year ${row.academicYearIndex} Direct Loan fee" type="number" min="0" max="25" step="0.001" value="${row.directFeeRate}"></label>
      <label><input class="fl-input" data-rate-field="parentPlusApr" aria-label="Year ${row.academicYearIndex} Parent PLUS APR" type="number" min="0" max="100" step="0.01" value="${row.parentPlusApr}"></label>
      <label><input class="fl-input" data-rate-field="parentPlusFeeRate" aria-label="Year ${row.academicYearIndex} Parent PLUS fee" type="number" min="0" max="25" step="0.001" value="${row.parentPlusFeeRate}"></label>
      <label><input class="fl-input" data-rate-field="privateApr" aria-label="Year ${row.academicYearIndex} private loan APR" type="number" min="0" max="100" step="0.01" placeholder="${row.privateGross > 0 ? 'Required' : '—'}" value="${row.privateApr ?? ''}"></label>
      <label><input class="fl-input" data-rate-field="privateFeeRate" aria-label="Year ${row.academicYearIndex} private loan fee" type="number" min="0" max="25" step="0.001" placeholder="${row.privateGross > 0 ? 'Enter 0 if none' : '—'}" value="${row.privateFeeRate ?? ''}"></label>
      <small>${row.calendarStartYear === 2026 ? 'Federal: current 2026–27 inputs' : 'Federal: 2026–27 proxy'} · ${row.privateGross > 0 ? 'Private: lender terms required' : 'Private: unused'}</small>
    </div>`).join('')}
  </div>`;

  const loanInputRows = rows.map(row => ({
    ...row,
    directApr: row.directApr / 100,
    parentPlusApr: row.parentPlusApr / 100,
    directFeeRate: row.directFeeRate / 100,
    parentPlusFeeRate: row.parentPlusFeeRate / 100,
    privateApr: row.privateApr == null ? null : row.privateApr / 100,
    privateFeeRate: row.privateFeeRate == null ? null : row.privateFeeRate / 100
  }));
  const check = window.CollegeTabLoanEngine?.validateLoanPlan?.({
    annualFundingNeeds: needs,
    dependencyStatus: dependency,
    priorFederalStudentPrincipal: prior,
    priorFederalSubsidizedPrincipal: priorSubsidized,
    priorParentPlusPrincipal: priorParentPlus,
    annualLoans: loanInputRows,
    privateTerms: {
      termMonths: (nullableNumber(form.elements.privateTermYears?.value, 1, 50, 0) ?? scenario.privateTermYears) * 12,
      graceMonths: nullableNumber(form.elements.privateGraceMonths?.value, 0, 60, 0) ?? scenario.privateGraceMonths,
      inSchoolPaymentMode: form.elements.privateInSchoolPaymentMode?.value || scenario.privateInSchoolPaymentMode,
      capitalizeAtRepayment: (form.elements.privateCapitalizeAtRepayment?.value || (scenario.privateCapitalizeAtRepayment ? 'yes' : 'no')) === 'yes'
    }
  });
  if (check?.ready) {
    const priorNeedsDetail = prior > 0.01 || priorParentPlus > 0.01;
    status.className = priorNeedsDetail ? 'loan-plan-status is-warn' : 'loan-plan-status is-good';
    status.textContent = priorNeedsDetail
      ? 'NEW BORROWING PASSES LIMIT CHECKS · DETAILED EXISTING-LOAN TERMS ARE REQUIRED BEFORE REPAYMENT / NET-WORTH PROJECTION.'
      : (check.warnings?.length ? `PLAN FUNDS EVERY YEAR · ${check.warnings.join(' ')}` : 'PLAN FUNDS EVERY MODELED YEAR AND PASSES CURRENT FEDERAL LIMIT CHECKS.');
  } else {
    status.className = 'loan-plan-status is-warn';
    status.textContent = scenarioMissingCopy({ missing: check?.errors || [] }, 10).toUpperCase();
  }
}

function fillProjectionForms(school) {
  const sharedForm = $('#projectionSharedForm');
  const scenarioForm = $('#projectionScenarioForm');
  const shared = plan.projection || normalizeProjection({});
  if (sharedForm) {
    for (const key of ['graduationAge','targetAge','filingStatus','salaryGrowthRate','inflationRate']) {
      setFormElementValue(sharedForm, key, shared[key]);
    }
  }
  if (scenarioForm) {
    const disabled = !school;
    $$('input, select, button', scenarioForm).forEach(node => { node.disabled = disabled; });
    const scenario = school?.scenario || normalizeScenario({});
    const stateSelect = scenarioForm.elements.workState;
    if (stateSelect && document.activeElement !== stateSelect) stateSelect.innerHTML = stateOptions(scenario.workState);
    setFormElementValue(scenarioForm, 'startSalary', scenario.startSalary);
    setFormElementValue(scenarioForm, 'localIncomeTaxRate', scenario.localIncomeTaxRate);
    setFormElementValue(scenarioForm, 'dependencyStatus', scenario.dependencyStatus);
    setFormElementValue(scenarioForm, 'priorFederalStudentPrincipal', scenario.priorFederalStudentPrincipal);
    setFormElementValue(scenarioForm, 'priorFederalSubsidizedPrincipal', scenario.priorFederalSubsidizedPrincipal);
    setFormElementValue(scenarioForm, 'priorParentPlusPrincipal', scenario.priorParentPlusPrincipal);
    setFormElementValue(scenarioForm, 'privateTermYears', scenario.privateTermYears);
    setFormElementValue(scenarioForm, 'privateGraceMonths', scenario.privateGraceMonths);
    setFormElementValue(scenarioForm, 'privateInSchoolPaymentMode', scenario.privateInSchoolPaymentMode);
    setFormElementValue(scenarioForm, 'privateCapitalizeAtRepayment', scenario.privateCapitalizeAtRepayment ? 'yes' : 'no');
    setFormElementValue(scenarioForm, 'extraMonthlyPayment', scenario.extraMonthlyPayment);
    renderLoanPlanner(school);
    const help = $('#projectionScenarioHelp');
    if (help) help.textContent = school
      ? `${school.name} keeps its own salary, work location, and annual federal/private loan stack.`
      : 'Choose a college above. Each school keeps its own salary, work location, and year-by-year loan stack.';
  }
}

function renderProjectionAudit(school, bundle) {
  const body = $('#projectionAuditBody');
  if (!body || !bundle.result?.ready) return;
  const result = bundle.result;
  const first = result.timeline[0];
  const retirementCapped = result.timeline.some(row => row.retirementDetail?.contributionCapped);
  const rows = result.timeline.map(row => `<tr><td>${escapeHtml(String(row.taxYear))}</td><td>${formatAge(row.ageEnd)}</td><td>${formatMoneyOrDash(row.salary)}</td><td>${formatMoneyOrDash(row.takeHome)}</td><td>${formatMoneyOrDash(row.loanPayments)}</td><td>${formatMoneyOrDash(row.loanBalance)}</td><td>${formatMoneyOrDash(row.netWorth)}</td></tr>`).join('');
  body.innerHTML = `
    <div class="audit-grid">
      <div><span class="fl-mono">ENGINE</span><strong>${escapeHtml(result.engineVersion)}</strong><small>${escapeHtml(result.fingerprint)}</small></div>
      <div><span class="fl-mono">FEDERAL TAX BASE</span><strong>2026 CURRENT LAW</strong><small>Future brackets + standard deduction use the model inflation rate as a current-law planning projection.</small></div>
      <div><span class="fl-mono">STATE TAX</span><strong>${escapeHtml(first?.taxDetail?.state?.stateName || school?.scenario?.workState || '—')}</strong><small>2026 wage-income planning baseline. Future thresholds are inflation-projected for comparison; local tax is only included when entered.</small></div>
      <div><span class="fl-mono">LOAN ENGINE</span><strong>${escapeHtml(result.loan?.engineVersion || 'TRANCHE MODEL')}</strong><small>Direct Subsidized, Direct Unsubsidized, private, and Parent PLUS are modeled as separate obligations.</small></div>
    </div>
    <div class="audit-formulas">
      <p><b>College inflation:</b> annual cost compounds by the selected college cost-growth rate from its projection base year.</p>
      <p><b>Loan disbursement timing:</b> each academic year's gross borrowing is modeled as two equal disbursements near the beginning of fall and spring terms. This is a planning convention until exact disbursement dates are available.</p>
      <p><b>Direct Subsidized:</b> no interest is charged in the model while the student is enrolled at least half-time or during the standard six-month grace period.</p>
      <p><b>Direct Unsubsidized:</b> interest begins with each modeled disbursement and continues through school and grace. Unpaid federal interest is tracked separately from principal unless a capitalization event is explicitly modeled.</p>
      <p><b>Private loans:</b> each academic-year private tranche uses its own entered lender APR and origination fee. The current scenario applies the entered private repayment term, in-school payment behavior, grace/deferment period, and capitalization setting across those tranches. Deferred private loans accrue interest during school; interest-only private loans report the in-school cash outflow instead of carrying that interest into graduation debt.</p>
      <p><b>Parent PLUS:</b> Parent PLUS is parent debt, not student debt. When used, CollegeTab assumes the parent requests in-school deferment plus six months after enrollment ends. Interest accrues during deferment and unpaid deferred interest is capitalized when modeled repayment begins.</p>
      <p><b>Repayment baseline:</b> new 2026+ federal Direct loans use the current-law Tiered Standard fixed-payment baseline. The repayment term is selected automatically from the borrower's modeled Direct principal balance: 10, 15, 20, or 25 years. Income-based RAP is not silently assumed.</p>
      <p><b>Origination fees:</b> Direct Loan, Parent PLUS, and entered private-loan fees reduce net proceeds delivered toward the college funding gap while the borrower still owes the gross amount borrowed. 2026–27 uses the current federal fee inputs; later first-disbursement fee schedules remain editable planning assumptions. A private tranche requires an explicit fee value, including 0% when the lender charges none.</p>
      <p><b>Federal rate years:</b> the 2026–27 federal interest rates are treated as exact for that award year. Later award-year rates are unknown and use the current rates only as editable planning proxies.</p>
      ${result.loan?.interest?.privateInterestPaidInSchool > 0 ? `<p class="audit-warning"><b>Private in-school cash outflow:</b> ${formatMoneyOrDash(result.loan.interest.privateInterestPaidInSchool)} of private-loan interest is modeled as paid before graduation. CollegeTab reports that cash outflow but does not guess whether the student or family paid it, so it is not silently deducted from either party's post-graduation assets.</p>` : ''}
      <p><b>Take-home:</b> gross wages − employee retirement contribution − modeled federal income tax − state/local income tax − FICA. Married-filing-jointly currently assumes the modeled salary is the household's only wage income.</p>
      <p><b>Retirement + wealth:</b> employee deferrals and the flat employer-contribution assumption are capped by modeled qualified-plan limits. Yearly surplus first covers any cash deficit, then fills the emergency reserve target, then enters taxable investments. Retirement and investments use the selected nominal return.</p>
      <p><b>Net worth:</b> retirement + taxable investments + emergency savings − cash deficit − remaining modeled student-loan balance.</p>
      <p><b>Family contribution opportunity cost:</b> each family contribution is grown from its modeled payment timing to the target age at the selected investment return. It is a counterfactual future value, not another cost charged by CollegeTab.</p>
      <p><b>Not included:</b> federal/state tax credits, itemized deductions, special deductions, spouse wages, investment tax drag, Social Security benefits, home equity/mortgage amortization, the Repayment Assistance Plan (RAP), forgiveness, temporary Auto Pay rate reductions, grandfathered federal-loan exceptions, exact lender variable-rate paths, or exact disbursement dates.</p>
      ${result.loan?.warnings?.length ? `<p class="audit-warning"><b>Loan-model warnings:</b> ${escapeHtml(result.loan.warnings.join(' '))}</p>` : ''}
      <p><b>Future-policy convention:</b> 2026 federal/state thresholds are projected with the model's policy index rate; the Social Security wage base uses that same proxy while the Additional Medicare threshold remains nominal under current law. These are scenario assumptions, not predictions of future legislation.</p>
      ${retirementCapped ? '<p class="audit-warning"><b>Retirement cap applied:</b> at least one modeled year requested contributions above the qualified-plan limits. CollegeTab used the capped contribution in taxes and net-worth calculations.</p>' : ''}
    </div>
    <details class="audit-input"><summary><span class="fl-mono">REPRODUCTION INPUT</span><strong>SHOW CANONICAL INPUT SNAPSHOT →</strong></summary><pre>${escapeHtml(JSON.stringify(result.input, null, 2))}</pre></details>
    <div class="audit-table-wrap"><table class="audit-table"><thead><tr><th>Tax year</th><th>Age</th><th>Salary</th><th>Take-home</th><th>Loan paid</th><th>Loan balance</th><th>Net worth</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderProjection() {
  ensureProjectionSelection();
  const select = $('#projectionSchoolSelect');
  if (select) {
    select.innerHTML = plan.schools.length
      ? plan.schools.map(school => `<option value="${escapeHtml(school.id)}"${school.id === projectionSchoolId ? ' selected' : ''}>${escapeHtml(school.name)}</option>`).join('')
      : '<option value="">Add a college first</option>';
    select.disabled = !plan.schools.length;
  }
  const school = plan.schools.find(item => item.id === projectionSchoolId);
  fillProjectionForms(school);
  const bundle = calculateScenarioForSchool(school);
  const result = bundle.result;
  const empty = $('#projectionEmpty');
  const ready = $('#projectionReady');
  if (!school || !result?.ready) {
    if (empty) empty.hidden = false;
    if (ready) ready.hidden = true;
    const copy = $('#projectionMissingCopy');
    if (copy) copy.textContent = !school
      ? 'Add a college, complete its cost workflow, then build the scenario assumptions.'
      : `Still needed: ${scenarioMissingCopy(result, 8)}.`;
    return;
  }
  if (empty) empty.hidden = true;
  if (ready) ready.hidden = false;
  $('#projectionSchoolName').textContent = school.name;
  $('#projectionFingerprint').textContent = result.fingerprint;
  $('#projectionNetWorthKicker').textContent = `Net worth at age ${result.targetAge}`;
  setMetric('projectionTotalCost', result.college.totalCost);
  setMetric('projectionDebt', result.college.graduationDebt);
  setMetric('projectionFederalDebt', result.loan.student.federalDebtAtGraduation);
  setMetric('projectionPrivateDebt', result.loan.student.privateDebtAtGraduation);
  setMetric('projectionParentDebt', result.loan.parent.debtAtGraduation);
  setMetric('projectionLoanFees', result.loan.fees.totalOriginationFees);
  const federalDebtNote = $('#projectionFederalDebtNote');
  if (federalDebtNote) federalDebtNote.textContent = `Subsidized principal ${formatMoneyOrDash(result.loan.student.subsidizedPrincipalBorrowed)} · Unsubsidized principal ${formatMoneyOrDash(result.loan.student.unsubsidizedPrincipalBorrowed)} · accrued unsub interest ${formatMoneyOrDash(result.loan.student.federalAccruedInterestAtGraduation)}.`;
  const privateDebtNote = $('#projectionPrivateDebtNote');
  if (privateDebtNote) privateDebtNote.textContent = `Private principal ${formatMoneyOrDash(result.loan.student.privatePrincipalBorrowed)} · unpaid interest at graduation ${formatMoneyOrDash(result.loan.student.privateAccruedInterestAtGraduation)}${result.loan.interest.privateInterestPaidInSchool > 0 ? ` · ${formatMoneyOrDash(result.loan.interest.privateInterestPaidInSchool)} interest paid while enrolled` : ''}.`;
  const parentDebtNote = $('#projectionParentDebtNote');
  if (parentDebtNote) parentDebtNote.textContent = result.loan.parent.principalBorrowed > 0 ? `At graduation. Modeled repayment-start balance after post-enrollment deferment: ${formatMoneyOrDash(result.loan.parent.debtAtRepaymentStart)}.` : 'No Parent PLUS modeled in this path.';
  setMetric('projectionTakeHome', result.firstYear.monthlyTakeHome);
  setMetric('projectionDebtFreeAge', result.debtFreeAge, formatAge);
  setMetric('projectionNetWorth', result.targetNetWorth);
  setMetric('projectionFamilyOpportunity', result.familyContributionOpportunityCostAtTarget);
  setMetric('projectionFederalTax', result.firstYear.federalTax);
  setMetric('projectionStateTax', result.firstYear.stateTax);
  setMetric('projectionFicaTax', result.firstYear.ficaTax);
  setMetric('projectionLoanPayment', result.firstYear.monthlyLoanPayment);
  renderProjectionAudit(school, bundle);
}

function renderSaved() {
  const shell = $('#savedList');
  if (!shell) return;
  const rows = [
    { ...plan, current: true },
    ...savedPlans.filter(item => item.id !== plan.id).map(normalizePlan)
  ];

  shell.innerHTML = rows.map(item => {
    const stamp = new Date(item.updatedAt || item.createdAt || Date.now());
    const when = Number.isNaN(stamp.valueOf()) ? 'Unknown date' : stamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const schoolCount = item.schools?.length || 0;
    const actions = item.current
      ? '<button type="button" data-route-button="overview">OPEN →</button>'
      : `<button type="button" data-load-plan="${escapeHtml(item.id)}">LOAD →</button><button class="saved-delete" type="button" data-delete-plan="${escapeHtml(item.id)}">DELETE</button>`;
    return `<article class="saved-item">
      <div><strong>${escapeHtml(item.name || 'Untitled plan')}</strong><small>${schoolCount} ${schoolCount === 1 ? 'school' : 'schools'} · Updated ${escapeHtml(when)}</small></div>
      <span>${item.current ? 'CURRENT' : 'LOCAL SAVE'}</span>
      <div class="saved-item__actions">${actions}</div>
    </article>`;
  }).join('');
}

function fillOnboardingFromPlan() {
  const form = $('#onboardingForm');
  if (!form) return;
  $$('input[name="role"]', form).forEach(input => { input.checked = input.value === plan.profile.role; });
  form.elements.startYear.value = plan.profile.startYear || '';
  form.elements.yearsEnrolled.value = plan.profile.yearsEnrolled || '';
  form.elements.programType.value = plan.profile.programType || '';
  $$('input[name="priorities"]', form).forEach(input => { input.checked = plan.profile.priorities.includes(input.value); });
  $('#planNameInput').value = plan.name === 'Untitled plan' ? '' : plan.name;
}


function scenarioSchoolOptions(selectedId) {
  return plan.schools.length ? plan.schools.map(s=>`<option value="${escapeHtml(s.id)}"${s.id===selectedId?' selected':''}>${escapeHtml(s.name)}</option>`).join('') : '<option value="">Add a college first</option>';
}
function budgetValuesFromForm(form) {
  return Object.fromEntries(['food','housing','transportation','healthcare','entertainment','charity','misc'].map(key=>[key, nullableMoney(form.elements[key].value,100000)]));
}
function updateBudgetTotal() {
  const form=$('#budgetForm'); if(!form)return;
  const vals=budgetValuesFromForm(form); const complete=Object.values(vals).every(Number.isFinite);
  $('#budgetMonthlyTotal').textContent=complete?formatMoneyOrDash(Object.values(vals).reduce((a,b)=>a+b,0)):'—';
}
function renderBudget() {
  ensureProjectionSelection();
  const select=$('#budgetSchoolSelect'); if(select){select.innerHTML=scenarioSchoolOptions(projectionSchoolId); select.disabled=!plan.schools.length;}
  const school=plan.schools.find(s=>s.id===projectionSchoolId); const form=$('#budgetForm'); if(!form)return;
  const scenario=school?.scenario||normalizeScenario({}); const preset=window.CollegeTabCostOfLiving2026?.monthlyPreset?.(scenario.workState);
  const hasSaved=budgetComplete(school); const values=hasSaved?scenario.budget:(preset?.categories||{});
  ['food','housing','transportation','healthcare','entertainment','charity','misc'].forEach(key=>setFormElementValue(form,key,values[key]));
  const stateName=window.CollegeTabStateTaxData2026?.STATES?.[scenario.workState]?.name;
  const title=$('#budgetPresetTitle'), source=$('#budgetPresetSource'), btn=$('#applyStateBudgetPreset');
  if(title) title.textContent=preset?`${stateName?.toUpperCase()||scenario.workState} · ${formatMoneyOrDash(preset.monthlyTotal)} / MONTH`:'SET A WORK STATE IN STEP 03';
  if(source) source.textContent=preset?`Planning preset: BLS 2024 one-person spending translated with Q1 2026 MERIC/C2ER ${stateName||scenario.workState} cost indices. Edit every amount.`:'CollegeTab needs the expected work state before it can create a geographic preset.';
  if(btn) btn.disabled=!preset;
  const msg=$('#budgetFormMessage'); if(msg) msg.textContent=hasSaved && scenario.budget.sourceState && scenario.budget.sourceState!==scenario.workState ? 'Your saved budget was created for a different work state. Review it or apply the new state preset.' : (hasSaved?'Saved custom monthly budget.':'State preset loaded as a starting point. Save it or edit it first.');
  updateBudgetTotal();
}
function allocationTotalFromForm(form) {
  return ['allocation401k','allocationHsa','allocationRoth','allocationBrokerage','allocationCash'].reduce((sum,key)=>sum+(Number(form.elements[key]?.value)||0),0);
}
function updateAllocationTotal() {
  const form=$('#savingsForm'); if(!form)return; const total=allocationTotalFromForm(form); const out=$('#allocationTotal'); if(out)out.textContent=`${Math.round(total*10)/10}%`; const err=$('#allocationError'); if(err)err.textContent=Math.abs(total-100)<0.01?'':`Allocation must total 100%. Current total: ${Math.round(total*10)/10}%.`;
}
function renderSavings() {
  ensureProjectionSelection();
  const select=$('#savingsSchoolSelect'); if(select){select.innerHTML=scenarioSchoolOptions(projectionSchoolId); select.disabled=!plan.schools.length;}
  const form=$('#savingsForm'); if(!form)return; const p=plan.projection||normalizeProjection({});
  for(const [name,value] of Object.entries({ emergencyMonths:p.emergencyMonths,cashHysaRate:p.cashHysaRate,employerContributionRate:p.employerContributionRate,investmentReturnRate:p.investmentReturnRate,hsaCoverage:p.hsaCoverage,allocation401k:p.allocations.k401,allocationHsa:p.allocations.hsa,allocationRoth:p.allocations.roth,allocationBrokerage:p.allocations.brokerage,allocationCash:p.allocations.cash,startingEmergencySavings:p.startingEmergencySavings,startingCash:p.startingCash,starting401k:p.starting401k,startingHsa:p.startingHsa,startingRoth:p.startingRoth,startingBrokerage:p.startingBrokerage })) setFormElementValue(form,name,value);
  if(document.activeElement!==form.elements.k401Available) form.elements.k401Available.checked=p.k401Available;
  updateAllocationTotal();
}

function renderAll() {
  renderPlanIdentity();
  renderReadiness();
  renderSchoolList();
  renderCollegeCostWorkspace();
  renderProjection();
  renderBudget();
  renderSavings();
  renderCompare();
  renderSaved();
  fillOnboardingFromPlan();
}

function setOnboardingStep(step) {
  onboardingStep = Math.max(1, Math.min(3, Number(step) || 1));
  $$('[data-onboarding-panel]').forEach(panel => panel.classList.toggle('is-active', Number(panel.dataset.onboardingPanel) === onboardingStep));
  $$('[data-onboarding-step]').forEach(button => {
    const active = Number(button.dataset.onboardingStep) === onboardingStep;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  $('#onboardingCounter').textContent = `${onboardingStep} / 3`;
  $('#onboardingBack').disabled = onboardingStep === 1;
  $('#onboardingNext').hidden = onboardingStep === 3;
  $('#onboardingFinish').hidden = onboardingStep !== 3;
}

function validateOnboardingStep(step) {
  const form = $('#onboardingForm');
  if (step === 1) {
    const role = form.querySelector('input[name="role"]:checked');
    if (!role) { showToast('Choose who the plan is for before continuing.'); return false; }
  }
  if (step === 2) {
    const year = Number(form.elements.startYear.value);
    const years = String(form.elements.yearsEnrolled.value || '');
    if (!Number.isInteger(year) || year < START_YEAR_MIN || year > START_YEAR_MAX) {
      showToast(`Enter a college start year from ${START_YEAR_MIN} through ${START_YEAR_MAX}.`);
      form.elements.startYear.focus();
      return false;
    }
    if (!VALID_YEARS.has(years)) { showToast('Choose the expected number of years enrolled.'); return false; }
  }
  return true;
}

function saveOnboarding() {
  const form = $('#onboardingForm');
  const data = new FormData(form);
  const role = String(data.get('role') || '');
  const planName = String(data.get('planName') || '').trim();
  const startYear = String(data.get('startYear') || '');
  const yearsEnrolled = String(data.get('yearsEnrolled') || '');
  const programType = String(data.get('programType') || '');
  const priorities = data.getAll('priorities').map(String).filter(value => VALID_PRIORITIES.has(value));

  plan.name = planName.slice(0, 60) || plan.name || 'Untitled plan';
  plan.profile = {
    role: VALID_ROLES.has(role) ? role : '',
    startYear,
    yearsEnrolled,
    programType: VALID_PROGRAMS.has(programType) ? programType : '',
    priorities: [...new Set(priorities)]
  };
  const saved = persistPlan({ archive: true });
  showToast(saved ? 'Plan setup saved locally.' : 'Setup updated for this session; local storage is unavailable.');
  setRoute('colleges', { pushHash: true });
}

function loadSettings() {
  const settings = readSettings();
  const form = $('#settingsForm');
  if (!form) return;
  form.elements.defaultRole.value = settings.defaultRole;
  form.elements.currency.value = 'USD';
  form.elements.reduceMotion.checked = settings.reduceMotion;
  document.body.classList.toggle('reduce-motion', settings.reduceMotion);
}

function setupYearBounds() {
  const input = $('#startYearInput');
  if (!input) return;
  input.min = String(START_YEAR_MIN);
  input.max = String(START_YEAR_MAX);
}

function openDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog?.showModal && !dialog.open) dialog.showModal();
}

function closeDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog?.open) dialog.close();
}

function syncMobileRailAccessibility() {
  const rail = $('#appRail');
  if (!rail) return;
  const mobile = matchMedia('(max-width: 820px)').matches;
  const open = rail.classList.contains('is-open');
  rail.inert = mobile && !open;
  if (mobile && !open) rail.setAttribute('aria-hidden', 'true');
  else rail.removeAttribute('aria-hidden');
}

function setCompareSide(side, value) {
  const validIds = new Set(plan.schools.map(school => school.id));
  if (!validIds.has(value)) return;
  if (side === 'a') {
    plan.compare.aId = value;
    if (plan.compare.bId === value) plan.compare.bId = plan.schools.find(school => school.id !== value)?.id || '';
  } else {
    plan.compare.bId = value;
    if (plan.compare.aId === value) plan.compare.aId = plan.schools.find(school => school.id !== value)?.id || '';
  }
  persistPlan({ archive: true });
}

// Route and plan interactions.
document.addEventListener('click', event => {
  const editScenario = event.target.closest('[data-edit-scenario]');
  if (editScenario) {
    const id = editScenario.dataset.editScenario;
    if (plan.schools.some(school => school.id === id)) projectionSchoolId = id;
    renderProjection();
    setRoute('projection', { pushHash: true });
    return;
  }

  const routeLink = event.target.closest('[data-route]');
  if (routeLink) {
    event.preventDefault();
    setRoute(routeLink.dataset.route, { pushHash: true });
    return;
  }

  const routeButton = event.target.closest('[data-route-button]');
  if (routeButton) {
    setRoute(routeButton.dataset.routeButton, { pushHash: true });
    return;
  }

  const removeSchool = event.target.closest('[data-remove-school]');
  if (removeSchool) {
    const id = removeSchool.dataset.removeSchool;
    const school = plan.schools.find(item => item.id === id);
    plan.schools = plan.schools.filter(item => item.id !== id);
    ensureCompareSelection();
    persistPlan({ archive: true });
    showToast(`${school?.name || 'College'} removed from this plan.`);
    return;
  }

  const loadButton = event.target.closest('[data-load-plan]');
  if (loadButton) {
    const target = savedPlans.find(item => item.id === loadButton.dataset.loadPlan);
    if (!target) return;
    archivePlan(plan);
    plan = normalizePlan(target);
    const saved = writeStorage(CURRENT_PLAN_KEY, plan);
    renderAll();
    if (saved) markSaved(); else markSaveFailed();
    showToast(saved ? 'Local plan loaded.' : 'Plan loaded for this session; local storage is unavailable.');
    setRoute('overview', { pushHash: true });
    return;
  }

  const deleteButton = event.target.closest('[data-delete-plan]');
  if (deleteButton) {
    const target = savedPlans.find(item => item.id === deleteButton.dataset.deletePlan && item.id !== plan.id);
    if (!target) return;
    pendingDeletePlanId = target.id;
    $('#deletePlanCopy').textContent = `“${target.name}” will be removed from saved plans in this browser. This cannot be undone in the prototype.`;
    openDialog('deletePlanDialog');
    return;
  }

  const closeButton = event.target.closest('[data-close-dialog]');
  if (closeButton) {
    closeDialog(closeButton.dataset.closeDialog);
    return;
  }

  if (event.target.closest('[data-new-plan]')) {
    $('#newPlanNameInput').value = '';
    openDialog('newPlanDialog');
  }
});

window.addEventListener('hashchange', () => setRoute(location.hash.slice(1) || 'overview'));
window.addEventListener('popstate', () => setRoute(location.hash.slice(1) || 'overview'));

$('#planNameButton')?.addEventListener('click', () => setRoute('saved', { pushHash: true }));
$('#mobileMenuButton')?.addEventListener('click', () => {
  const rail = $('#appRail');
  const open = !rail.classList.contains('is-open');
  rail.classList.toggle('is-open', open);
  $('#mobileMenuButton').setAttribute('aria-expanded', String(open));
  syncMobileRailAccessibility();
});

// Onboarding.
$$('[data-onboarding-step]').forEach(button => button.addEventListener('click', () => setOnboardingStep(button.dataset.onboardingStep)));
$('#onboardingBack')?.addEventListener('click', () => setOnboardingStep(onboardingStep - 1));
$('#onboardingNext')?.addEventListener('click', () => {
  if (validateOnboardingStep(onboardingStep)) setOnboardingStep(onboardingStep + 1);
});
$('#onboardingForm')?.addEventListener('submit', event => {
  event.preventDefault();
  if (!validateOnboardingStep(1) || !validateOnboardingStep(2)) return;
  saveOnboarding();
});

// College search + cost workflow.
function renderCollegeSearchResults(payload = { results: [], source: 'none' }, query = '') {
  const shell = $('#collegeSearchResults');
  const input = $('#collegeSearchInput');
  const state = $('#collegeSearchState');
  if (!shell || !input || !state) return;
  const results = Array.isArray(payload.results) ? payload.results : [];
  lastCollegeSearchResults = results;
  const cleanQuery = String(query || '').trim();
  input.setAttribute('aria-expanded', String(results.length > 0));

  if (cleanQuery.length < 2) {
    shell.classList.remove('is-visible');
    shell.innerHTML = '';
    state.textContent = '2+ characters';
    return;
  }
  shell.classList.add('is-visible');
  if (payload.loading) {
    shell.innerHTML = '<div class="college-search-message">Searching the federal college index…</div>';
    state.textContent = 'SEARCHING';
    return;
  }
  if (payload.error && !results.length) {
    shell.innerHTML = `<div class="college-search-message college-search-message--error"><strong>FEDERAL SEARCH UNAVAILABLE.</strong><span>${escapeHtml(payload.error?.message || String(payload.error))}</span><small>CollegeTab will not invent a college record. Check the connection or configure a production College Scorecard API key.</small></div>`;
    state.textContent = 'UNAVAILABLE';
    return;
  }
  if (!results.length) {
    shell.innerHTML = '<div class="college-search-message">No matching undergraduate institutions found.</div>';
    state.textContent = '0 RESULTS';
    return;
  }

  const sourceLabel = payload.source === 'local cache' ? 'LOCAL CACHE' : payload.source === 'IPEDS canonical directory' ? 'IPEDS DIRECTORY' : 'FEDERAL DATA';
  state.textContent = `${results.length} SHOWN · ${sourceLabel}`;
  shell.innerHTML = results.map((record, index) => {
    const identity = record.identity || {};
    const location = [identity.city, identity.state].filter(Boolean).join(', ') || 'Location unavailable';
    const alreadyAdded = plan.schools.some(school => school.unitId === record.unitId);
    const inState = sourceValue(record, 'tuitionFeesInState');
    const outState = sourceValue(record, 'tuitionFeesOutOfState');
    const price = inState ?? outState;
    return `<button class="college-search-result" type="button" role="option" data-search-result="${index}"${alreadyAdded ? ' disabled aria-disabled="true"' : ''}>
      <span class="college-search-result__id fl-mono">UNITID ${escapeHtml(record.unitId)}</span>
      <span class="college-search-result__main"><strong>${escapeHtml(identity.name || 'Unnamed institution')}</strong><small>${escapeHtml(location)} · ${escapeHtml(identity.ownership || 'Ownership unavailable')}</small></span>
      <span class="college-search-result__cost"><b>${formatMoneyOrDash(price)}</b><small>${price == null ? 'tuition + fees unavailable' : 'reported tuition + fees'}</small></span>
      <span class="college-search-result__action">${alreadyAdded ? 'ADDED' : 'ADD →'}</span>
    </button>`;
  }).join('');
}

async function runCollegeSearch(query) {
  const clean = String(query || '').trim().replace(/\s+/g, ' ');
  const token = ++collegeSearchToken;
  if (clean.length < 2) {
    renderCollegeSearchResults({ results: [] }, clean);
    return;
  }
  if (!window.CollegeTabData?.searchInstitutions) {
    renderCollegeSearchResults({ results: [], error: new Error('The college data module did not load.') }, clean);
    return;
  }
  renderCollegeSearchResults({ results: [], loading: true }, clean);
  try {
    const payload = await window.CollegeTabData.searchInstitutions(clean, { limit: 10 });
    const activeQuery = String($('#collegeSearchInput')?.value || '').trim().replace(/\s+/g, ' ');
    if (token !== collegeSearchToken || activeQuery !== clean) return;
    renderCollegeSearchResults(payload, clean);
  } catch (error) {
    if (token !== collegeSearchToken) return;
    renderCollegeSearchResults({ results: [], error }, clean);
  }
}

async function addCollegeRecord(record) {
  if (!record?.unitId) {
    showToast('CollegeTab will only add a school after resolving its IPEDS UNITID.');
    return;
  }
  if (plan.schools.some(school => school.unitId === record.unitId)) {
    showToast('That college is already in this plan.');
    return;
  }
  const inferredYears = plan.profile.yearsEnrolled || inferSchoolYears(record);
  const school = normalizeSchool({
    id: `ipeds-${record.unitId}`,
    unitId: record.unitId,
    name: record.identity?.name || `Institution ${record.unitId}`,
    location: [record.identity?.city, record.identity?.state].filter(Boolean).join(', '),
    ownership: record.identity?.ownership || '',
    record,
    cost: { years: inferredYears }
  });
  if (!school) return;
  plan.schools.push(school);
  selectedSchoolId = school.id;
  ensureCompareSelection();
  persistPlan({ archive: true });
  renderCollegeSearchResults({ results: lastCollegeSearchResults, source: 'College Scorecard API' }, $('#collegeSearchInput')?.value || '');
  showToast(`${school.name} added. Loading historical cost observations…`);

  let baseRecord = school.record;
  const hasCurrentCosts = Object.values(baseRecord?.costs || {}).some(item => item?.value != null);
  if (!hasCurrentCosts && window.CollegeTabData?.fetchInstitutionByUnitId) {
    try {
      const federalRecord = await window.CollegeTabData.fetchInstitutionByUnitId(school.unitId);
      if (federalRecord) {
        baseRecord = federalRecord;
        const current = plan.schools.find(item => item.id === school.id);
        if (!current) return;
        current.record = federalRecord;
        current.location = [federalRecord.identity?.city, federalRecord.identity?.state].filter(Boolean).join(', ') || current.location;
        current.ownership = federalRecord.identity?.ownership || current.ownership;
        persistPlan({ archive: true });
      }
    } catch { /* Keep the canonical IPEDS identity even when Scorecard has no matching cost record. */ }
  }

  if (window.CollegeTabData?.fetchInstitutionHistory) {
    const enriched = await window.CollegeTabData.fetchInstitutionHistory(baseRecord);
    const current = plan.schools.find(item => item.id === school.id);
    if (!current) return;
    current.record = enriched;
    persistPlan({ archive: true });
    const hasHistory = Boolean(enriched?.history?.length);
    showToast(enriched?.historyError || !hasHistory ? 'College added; some federal cost history is unavailable.' : 'College cost history loaded.');
  }
}

function updateSelectedSchoolCost(mutator, { archive = true } = {}) {
  const school = plan.schools.find(item => item.id === selectedSchoolId);
  if (!school) return;
  mutator(school);
  persistPlan({ archive });
}

$('#collegeSearchInput')?.addEventListener('input', event => {
  clearTimeout(collegeSearchTimer);
  const query = event.target.value;
  if (query.trim().length < 2) {
    ++collegeSearchToken;
    renderCollegeSearchResults({ results: [] }, query);
    return;
  }
  collegeSearchTimer = setTimeout(() => runCollegeSearch(query), 280);
});

$('#collegeSearchInput')?.addEventListener('keydown', event => {
  if (event.key !== 'ArrowDown') return;
  const first = $('#collegeSearchResults .college-search-result:not(:disabled)');
  if (first) { event.preventDefault(); first.focus(); }
});

$('#collegeSearchResults')?.addEventListener('click', event => {
  const button = event.target.closest('[data-search-result]');
  if (!button || button.disabled) return;
  const record = lastCollegeSearchResults[Number(button.dataset.searchResult)];
  if (record) addCollegeRecord(record);
});

$('#schoolList')?.addEventListener('click', event => {
  if (event.target.closest('[data-remove-school]')) return;
  const row = event.target.closest('[data-select-school]');
  if (!row) return;
  selectedSchoolId = row.dataset.selectSchool;
  renderSchoolList();
  renderCollegeCostWorkspace();
});

$('#schoolList')?.addEventListener('keydown', event => {
  if (!['Enter', ' '].includes(event.key) || event.target.closest('[data-remove-school]')) return;
  const row = event.target.closest('[data-select-school]');
  if (!row) return;
  event.preventDefault();
  selectedSchoolId = row.dataset.selectSchool;
  renderSchoolList();
  renderCollegeCostWorkspace();
});

$('#costResidency')?.addEventListener('change', event => updateSelectedSchoolCost(school => { school.cost.residency = event.target.value === 'out_of_state' ? 'out_of_state' : 'in_state'; }));
$('#costLiving')?.addEventListener('change', event => updateSelectedSchoolCost(school => { school.cost.living = ['oncampus', 'offcampus', 'withfamily'].includes(event.target.value) ? event.target.value : 'oncampus'; }));
$('#costYears')?.addEventListener('change', event => updateSelectedSchoolCost(school => { school.cost.years = VALID_YEARS.has(event.target.value) ? event.target.value : ''; }));

$('#collegeCostForm')?.addEventListener('input', event => {
  const school = plan.schools.find(item => item.id === selectedSchoolId);
  if (!school || !event.target.name) return;
  const name = event.target.name;
  if (name === 'growthRate') school.cost.growthRate = nullableRate(event.target.value);
  else if (Object.hasOwn(school.cost.overrides, name)) {
    const caps = { mandatoryFees: 100000, roomBoard: 150000, booksSupplies: 50000, transportation: 75000, personalExpenses: 75000 };
    school.cost.overrides[name] = nullableMoney(event.target.value, caps[name] || 250000);
  }
  renderCostOutputs(school);
  clearTimeout(costPersistTimer);
  costPersistTimer = setTimeout(() => {
    plan.updatedAt = nowIso();
    const currentSaved = writeStorage(CURRENT_PLAN_KEY, plan);
    const archiveSaved = archivePlan(plan);
    if (currentSaved && archiveSaved) markSaved(); else markSaveFailed();
    renderSchoolList();
  }, 450);
});

$('#collegeCostForm')?.addEventListener('change', () => {
  clearTimeout(costPersistTimer);
  persistPlan({ archive: true });
});

$('#collegeCostForm')?.addEventListener('click', event => {
  const reset = event.target.closest('[data-reset-cost]');
  if (!reset) return;
  const key = reset.dataset.resetCost;
  updateSelectedSchoolCost(school => { if (Object.hasOwn(school.cost.overrides, key)) school.cost.overrides[key] = null; });
});

$('#removeSelectedCollege')?.addEventListener('click', () => {
  const school = plan.schools.find(item => item.id === selectedSchoolId);
  if (!school) return;
  plan.schools = plan.schools.filter(item => item.id !== selectedSchoolId);
  selectedSchoolId = plan.schools[0]?.id || '';
  ensureCompareSelection();
  persistPlan({ archive: true });
  showToast(`${school.name} removed from this plan.`);
});

$('#compareSelectA')?.addEventListener('change', event => setCompareSide('a', event.target.value));
$('#compareSelectB')?.addEventListener('change', event => setCompareSide('b', event.target.value));

// Scenario engine inputs. The UI stores assumptions; all financial math stays in financial-engine.js.
$('#projectionSchoolSelect')?.addEventListener('change', event => {
  const id = event.target.value;
  if (plan.schools.some(school => school.id === id)) projectionSchoolId = id;
  renderProjection(); renderBudget(); renderSavings();
});

$('#projectionSharedForm')?.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const next = normalizeProjection({
    graduationAge: form.elements.graduationAge.value,
    targetAge: form.elements.targetAge.value,
    filingStatus: form.elements.filingStatus.value,
    ...plan.projection,
    salaryGrowthRate: form.elements.salaryGrowthRate.value,
    inflationRate: form.elements.inflationRate.value
  });
  if (next.graduationAge != null && next.targetAge <= next.graduationAge) {
    showToast('Target age must be later than graduation age.');
    form.elements.targetAge.focus();
    return;
  }
  plan.projection = next;
  const saved = persistPlan({ archive: true });
  showToast(saved ? 'Shared scenario assumptions saved and recalculated.' : 'Scenario updated for this session; local storage is unavailable.');
});

$('#projectionScenarioForm')?.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const school = plan.schools.find(item => item.id === projectionSchoolId);
  if (!school) { showToast('Choose a college scenario first.'); return; }
  const model = calculateSchoolModel(school);
  const fallbackRows = effectiveLoanRows(school, model);
  const loanRows = currentLoanRowsFromForm(form, fallbackRows);
  school.scenario = normalizeScenario({
    ...school.scenario,
    startSalary: form.elements.startSalary.value,
    workState: form.elements.workState.value,
    localIncomeTaxRate: form.elements.localIncomeTaxRate.value,
    dependencyStatus: form.elements.dependencyStatus.value,
    priorFederalStudentPrincipal: form.elements.priorFederalStudentPrincipal.value,
    priorFederalSubsidizedPrincipal: form.elements.priorFederalSubsidizedPrincipal.value,
    priorParentPlusPrincipal: form.elements.priorParentPlusPrincipal.value,
    privateTermYears: form.elements.privateTermYears.value,
    privateGraceMonths: form.elements.privateGraceMonths.value,
    privateInSchoolPaymentMode: form.elements.privateInSchoolPaymentMode.value,
    privateCapitalizeAtRepayment: form.elements.privateCapitalizeAtRepayment.value === 'yes',
    extraMonthlyPayment: form.elements.extraMonthlyPayment.value,
    loanRows
  });
  const saved = persistPlan({ archive: true });
  const bundle = calculateScenarioForSchool(plan.schools.find(item => item.id === projectionSchoolId));
  showToast(saved ? 'Career + loan assumptions saved.' : 'Career + loan assumptions updated for this session.');
  setRoute('budget', { pushHash: true });
});

$('#projectionScenarioForm')?.addEventListener('change', event => {
  const form = event.currentTarget;
  const school = plan.schools.find(item => item.id === projectionSchoolId);
  if (!school) return;
  const loanNames = new Set(['dependencyStatus','priorFederalStudentPrincipal','priorFederalSubsidizedPrincipal','priorParentPlusPrincipal','privateTermYears','privateGraceMonths','privateInSchoolPaymentMode','privateCapitalizeAtRepayment']);
  if (!loanNames.has(event.target?.name)) return;
  if (event.target.name === 'dependencyStatus') {
    school.scenario = normalizeScenario({ ...school.scenario, dependencyStatus: form.elements.dependencyStatus.value, loanRows: [] });
    renderLoanPlanner(school);
  } else {
    renderLoanPlanner(school, { preserveDomRows: true });
  }
});

$('#loanPlanTable')?.addEventListener('change', () => {
  const school = plan.schools.find(item => item.id === projectionSchoolId);
  if (school) renderLoanPlanner(school, { preserveDomRows: true });
});
$('#loanRateTable')?.addEventListener('change', () => {
  const school = plan.schools.find(item => item.id === projectionSchoolId);
  if (school) renderLoanPlanner(school, { preserveDomRows: true });
});
$('#resetLoanPlanButton')?.addEventListener('click', () => {
  const form = $('#projectionScenarioForm');
  const school = plan.schools.find(item => item.id === projectionSchoolId);
  if (!form || !school) return;
  const dependencyStatus = form.elements.dependencyStatus.value;
  if (!['dependent','independent','dependent_plus_denied'].includes(dependencyStatus)) { showToast('Choose federal dependency status first.'); return; }
  const model = calculateSchoolModel(school);
  const suggested = window.CollegeTabLoanEngine?.suggestLoanPlan?.({
    annualFundingNeeds: annualFundingNeedsForModel(model),
    dependencyStatus,
    priorFederalStudentPrincipal: nullableMoney(form.elements.priorFederalStudentPrincipal.value, 1000000) ?? 0,
    priorFederalSubsidizedPrincipal: nullableMoney(form.elements.priorFederalSubsidizedPrincipal.value, 1000000) ?? 0
  }) || [];
  school.scenario = normalizeScenario({ ...school.scenario, dependencyStatus, loanRows: suggested.map(row => ({ ...row, directApr: row.directApr * 100, parentPlusApr: row.parentPlusApr * 100, directFeeRate: row.directFeeRate * 100, parentPlusFeeRate: row.parentPlusFeeRate * 100 })) });
  renderLoanPlanner(school);
  showToast('Conservative federal-first loan plan restored. Subsidized eligibility remains $0 until you enter it.');
});

$('#editScenarioButton')?.addEventListener('click', () => {
  const id = plan.compare?.aId || plan.schools[0]?.id || '';
  if (id) projectionSchoolId = id;
  renderProjection();
  setRoute('projection', { pushHash: true });
});


$('#budgetSchoolSelect')?.addEventListener('change', event=>{ if(plan.schools.some(s=>s.id===event.target.value)) projectionSchoolId=event.target.value; renderBudget(); renderSavings(); renderProjection(); });
$('#savingsSchoolSelect')?.addEventListener('change', event=>{ if(plan.schools.some(s=>s.id===event.target.value)) projectionSchoolId=event.target.value; renderBudget(); renderSavings(); renderProjection(); });
$('#budgetForm')?.addEventListener('input', updateBudgetTotal);
$('#applyStateBudgetPreset')?.addEventListener('click', ()=>{ const school=plan.schools.find(s=>s.id===projectionSchoolId); const preset=window.CollegeTabCostOfLiving2026?.monthlyPreset?.(school?.scenario?.workState); const form=$('#budgetForm'); if(!preset||!form)return; Object.entries(preset.categories).forEach(([k,v])=>{if(form.elements[k])form.elements[k].value=v;}); updateBudgetTotal(); showToast('State monthly preset restored. Review it, then save.'); });
$('#budgetForm')?.addEventListener('submit', event=>{ event.preventDefault(); const form=event.currentTarget; if(!form.reportValidity())return; const school=plan.schools.find(s=>s.id===projectionSchoolId); if(!school){showToast('Choose a college path first.');return;} const budget=budgetValuesFromForm(form); if(!Object.values(budget).every(Number.isFinite)){showToast('Complete every monthly budget category, including explicit $0 values.');return;} school.scenario=normalizeScenario({...school.scenario,budget:{...budget,source:'custom-or-confirmed-preset',sourceState:school.scenario.workState}}); persistPlan({archive:true}); showToast('Monthly budget saved.'); setRoute('savings',{pushHash:true}); });
$('#savingsForm')?.addEventListener('input', updateAllocationTotal);
$('#savingsForm')?.addEventListener('change', updateAllocationTotal);
$('#savingsForm')?.addEventListener('submit', event=>{ event.preventDefault(); const form=event.currentTarget; if(!form.reportValidity())return; const total=allocationTotalFromForm(form); if(Math.abs(total-100)>0.01){showToast('Savings allocations must total 100%.');return;} if(!form.elements.k401Available.checked && Number(form.elements.allocation401k.value)>0){showToast('401(k) allocation must be 0% when no 401(k) is available.');return;} if(form.elements.hsaCoverage.value==='none' && Number(form.elements.allocationHsa.value)>0){showToast('HSA allocation must be 0% when the scenario is not HSA-eligible.');return;} plan.projection=normalizeProjection({...plan.projection,emergencyMonths:form.elements.emergencyMonths.value,cashHysaRate:form.elements.cashHysaRate.value,employerContributionRate:form.elements.employerContributionRate.value,investmentReturnRate:form.elements.investmentReturnRate.value,k401Available:form.elements.k401Available.checked,hsaCoverage:form.elements.hsaCoverage.value,allocations:{k401:form.elements.allocation401k.value,hsa:form.elements.allocationHsa.value,roth:form.elements.allocationRoth.value,brokerage:form.elements.allocationBrokerage.value,cash:form.elements.allocationCash.value},startingEmergencySavings:form.elements.startingEmergencySavings.value,startingCash:form.elements.startingCash.value,starting401k:form.elements.starting401k.value,startingHsa:form.elements.startingHsa.value,startingRoth:form.elements.startingRoth.value,startingBrokerage:form.elements.startingBrokerage.value,savingsConfirmed:true}); const saved=persistPlan({archive:true}); const result=calculateScenarioForSchool(plan.schools.find(s=>s.id===projectionSchoolId)).result; showToast(result?.ready?(saved?`Scenario calculated · ${result.fingerprint}`:'Scenario calculated for this session.'):`Saved. Still needed: ${scenarioMissingCopy(result,3)}.`); renderProjection(); setRoute('compare',{pushHash:true}); });
// Local prototype plan management.
$('#newPlanForm')?.addEventListener('submit', event => {
  event.preventDefault();
  archivePlan(plan);
  const name = $('#newPlanNameInput').value.trim().slice(0, 60);
  plan = freshPlan(name || 'Untitled plan', { applyDefaults: true });
  const saved = writeStorage(CURRENT_PLAN_KEY, plan);
  closeDialog('newPlanDialog');
  renderAll();
  if (saved) markSaved(); else markSaveFailed();
  setOnboardingStep(1);
  setRoute('onboarding', { pushHash: true });
  showToast(saved ? 'New local plan created.' : 'New plan created for this session; local storage is unavailable.');
});

$('#confirmDeletePlan')?.addEventListener('click', () => {
  if (!pendingDeletePlanId) return;
  const before = savedPlans.length;
  savedPlans = savedPlans.filter(item => item.id !== pendingDeletePlanId || item.id === plan.id);
  const removed = savedPlans.length < before;
  const saved = writeStorage(SAVED_PLANS_KEY, savedPlans);
  pendingDeletePlanId = '';
  closeDialog('deletePlanDialog');
  renderSaved();
  showToast(!removed ? 'That plan is no longer available.' : saved ? 'Saved local plan deleted.' : 'Plan removed for this session; local storage is unavailable.');
});

// Settings.
$('#settingsForm')?.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.currentTarget;
  const settings = {
    defaultRole: VALID_ROLES.has(form.elements.defaultRole.value) ? form.elements.defaultRole.value : '',
    currency: 'USD',
    reduceMotion: form.elements.reduceMotion.checked
  };
  const saved = writeStorage(SETTINGS_KEY, settings);
  document.body.classList.toggle('reduce-motion', settings.reduceMotion);
  showToast(saved ? 'Workspace preferences saved locally.' : 'This browser could not save workspace preferences.');
});

$('#signOutLink')?.addEventListener('click', () => {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* no-op */ }
});

$('#billingPrototypeButton')?.addEventListener('click', () => openDialog('billingDialog'));

// Close dialogs on backdrop click, preserving clicks inside the card.
$$('.fl-dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target === dialog) dialog.close();
}));

// Reactive background + restrained custom cursor.
const cursor = $('.cursor-dot');
window.addEventListener('pointermove', event => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('reduce-motion');
  if (!reduced) {
    document.documentElement.style.setProperty('--mx', `${(event.clientX / Math.max(innerWidth, 1)) * 100}%`);
    document.documentElement.style.setProperty('--my', `${(event.clientY / Math.max(innerHeight, 1)) * 100}%`);
  }
  if (cursor) {
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    cursor.classList.toggle('is-link', Boolean(event.target.closest('a, button, input, select, label')));
  }
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if ($('#appRail')?.classList.contains('is-open')) closeMobileRail();
});

const mobileMedia = matchMedia('(max-width: 820px)');
mobileMedia.addEventListener?.('change', syncMobileRailAccessibility);

// Initialize.
setupYearBounds();
ensureCompareSelection();
renderAll();
loadSettings();
setOnboardingStep(1);
syncMobileRailAccessibility();
setRoute(location.hash.slice(1) || 'overview');
