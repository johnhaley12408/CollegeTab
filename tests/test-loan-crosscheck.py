from pathlib import Path
import json, subprocess, math

root=Path(__file__).resolve().parents[1]
node=r'''
const L=require(process.argv[1]);
const directNet=L.netFromGross(5500,L.FEDERAL_POLICY_2026.directFeeRate);
const need=directNet+4500;
const out=L.projectEducationLoans({
 annualFundingNeeds:[{academicYearIndex:1,calendarStartYear:2026,netNeed:need}], attendanceYears:1, dependencyStatus:'dependent',
 priorFederalStudentPrincipal:0, priorFederalSubsidizedPrincipal:0, priorParentPlusPrincipal:0,
 annualLoans:[{academicYearIndex:1,calendarStartYear:2026,subsidizedGross:3500,unsubsidizedGross:2000,parentPlusGross:0,privateGross:4500,directApr:.0652,parentPlusApr:.0907,directFeeRate:.01057,parentPlusFeeRate:.04228,privateApr:.10,privateFeeRate:0}],
 privateTerms:{termMonths:120,graceMonths:6,inSchoolPaymentMode:'deferred',capitalizeAtRepayment:true},
 extraMonthlyPayment:0
});
const plusGross=10000;
const plusOut=L.projectEducationLoans({
 annualFundingNeeds:[{academicYearIndex:1,calendarStartYear:2026,netNeed:L.netFromGross(plusGross,L.FEDERAL_POLICY_2026.parentPlusFeeRate)}], attendanceYears:1, dependencyStatus:'dependent',
 priorFederalStudentPrincipal:0,priorFederalSubsidizedPrincipal:0,priorParentPlusPrincipal:0,
 annualLoans:[{academicYearIndex:1,calendarStartYear:2026,subsidizedGross:0,unsubsidizedGross:0,parentPlusGross:plusGross,privateGross:0,directApr:.0652,parentPlusApr:.0907,directFeeRate:.01057,parentPlusFeeRate:.04228}],
 privateTerms:{},extraMonthlyPayment:0
});
console.log(JSON.stringify({directNet,annual:out.annual[0],student:out.student,tranches:out.tranches,plus:plusOut.parent,plusPolicy:plusOut.repaymentPolicy}));
'''
out=json.loads(subprocess.run(['node','-e',node,str(root/'loan-engine.js')],text=True,capture_output=True,check=True).stdout)

def near(a,b,tol=.02,label=''):
    if abs(a-b)>tol: raise AssertionError(f'{label}: expected {b}, got {a}')

# Independent fee check.
near(out['directNet'],round(5500*(1-.01057),2),.02,'Direct net proceeds')
# Independent two-disbursement simple-interest check for a one-year path.
# CollegeTab planning dates are month 0 and month 5, with graduation at month 8.
def school_interest(principal,apr):
    return round((principal/2)*apr*(8/12)+(principal/2)*apr*(3/12),2)
unsub_i=school_interest(2000,.0652)
priv_i=school_interest(4500,.10)
near(out['annual']['unsubsidizedInterestAtGraduation'],unsub_i,.01,'unsub in-school interest')
near(out['annual']['privateInterestAtGraduation'],priv_i,.01,'private in-school interest')
near(out['student']['federalDebtAtGraduation'],round(3500+2000+unsub_i,2),.01,'federal graduation debt')
near(out['student']['privateDebtAtGraduation'],round(4500+priv_i,2),.01,'private graduation debt')
# Subsidized tranche must remain at exactly zero accrued interest through school.
sub=[x for x in out['tranches'] if x['type']=='direct_subsidized'][0]
unsub=[x for x in out['tranches'] if x['type']=='direct_unsubsidized'][0]
near(sub['accruedInterestAtGraduation'],0,.001,'subsidized school interest')
assert unsub['accruedInterestAtGraduation']>0
# Independent Parent PLUS school + six-month deferment accrual; total debt is unchanged by capitalization at the instant it occurs.
plus_school=school_interest(10000,.0907)
plus_grace=round(10000*.0907*(6/12),2)
near(out['plus']['debtAtGraduation'],round(10000+plus_school,2),.02,'PLUS graduation debt')
near(out['plus']['debtAtRepaymentStart'],round(10000+plus_school+plus_grace,2),.02,'PLUS repayment-start debt')
assert out['plusPolicy']['parentPlusTermMonths']==120
print('PASS test-loan-crosscheck')
