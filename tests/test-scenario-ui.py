from pathlib import Path
from bs4 import BeautifulSoup
import sys
root=Path(__file__).resolve().parents[1]
errors=[]
html=(root/'app.html').read_text()
soup=BeautifulSoup(html,'html.parser')
ids={x.get('id') for x in soup.find_all(attrs={'id':True})}
required={
 'projectionSharedForm','projectionScenarioForm','projectionSchoolSelect','projectionOutput','projectionAuditBody',
 'loanPlanTable','loanRateTable','resetLoanPlanButton','projectionFederalDebt','projectionPrivateDebt','projectionParentDebt','projectionLoanFees',
 'compareTotalCostA','compareDebtA','compareFederalDebtA','comparePrivateDebtA','compareParentDebtA','compareSalaryA','compareTakeHomeA','compareDebtFreeA','compareNetWorthA',
 'compareTotalCostB','compareDebtB','compareFederalDebtB','comparePrivateDebtB','compareParentDebtB','compareSalaryB','compareTakeHomeB','compareDebtFreeB','compareNetWorthB'
}
for item in sorted(required-ids): errors.append(f'missing scenario UI #{item}')
for obsolete in ['federalStudentTermYears','parentPlusTermYears','blendedLoanApr','loanApr']:
    if f'name="{obsolete}"' in html or f"name='{obsolete}'" in html: errors.append(f'obsolete loan UI field remains: {obsolete}')
if 'TIERED STANDARD' not in html: errors.append('current-law Tiered Standard baseline must be visible in loan UI')
if 'ANNUAL LOAN PRICING + FEE ASSUMPTIONS' not in html: errors.append('annual loan pricing/fee provenance controls missing')
for script in ['state-tax-data-2026.js','loan-engine.js','financial-engine.js','app.js']:
    pos=html.find(f'src="{script}"')
    if pos<0: errors.append(f'missing script {script}')
loan_pos=html.find('src="loan-engine.js"')
engine_pos=html.find('src="financial-engine.js"')
app_pos=html.find('src="app.js"')
if loan_pos>=0 and engine_pos>=0 and loan_pos>engine_pos: errors.append('loan engine must load before financial engine')
if engine_pos>=0 and app_pos>=0 and engine_pos>app_pos: errors.append('financial engine must load before app.js')
appjs=(root/'app.js').read_text()
for forbidden in ['socialSecurityRate: 0.062','standardDeduction: {','function federalIncomeTax(','function repaymentSchedule(','Math.pow(1 + career.salaryGrowthRate']:
    if forbidden in appjs: errors.append(f'financial math leaked into UI: {forbidden}')
if 'CollegeTabLoanEngine' not in appjs: errors.append('UI does not consume dedicated loan engine')

if 'data-rate-field="privateApr"' not in appjs: errors.append('year-specific private APR input missing from annual loan pricing table')
if 'data-rate-field="privateFeeRate"' not in appjs: errors.append('year-specific private fee input missing from annual loan pricing table')
for obsolete_private in ['name="privateApr"','name="privateOriginationFeeRate"']:
    if obsolete_private in html: errors.append(f'global private pricing field remains: {obsolete_private}')
for required_call in ['CollegeTabFinancialEngine.projectScenario','CollegeTabFinancialEngine.compareScenarios']:
    if required_call not in appjs: errors.append(f'UI does not consume engine: {required_call}')
engine=(root/'financial-engine.js').read_text()
if 'JSON.stringify(result.input, null, 2)' not in appjs: errors.append('projection audit must expose canonical reproducibility input')
if 'Future-policy convention:' not in appjs: errors.append('projection audit must disclose future-policy convention')
if 'Deferred Parent PLUS interest is modeled to capitalize' not in (root/'loan-engine.js').read_text(): errors.append('loan engine must disclose Parent PLUS capitalization behavior')
if 'Private in-school cash outflow:' not in appjs: errors.append('audit must disclose private interest-only pre-graduation cash flow')
for fn in ['projectCollegeFinancing','repaymentSchedule','projectSalary','federalIncomeTax','stateIncomeTax','ficaTax','retirementContribution','inflateExpense','emergencyFundTarget','calculateNetWorth','opportunityCost','projectScenario']:
    if f'function {fn}' not in engine: errors.append(f'engine missing {fn}')
if errors:
    print('\n'.join('FAIL '+e for e in errors)); sys.exit(1)
print('PASS test-scenario-ui')
