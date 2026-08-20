from pathlib import Path
from bs4 import BeautifulSoup
import re, sys
root=Path(__file__).resolve().parents[1]
errors=[]
for f in root.glob('*.html'):
    soup=BeautifulSoup(f.read_text(), 'html.parser')
    ids=[el.get('id') for el in soup.find_all(attrs={'id':True})]
    dup=sorted({x for x in ids if ids.count(x)>1})
    if dup: errors.append(f'{f.name}: duplicate IDs {dup}')
    for tag, attr in [('script','src'),('link','href'),('a','href')]:
        for el in soup.find_all(tag):
            value=el.get(attr,'')
            if not value or value.startswith(('http:','https:','#','mailto:','tel:','javascript:')): continue
            target=(f.parent/value.split('?')[0].split('#')[0]).resolve()
            if not target.exists(): errors.append(f'{f.name}: missing local reference {value}')

app_html=(root/'app.html').read_text()
app_ids=set(re.findall(r'id="([A-Za-z0-9_-]+)"', app_html))
app_js=(root/'app.js').read_text()
for match in re.findall(r"\$\('#([A-Za-z0-9_-]+)'\)", app_js):
    if match not in app_ids: errors.append(f'app.js references missing #{match}')
for required in ['collegeSearchInput','collegeSearchResults','costResidency','costLiving','costYears','costTuition','costMandatoryFees','costRoomBoard','costBooks','costTransportation','costPersonal','costGrants','costFamily','costGrowthRate','sourceLedgerBody']:
    if required not in app_ids: errors.append(f'missing required workflow element #{required}')

for css in root.glob('*.css'):
    text=css.read_text()
    # CSS files in this project do not contain literal braces inside strings that affect this basic structural check.
    if text.count('{') != text.count('}'):
        errors.append(f'{css.name}: unbalanced CSS braces')

app_css=(root/'app.css').read_text()
for required_class in ['.college-search-result', '.college-search-results.is-visible', '.college-cost-workspace', '.cost-output-grid', '.source-ledger']:
    if required_class not in app_css:
        errors.append(f'app.css missing required workflow style {required_class}')

for js in root.glob('*.js'):
    text=js.read_text()
    if 'Number(null)' in text: errors.append(f'{js.name}: suspicious explicit Number(null)')

visible_files=list(root.glob('*.html'))+list(root.glob('*.md'))
forbidden=['Northeastern','electrical engineering','CT resident','GradGrid','GradTab','FutureLedger']
for f in visible_files:
    text=f.read_text().lower()
    for term in forbidden:
        if term.lower() in text: errors.append(f'{f.name}: forbidden/default-specific term {term!r}')

if errors:
    print('\n'.join('FAIL '+e for e in errors)); sys.exit(1)
print('PASS static-audit')
