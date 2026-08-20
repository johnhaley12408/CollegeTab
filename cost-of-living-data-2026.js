(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CollegeTabCostOfLiving2026 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SOURCE = Object.freeze({
    asOf: '2026-Q1',
    geographyProvider: 'Missouri Economic Research and Information Center (MERIC) / C2ER',
    geographyDataset: 'Cost of Living — First Quarter 2026',
    dollarProvider: 'U.S. Bureau of Labor Statistics Consumer Expenditure Surveys',
    dollarDataset: '2024 One Person Consumer Unit — annual expenditures',
    method: 'BLS 2024 one-person national annual spending is first translated to Q1 2026 dollars using CPI-U, then converted to monthly dollars and adjusted with state category indices from MERIC/C2ER. This is a planning preset, not a personalized budget or city-level quote.',
    retrieved: '2026-08-20'
  });

  const INFLATION_SOURCE = Object.freeze({
    asOf: '2026-07',
    provider: 'U.S. Bureau of Labor Statistics',
    dataset: 'Consumer Price Index — July 2026, 12-month percent change',
    url: 'https://www.bls.gov/news.release/cpi.t01.htm',
    method: 'Current category CPI changes are used as editable annual planning proxies, not forecasts. Transportation uses transportation services; healthcare uses medical care services; charity and miscellaneous use all items less food and energy as a general fallback.',
    retrieved: '2026-08-20'
  });

  const INFLATION_RATES = Object.freeze({
    housing: 3.2,
    food: 3.0,
    transportation: 2.9,
    healthcare: 2.7,
    entertainment: 2.6,
    charity: 2.5,
    misc: 2.5
  });

  const CPI = Object.freeze({ annual2024: 313.689, q1_2026: (325.252 + 326.785 + 330.213) / 3 });
  const CPI_TO_Q1_2026 = CPI.q1_2026 / CPI.annual2024;

  const BASELINE_2024 = Object.freeze({
    food: 5644,
    shelter: 12954,
    housingUtilities: 2978,
    housingOther: 3120,
    transportation: 6953,
    healthcare: 4026,
    entertainment: 2187,
    charity: 2152,
    misc: 4452
  });

  // index,grocery,housing,utilities,transportation,health,misc
  const RAW = {
    OK:[83.5,93.5,66.9,94.5,83.7,98.1,88.8], AL:[85.0,95.0,67.7,96.9,88.8,85.6,91.8], MS:[86.2,93.2,71.0,94.4,89.8,85.1,93.7],
    KS:[87.6,95.3,77.5,97.4,88.0,90.6,90.1], WV:[87.9,96.2,71.3,90.4,99.5,89.5,94.9], IN:[88.3,97.9,73.0,95.2,95.7,91.5,93.5],
    IA:[88.6,96.6,75.6,88.6,93.7,94.3,94.5], MO:[88.6,94.7,76.1,92.4,86.5,98.0,95.2], TN:[88.9,95.8,80.3,84.5,87.2,88.7,95.0],
    AR:[89.1,93.4,77.2,98.3,88.8,85.8,95.7], NM:[89.9,96.0,83.2,80.0,89.5,101.9,94.0], GA:[90.6,96.9,77.6,98.6,96.3,99.6,94.3],
    TX:[90.7,95.9,77.7,104.0,90.9,96.8,95.6], ND:[90.7,94.1,77.2,86.4,96.7,107.7,98.3], LA:[91.1,95.4,83.3,82.3,94.4,91.6,97.3],
    NE:[91.3,99.5,78.1,92.1,87.4,105.6,97.9], SC:[91.9,98.6,79.8,95.1,94.6,97.6,97.3], KY:[92.5,101.4,78.1,87.8,95.8,92.4,101.6],
    MN:[93.4,98.8,79.5,95.4,93.6,111.5,100.0], WY:[93.7,98.9,86.5,92.4,87.7,97.0,99.3], OH:[93.7,98.9,86.3,100.9,92.7,96.5,96.0],
    MI:[93.9,100.1,85.7,98.0,98.5,88.2,97.0], SD:[94.1,97.6,88.2,85.4,100.1,104.1,96.9], IL:[95.1,99.2,84.7,102.6,97.0,103.0,98.9],
    PA:[96.2,99.0,84.1,108.4,104.2,95.1,100.5], NC:[96.6,100.8,91.7,94.3,92.3,108.4,99.2], WI:[97.4,100.9,96.6,96.0,89.8,105.3,97.7],
    VA:[99.1,99.3,99.1,99.5,98.0,96.9,99.6], UT:[100.6,98.6,110.8,84.4,96.2,89.9,99.2], FL:[100.7,105.7,101.1,94.6,99.5,101.4,99.8],
    NV:[100.7,103.8,110.5,81.3,115.6,105.4,91.1], ID:[101.7,103.4,105.1,73.4,101.0,101.6,105.3], DE:[101.7,103.6,101.3,97.5,99.6,101.6,102.9],
    CO:[101.8,100.9,107.4,88.7,89.1,103.9,103.5], MT:[105.9,102.4,113.2,80.2,103.9,106.3,108.0], AZ:[107.6,99.6,119.0,102.1,103.5,98.8,104.9],
    OR:[109.6,104.5,117.4,96.3,115.4,115.3,106.1], NH:[110.1,100.0,116.5,116.4,106.0,106.5,108.8], RI:[111.2,103.8,114.4,122.3,103.1,104.1,111.9],
    VT:[113.0,99.6,127.5,112.0,109.0,108.2,108.2], CT:[114.2,106.0,123.5,126.5,105.6,108.9,109.6], ME:[114.6,101.6,134.8,124.6,104.4,114.7,102.7],
    WA:[114.6,106.1,123.1,99.4,131.2,110.3,111.0], NJ:[118.8,109.1,144.3,110.3,103.8,115.8,107.0], MD:[121.1,109.3,149.1,113.2,106.3,106.9,109.5],
    NY:[124.7,100.3,172.3,102.2,111.5,108.9,104.9], AK:[129.0,126.6,132.4,148.4,123.8,130.7,123.1], DC:[134.3,109.2,190.4,107.8,105.8,118.7,112.4],
    CA:[140.5,110.5,189.5,134.6,142.0,111.1,116.0], MA:[147.8,106.8,217.5,143.9,108.5,131.8,118.3], HI:[184.8,136.3,302.4,183.5,149.0,113.1,122.7]
  };

  const round = value => Math.round(value);
  function monthlyPreset(state) {
    const row = RAW[String(state || '').toUpperCase()];
    if (!row) return null;
    const [index,grocery,housing,utilities,transportation,health,misc] = row;
    const annualHousing = (BASELINE_2024.shelter * CPI_TO_Q1_2026) * housing / 100 + (BASELINE_2024.housingUtilities * CPI_TO_Q1_2026) * utilities / 100 + (BASELINE_2024.housingOther * CPI_TO_Q1_2026) * misc / 100;
    const categories = {
      food: round((BASELINE_2024.food * CPI_TO_Q1_2026) * grocery / 100 / 12),
      housing: round(annualHousing / 12),
      transportation: round((BASELINE_2024.transportation * CPI_TO_Q1_2026) * transportation / 100 / 12),
      healthcare: round((BASELINE_2024.healthcare * CPI_TO_Q1_2026) * health / 100 / 12),
      entertainment: round((BASELINE_2024.entertainment * CPI_TO_Q1_2026) * misc / 100 / 12),
      charity: round((BASELINE_2024.charity * CPI_TO_Q1_2026) / 12),
      misc: round((BASELINE_2024.misc * CPI_TO_Q1_2026) * misc / 100 / 12)
    };
    return Object.freeze({ state: String(state).toUpperCase(), index, categories: Object.freeze(categories), monthlyTotal: Object.values(categories).reduce((a,b)=>a+b,0), source: SOURCE });
  }

  function inflationPreset() {
    return Object.freeze({ rates: INFLATION_RATES, source: INFLATION_SOURCE });
  }

  return Object.freeze({ SOURCE, INFLATION_SOURCE, INFLATION_RATES, CPI, CPI_TO_Q1_2026, BASELINE_2024, INDEX: Object.freeze(RAW), monthlyPreset, inflationPreset });
});
