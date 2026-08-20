from pathlib import Path
import json, math, subprocess, sys

root = Path(__file__).resolve().parents[1]
node_program = r'''
const E=require(process.argv[1]);
const out={
 payments:[
  E.monthlyPayment(10000,0.06,120),
  E.monthlyPayment(50000,0.08,60),
  E.monthlyPayment(12345,0,37)
 ],
 federal:[0,20000,74000,150000,700000].map(w=>E.federalIncomeTax({grossWages:w,filingStatus:'single',taxYear:2026}).tax),
 salary:E.projectSalary({startSalary:70000,annualGrowthRate:0.03,years:7}),
 fv:E.futureValueLumpSum(15000,0.07,12),
 college:E.projectCollegeFinancing({annualCost:28000,annualGrowthRate:0.04,baseYear:2026,startYear:2028,attendanceYears:4,grantsAnnual:8000,familyAnnual:4000,loanApr:0.065,interestAccruesInSchool:true,graceMonths:6}),
 retirement:E.retirementContribution({grossWages:500000,employeeRate:0.5,employerContributionRate:1,taxYear:2026})
};
console.log(JSON.stringify(out));
'''
proc = subprocess.run(['node', '-e', node_program, str(root/'financial-engine.js')], capture_output=True, text=True, check=True)
out = json.loads(proc.stdout)

def near(a,b,tol=0.02,label=''):
    if abs(a-b)>tol:
        raise AssertionError(f'{label}: expected {b}, got {a}')

def payment(p,apr,n):
    if apr==0: return p/n
    r=apr/12
    return p*r/(1-(1+r)**(-n))

for got,(p,apr,n) in zip(out['payments'],[(10000,.06,120),(50000,.08,60),(12345,0,37)]):
    near(got, round(payment(p,apr,n)+1e-12,2), .02, 'payment crosscheck')

brackets=[(0,.10),(12400,.12),(50400,.22),(105700,.24),(201775,.32),(256225,.35),(640600,.37)]
def progressive(taxable):
    tax=0.0
    for i,(lo,rate) in enumerate(brackets):
        hi=brackets[i+1][0] if i+1<len(brackets) else math.inf
        if taxable<=lo: break
        tax += (min(taxable,hi)-lo)*rate
    return round(max(0,tax)+1e-12,2)
for wage,got in zip([0,20000,74000,150000,700000],out['federal']):
    expected=progressive(max(0,wage-16100))
    near(got,expected,.01,f'federal crosscheck {wage}')

near(out['salary'], round(70000*(1.03**7),2), .02, 'salary crosscheck')
near(out['fv'], round(15000*(1.07**12),2), .02, 'FV crosscheck')

# Independent college financing reconstruction.
first=28000*(1.04**(2028-2026))
total=principal=school_interest=0.0
for i in range(4):
    cost=first*(1.04**i)
    grants=min(8000,cost)
    family=min(4000,max(0,cost-grants))
    borrowed=max(0,cost-grants-family)
    years_to_grad=4-i-.5
    total += cost
    principal += borrowed
    school_interest += borrowed*.065*years_to_grad
expected_grace=principal*.065*.5
near(out['college']['totalCost'],round(total,2),.02,'college total crosscheck')
near(out['college']['totalBorrowedPrincipal'],round(principal,2),.02,'college principal crosscheck')
near(out['college']['inSchoolInterest'],round(school_interest,2),.02,'school interest crosscheck')
near(out['college']['graceInterest'],round(expected_grace,2),.02,'grace crosscheck')
near(out['college']['repaymentStartDebt'],round(principal+school_interest+expected_grace,2),.03,'repayment balance crosscheck')

# 2026 limits: employee 24,500; total additions 72,000, leaving employer 47,500.
near(out['retirement']['employee'],24500,.01,'retirement employee cap')
near(out['retirement']['employer'],47500,.01,'retirement employer cap')
near(out['retirement']['total'],72000,.01,'retirement total cap')
assert out['retirement']['contributionCapped'] is True

print('PASS test-engine-crosscheck')
