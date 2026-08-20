const assert=require('assert');
const E=require('../financial-engine.js');
const L=require('../loan-engine.js');
const college={annualCost:10000,annualGrowthRate:0,baseYear:2026,startYear:2026,attendanceYears:1,grantsAnnual:10000,familyAnnual:0};
const input={
 college, financing:{dependencyStatus:'dependent',priorFederalStudentPrincipal:0,priorFederalSubsidizedPrincipal:0,priorParentPlusPrincipal:0,extraMonthlyPayment:0,annualLoans:[],privateTerms:{}},
 career:{startSalary:80000,salaryGrowthRate:0,workState:'TX',filingStatus:'single',localIncomeTaxRate:0},
 expenses:{monthly:{housing:1500,food:500,transportation:300,healthcare:200,entertainment:100,charity:50,misc:150},inflationRates:{housing:.10,food:.02,transportation:.03,healthcare:.04,entertainment:.20,charity:.20,misc:.05}},
 economy:{inflationRate:.05},
 wealth:{employerContributionRate:0,investmentReturnRate:.07,emergencyMonths:3,cashHysaRate:0,k401Available:true,hsaCoverage:'none',contributionRates:{k401:0,hsa:0,roth:0,brokerage:100},startingEmergencySavings:6450,startingCash:0,starting401k:0,startingHsa:0,startingRoth:0,startingBrokerage:0,confirmed:true},
 ages:{graduationAge:22,targetAge:25},taxPolicy:{indexRate:.025}
};
const r=E.projectScenario(input); assert.strictEqual(r.ready,true, String(r.missing));
// Essential = 1500+500+300+200+150 = 2650; target = 7950 in first year.
assert.strictEqual(r.timeline[0].emergencyTarget,7950);
assert.strictEqual(r.timeline[0].emergencyBalance,7950);
assert.ok(r.timeline[0].emergencyAdded>=1499.99,'first-year surplus fills emergency reserve first');
assert.ok(r.timeline[1].emergencyTarget>r.timeline[0].emergencyTarget,'inflation raises target');
assert.strictEqual(r.timeline[1].emergencyTarget,8503.5,'target uses independently inflated essential categories');
assert.ok(r.timeline[1].emergencyAdded>0,'future surplus tops up the inflation-adjusted target when HYSA growth is insufficient');
for(const row of r.timeline) assert.ok(row.emergencyBalance<=row.emergencyTarget+.01,'emergency HYSA capped at target');
const discretionaryFlat=JSON.parse(JSON.stringify(input));
discretionaryFlat.expenses.inflationRates.entertainment=0;
discretionaryFlat.expenses.inflationRates.charity=0;
const flat=E.projectScenario(discretionaryFlat); assert.strictEqual(flat.ready,true,String(flat.missing));
assert.strictEqual(flat.timeline[1].emergencyTarget,r.timeline[1].emergencyTarget,'entertainment and charity stay outside emergency target');
assert.ok(flat.timeline[1].monthlyBudget<r.timeline[1].monthlyBudget,'entertainment and charity still inflate in total spending');
console.log('PASS test-emergency-waterfall');
