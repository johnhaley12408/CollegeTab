from bs4 import BeautifulSoup
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
html=(root/'app.html').read_text()
js=(root/'app.js').read_text()
css=(root/'app.css').read_text()
soup=BeautifulSoup(html,'html.parser')
# exact numbered journey
links=[(a.get('data-route'),a.get_text(' ',strip=True)) for a in soup.select('.rail-nav a[data-route]')]
flow=[r for r,t in links if r in {'onboarding','colleges','projection','budget','savings','compare'}]
assert flow==['onboarding','colleges','projection','budget','savings','compare'], flow
# forward CTAs
assert soup.select_one('#collegeContinueButton[data-route-button="projection"]')
assert soup.select_one('#projectionScenarioForm button[type="submit"]')
assert 'Save + continue to monthly budget' in soup.select_one('#projectionScenarioForm button[type="submit"]').get_text(' ',strip=True)
assert 'setRoute(\'budget\'' in js
assert 'setRoute(\'savings\'' in js
# monthly budget categories
for key in ['food','housing','transportation','healthcare','entertainment','charity','misc']:
    assert soup.select_one(f'#budgetForm [name="{key}"]'), key
    rate=soup.select_one(f'#budgetForm [name="{key}InflationRate"]')
    assert rate and rate.get('min')=='0' and rate.get('max')=='20' and rate.has_attr('required'), key
assert '/ MO' in soup.select_one('#budgetForm').get_text(' ',strip=True)
assert '% / YR' in soup.select_one('.budget-inflation').get_text(' ',strip=True)
assert soup.select_one('#applyInflationPreset')
assert soup.select_one('.budget-inflation a[href*="bls.gov"]')
assert 'inflationRates' in js and 'budgetInflationValuesFromForm' in js
assert 'Entertainment and charity still inflate' in soup.select_one('.inflation-note').get_text(' ',strip=True)
assert 'Annual housing cost' not in html and 'Other annual living costs' not in html
# state preset + savings explainer/account choices
assert 'CollegeTabCostOfLiving2026' in js
assert soup.select_one('#applyStateBudgetPreset')
expl=soup.select_one('.savings-explainer').get_text(' ',strip=True).lower()
for phrase in ['emergency fund','401(k)','hsa','roth ira','brokerage','cash/hysa']:
    assert phrase in expl, phrase
for name in ['contribution401k','contributionHsa','contributionRoth','contributionBrokerage']:
    slider=soup.select_one(f'#savingsForm input[type="range"][name="{name}"]')
    assert slider and slider.get('min')=='0', name
assert soup.select_one('#contribution401kMax') and soup.select_one('#postTaxSavingsAvailable') and soup.select_one('#contributionCashValue')
assert '401(K) COMES FIRST' in soup.select_one('.contribution-stage--pretax').get_text(' ',strip=True)
assert 'Percentages must total 100%' not in html
assert 'allocation401k' not in html
assert 'contributionRates' in js and 'updateSavingsCapacityPreview' in js
assert not soup.select_one('.savings-block.fl-surface--blue'), 'paper savings block must not inherit white text from blue surface'
assert '.savings-block{background:var(--paper);color:var(--ink)' in css
assert '.budget-grid' in css and '.budget-inflation' in css and '.inflation-grid' in css and '.contribution-stage' in css
print('PASS test-linear-budget-savings')
