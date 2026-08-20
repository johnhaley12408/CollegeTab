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
assert '/ MO' in soup.select_one('#budgetForm').get_text(' ',strip=True)
assert 'Annual housing cost' not in html and 'Other annual living costs' not in html
# state preset + savings explainer/account choices
assert 'CollegeTabCostOfLiving2026' in js
assert soup.select_one('#applyStateBudgetPreset')
expl=soup.select_one('.savings-explainer').get_text(' ',strip=True).lower()
for phrase in ['emergency fund','401(k)','hsa','roth ira','brokerage','cash/hysa']:
    assert phrase in expl, phrase
for name in ['allocation401k','allocationHsa','allocationRoth','allocationBrokerage','allocationCash']:
    assert soup.select_one(f'#savingsForm [name="{name}"]')
assert 'allocation must total 100%' in js.lower()
assert '.budget-grid' in css and '.allocation-panel' in css
print('PASS test-linear-budget-savings')
