(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CollegeTabStateTaxData2026 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SOURCE = Object.freeze({
    taxYear: 2026,
    asOf: '2026-02-17',
    provider: 'Tax Foundation',
    dataset: 'State Individual Income Tax Rates and Brackets, 2026',
    basis: 'State statutes, forms, and instructions summarized by Tax Foundation',
    scope: 'Wage-income planning estimate. Local income taxes excluded unless the user supplies a local rate.',
    limitations: 'State credits, phaseouts, recapture provisions, special deductions, and non-wage income rules can differ from this baseline model.'
  });

  const b = (...pairs) => pairs.map(([threshold, rate]) => Object.freeze({ threshold, rate }));
  const none = (name, notes = '') => ({ name, type: 'none', retirementPretaxDeductible: true, single: b([0, 0]), joint: b([0, 0]), standardDeduction: { single: 0, joint: 0 }, exemption: { single: 0, joint: 0 }, credit: { single: 0, joint: 0 }, notes });
  const wage = (name, single, joint, standardSingle = 0, standardJoint = 0, exemptionSingle = 0, exemptionJoint = 0, creditSingle = 0, creditJoint = 0, notes = '') => ({
    name, type: 'wage', retirementPretaxDeductible: true, single, joint,
    standardDeduction: { single: standardSingle, joint: standardJoint },
    exemption: { single: exemptionSingle, joint: exemptionJoint },
    credit: { single: creditSingle, joint: creditJoint },
    notes
  });

  // Bracket thresholds are lower bounds. Example: [10000, .045] means income above $10,000 is taxed at 4.5%.
  // Personal amounts explicitly identified as credits by the source are modeled as credits; other dollar amounts are modeled as deductions.
  const STATES = {
    AL: wage('Alabama', b([0,.02],[500,.04],[3000,.05]), b([0,.02],[1000,.04],[6000,.05]), 3000,8500,1500,3000,0,0,'Alabama standard deduction is AGI-dependent; this baseline uses the published maximum amounts and can understate tax at higher AGI.'),
    AK: none('Alaska'),
    AZ: wage('Arizona', b([0,.025]), b([0,.025]), 8350,16700,0,0,0,0,'Arizona charitable-deduction adjustments and dependent credits are not modeled.'),
    AR: wage('Arkansas', b([0,.02],[4600,.039]), b([0,.02],[4600,.039]), 2470,4940,0,0,29,58,'Arkansas low-income tax tables and other credits are not modeled.'),
    CA: wage('California', b([0,.01],[11079,.02],[26264,.04],[41452,.06],[57542,.08],[72724,.093],[371479,.103],[445771,.113],[742953,.123],[1000000,.133]), b([0,.01],[22158,.02],[52528,.04],[82904,.06],[115084,.08],[145448,.093],[742958,.103],[891542,.113],[1000000,.123],[1485906,.133]), 5540,11080,0,0,153,306,'California exemption-credit phaseouts and the 1.3% State Disability Insurance payroll tax are not included in state income tax.'),
    CO: wage('Colorado', b([0,.044]), b([0,.044]), 16100,32200),
    CT: wage('Connecticut', b([0,.02],[10000,.045],[50000,.055],[100000,.06],[200000,.065],[250000,.069],[500000,.0699]), b([0,.02],[20000,.045],[100000,.055],[200000,.06],[400000,.065],[500000,.069],[1000000,.0699]), 0,0,15000,24000,0,0,'Connecticut personal-exemption phaseouts, 2% bracket phaseout, and tax-benefit recapture are not fully modeled; high-income estimates can differ materially.'),
    DE: wage('Delaware', b([0,0],[2000,.022],[5000,.039],[10000,.048],[20000,.052],[25000,.0555],[60000,.066]), b([0,0],[2000,.022],[5000,.039],[10000,.048],[20000,.052],[25000,.0555],[60000,.066]), 3250,6500,0,0,110,220),
    FL: none('Florida'),
    GA: wage('Georgia', b([0,.0519]), b([0,.0519]), 12000,24000),
    HI: wage('Hawaii', b([0,.014],[9600,.032],[14400,.055],[19200,.064],[24000,.068],[36000,.072],[48000,.076],[125000,.079],[175000,.0825],[225000,.09],[275000,.10],[325000,.11]), b([0,.014],[19200,.032],[28800,.055],[38400,.064],[48000,.068],[72000,.072],[96000,.076],[250000,.079],[350000,.0825],[450000,.09],[550000,.10],[650000,.11]), 4400,8800,1144,2288),
    ID: wage('Idaho', b([0,0],[4811,.053]), b([0,0],[9622,.053]), 16100,32200,0,0,0,0,'Published bracket widths reflected the latest amounts available to the 2026 source and may be revised for inflation.'),
    IL: wage('Illinois', b([0,.0495]), b([0,.0495]), 0,0,2925,5850),
    IN: wage('Indiana', b([0,.0295]), b([0,.0295]), 0,0,1000,2000,0,0,'County income taxes are excluded; enter a local rate separately if applicable.'),
    IA: wage('Iowa', b([0,.038]), b([0,.038]), 16100,32200,0,0,40,80,'Local school-district surtaxes are excluded.'),
    KS: wage('Kansas', b([0,.052],[23000,.0558]), b([0,.052],[46000,.0558]), 3605,8240,9160,18320),
    KY: wage('Kentucky', b([0,.035]), b([0,.035]), 3360,3360,0,0,0,0,'Local occupational taxes are excluded; enter a local rate separately if applicable.'),
    LA: wage('Louisiana', b([0,.03]), b([0,.03]), 12875,25750),
    ME: wage('Maine', b([0,.058],[27399,.0675],[64849,.0715]), b([0,.058],[54849,.0675],[129749,.0715]), 8350,16700,5300,10600,0,0,'Published bracket widths reflected the latest amounts available to the 2026 source and may be revised for inflation.'),
    MD: wage('Maryland', b([0,.02],[1000,.03],[2000,.04],[3000,.0475],[100000,.05],[125000,.0525],[150000,.055],[250000,.0575],[500000,.0625],[1000000,.065]), b([0,.02],[1000,.03],[2000,.04],[3000,.0475],[150000,.05],[175000,.0525],[225000,.055],[300000,.0575],[600000,.0625],[1200000,.065]), 3350,6700,3200,6400,0,0,'Maryland county income taxes are excluded and can be significant; enter a local rate separately.'),
    MA: wage('Massachusetts', b([0,.05],[1083150,.09]), b([0,.05],[1083150,.09]), 0,0,4400,8800),
    MI: wage('Michigan', b([0,.0425]), b([0,.0425]), 0,0,5900,11800,0,0,'City income taxes are excluded; enter a local rate separately if applicable.'),
    MN: wage('Minnesota', b([0,.0535],[33310,.068],[109430,.0785],[203150,.0985]), b([0,.0535],[48700,.068],[193480,.0785],[337930,.0985]), 15300,30600,0,0,0,0),
    MS: wage('Mississippi', b([0,0],[10000,.04]), b([0,0],[10000,.04]), 2300,4600,6000,12000),
    MO: wage('Missouri', b([0,0],[1348,.02],[2696,.025],[4044,.03],[5392,.035],[6740,.04],[8088,.045],[9436,.047]), b([0,0],[1348,.02],[2696,.025],[4044,.03],[5392,.035],[6740,.04],[8088,.045],[9436,.047]), 16100,32200,0,0,0,0,'Some Missouri local earnings taxes are excluded; enter a local rate separately if applicable.'),
    MT: wage('Montana', b([0,.047],[47500,.0565]), b([0,.047],[95000,.0565]), 16100,32200),
    NE: wage('Nebraska', b([0,.0246],[4130,.0351],[24760,.0455]), b([0,.0246],[8250,.0351],[49530,.0455]), 8850,17700,0,0,176,352),
    NV: none('Nevada'),
    NH: none('New Hampshire'),
    NJ: wage('New Jersey', b([0,.014],[20000,.0175],[35000,.035],[40000,.0553],[75000,.0637],[500000,.0897],[1000000,.1075]), b([0,.014],[20000,.0175],[50000,.0245],[70000,.035],[80000,.0553],[150000,.0637],[500000,.0897],[1000000,.1075]), 0,0,1000,2000),
    NM: wage('New Mexico', b([0,.015],[5500,.032],[16500,.043],[33500,.047],[66500,.049],[210000,.059]), b([0,.015],[8000,.032],[25000,.043],[50000,.047],[100000,.049],[315000,.059]), 16100,32200),
    NY: wage('New York', b([0,.039],[8500,.044],[11700,.0515],[13900,.054],[80650,.059],[215400,.0685],[1077550,.0965],[5000000,.103],[25000000,.109]), b([0,.039],[17150,.044],[23600,.0515],[27900,.054],[161550,.059],[323200,.0685],[2155350,.0965],[5000000,.103],[25000000,.109]), 8000,16050,0,0,0,0,'New York tax-benefit recapture and New York City/Yonkers income taxes are excluded; enter a local rate separately where applicable.'),
    NC: wage('North Carolina', b([0,.0399]), b([0,.0399]), 12750,25500),
    ND: wage('North Dakota', b([0,0],[48475,.0195],[244825,.025]), b([0,0],[80975,.0195],[298075,.025]), 16100,32200,0,0,0,0,'Published bracket widths reflected the latest amounts available to the 2026 source and may be revised for inflation.'),
    OH: wage('Ohio', b([0,0],[26050,.0275]), b([0,0],[26050,.0275]), 0,0,2400,4800,0,0,'Ohio municipal income taxes are excluded. Personal exemptions are restricted at higher MAGI; this baseline does not model the full phaseout.'),
    OK: wage('Oklahoma', b([0,0],[3750,.025],[4900,.035],[7200,.045]), b([0,0],[7500,.025],[9800,.035],[14400,.045]), 6350,12700,1000,2000),
    OR: wage('Oregon', b([0,.0475],[4550,.0675],[11400,.0875],[125000,.099]), b([0,.0475],[9100,.0675],[22800,.0875],[250000,.099]), 2910,5820,0,0,256,512,'Oregon local income taxes are excluded; enter a local rate separately if applicable.'),
    PA: wage('Pennsylvania', b([0,.0307]), b([0,.0307]), 0,0,0,0,0,0,'Pennsylvania local earned-income taxes are excluded; enter a local rate separately if applicable.'),
    RI: wage('Rhode Island', b([0,.0375],[82050,.0475],[186450,.0599]), b([0,.0375],[82050,.0475],[186450,.0599]), 11200,22400,5250,10500),
    SC: wage('South Carolina', b([0,0],[3640,.03],[18230,.06]), b([0,0],[3640,.03],[18230,.06]), 8350,16700),
    SD: none('South Dakota'),
    TN: none('Tennessee'),
    TX: none('Texas'),
    UT: wage('Utah', b([0,.045]), b([0,.045]), 0,0,0,0,966,1932,'Utah uses a taxpayer credit structure; this baseline applies the published credit but does not model every phaseout or add-back.'),
    VT: wage('Vermont', b([0,.0335],[49400,.066],[119700,.076],[249700,.0875]), b([0,.0335],[82500,.066],[199450,.076],[304000,.0875]), 7650,15300,5300,10600,0,0,'Published bracket widths reflected the latest amounts available to the 2026 source and may be revised for inflation.'),
    VA: wage('Virginia', b([0,.02],[3000,.03],[5000,.05],[17000,.0575]), b([0,.02],[3000,.03],[5000,.05],[17000,.0575]), 8750,17500,930,1860),
    WA: none('Washington','Washington does not tax wage income. Its capital-gains tax is outside this wage-only projection engine.'),
    WV: wage('West Virginia', b([0,.0222],[10000,.0296],[25000,.0333],[40000,.0444],[60000,.0482]), b([0,.0222],[10000,.0296],[25000,.0333],[40000,.0444],[60000,.0482]), 0,0,2000,4000),
    WI: wage('Wisconsin', b([0,.035],[15110,.044],[51950,.053],[332720,.0765]), b([0,.035],[20150,.044],[69260,.053],[443630,.0765]), 13960,25840,700,1400),
    WY: none('Wyoming'),
    DC: wage('District of Columbia', b([0,.04],[10000,.06],[40000,.065],[60000,.085],[250000,.0925],[500000,.0975],[1000000,.1075]), b([0,.04],[10000,.06],[40000,.065],[60000,.085],[250000,.0925],[500000,.0975],[1000000,.1075]), 16100,32200)
  };

  // Pennsylvania taxes employee contributions to 401(k) and similar salary-deferral retirement plans as compensation.
  STATES.PA.retirementPretaxDeductible = false;

  Object.values(STATES).forEach(state => Object.freeze(state));
  return Object.freeze({ SOURCE, STATES: Object.freeze(STATES) });
});
