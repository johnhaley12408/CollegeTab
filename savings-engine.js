(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CollegeTabSavingsEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '2026.08.20-v1';
  const POLICY_2026 = Object.freeze({
    year: 2026,
    k401: Object.freeze({ base: 24500, catchup50: 8000, catchup60to63: 11250 }),
    ira: Object.freeze({ base: 7500, catchup50: 1100, rothPhaseout: Object.freeze({ single:[153000,168000], married_joint:[242000,252000] }) }),
    hsa: Object.freeze({ self: 4400, family: 8750, catchup55: 1000 }),
    source: Object.freeze({
      provider: 'Internal Revenue Service',
      retirement: 'IR-2025-111 / Notice 2025-67',
      hsa: 'Rev. Proc. 2025-19'
    })
  });

  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const cents = v => finite(v) ? Math.round((v + Number.EPSILON) * 100) / 100 : null;
  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
  const scaleFor = (taxYear, indexRate) => Math.pow(1 + indexRate, Math.max(0, taxYear - 2026));

  function accountLimits({ taxYear=2026, age=22, filingStatus='single', magi=0, hsaCoverage='none', policyIndexRate=0.025 }={}) {
    const scale = scaleFor(taxYear, policyIndexRate);
    const kBase = POLICY_2026.k401.base * scale;
    const kCatch = age >= 60 && age <= 63 ? POLICY_2026.k401.catchup60to63 * scale : age >= 50 ? POLICY_2026.k401.catchup50 * scale : 0;
    const iraBase = POLICY_2026.ira.base * scale + (age >= 50 ? POLICY_2026.ira.catchup50 * scale : 0);
    const phase = POLICY_2026.ira.rothPhaseout[filingStatus] || POLICY_2026.ira.rothPhaseout.single;
    const low = phase[0] * scale, high = phase[1] * scale;
    let roth = iraBase;
    if (magi >= high) roth = 0;
    else if (magi > low) roth = iraBase * (high - magi) / (high - low);
    const hsaBase = hsaCoverage === 'family' ? POLICY_2026.hsa.family * scale : hsaCoverage === 'self' ? POLICY_2026.hsa.self * scale : 0;
    const hsa = hsaBase + (hsaBase > 0 && age >= 55 ? POLICY_2026.hsa.catchup55 * scale : 0);
    return Object.freeze({ k401: cents(kBase + kCatch), roth: cents(Math.max(0, roth)), hsa: cents(hsa), brokerage: Infinity, cash: Infinity });
  }

  function validatePreferences(prefs={}) {
    const keys = ['k401','hsa','roth','brokerage','cash'];
    const weights = {};
    let sum = 0;
    for (const key of keys) {
      const n = Number(prefs[key]);
      if (!finite(n) || n < 0 || n > 100) return Object.freeze({ ready:false, error:`savings.${key}` });
      weights[key] = n; sum += n;
    }
    if (Math.abs(sum - 100) > 0.01) return Object.freeze({ ready:false, error:'savings.allocationTotal', total:cents(sum) });
    return Object.freeze({ ready:true, weights:Object.freeze(weights), total:cents(sum) });
  }

  function allocate({ amount, preferences, limits, eligibility={} }={}) {
    if (!finite(amount) || amount < 0) return null;
    const valid = validatePreferences(preferences);
    if (!valid.ready) return valid;
    const eligible = {
      k401: eligibility.k401 !== false,
      hsa: eligibility.hsa === true,
      roth: eligibility.roth !== false,
      brokerage: true,
      cash: true
    };
    const out = { k401:0,hsa:0,roth:0,brokerage:0,cash:0 };
    let spill = 0;
    for (const key of Object.keys(out)) {
      const desired = amount * valid.weights[key] / 100;
      const cap = eligible[key] ? (limits?.[key] ?? Infinity) : 0;
      const actual = Math.min(desired, cap);
      out[key] = actual;
      spill += desired - actual;
    }
    // Legal/eligibility overflow goes to taxable brokerage first; if brokerage is explicitly disabled in a later model, cash is the final fallback.
    out.brokerage += spill;
    return Object.freeze({ ready:true, allocations:Object.freeze(Object.fromEntries(Object.entries(out).map(([k,v])=>[k,cents(v)]))), spillToBrokerage:cents(spill) });
  }

  function emergencyTarget({ monthlyEssentials, months }={}) {
    if (!finite(monthlyEssentials) || monthlyEssentials < 0 || !finite(months) || months < 0 || months > 24) return null;
    return cents(monthlyEssentials * months);
  }

  function growBalance(balance, rate) {
    if (!finite(balance) || balance < 0 || !finite(rate) || rate < -0.99 || rate > 10) return null;
    return cents(balance * (1 + rate));
  }

  return Object.freeze({ VERSION, POLICY_2026, accountLimits, validatePreferences, allocate, emergencyTarget, growBalance, cents });
});
