#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    args[key.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return args;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows.filter(r => r.some(cell => cell !== ''));
}

function cleanUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try { return new URL(candidate).href; } catch { return ''; }
}

function ownership(code) {
  const n = Number(code);
  return n === 1 ? 'Public' : n === 2 ? 'Private nonprofit' : n === 3 ? 'Private for-profit' : 'Unknown';
}

function sourceMetadata({ surveyYear, sourceUrl, builtAt }) {
  return {
    provider: 'IPEDS / NCES',
    dataset: 'Institutional Characteristics — Directory Information (HD)',
    surveyYear,
    sourceUrl,
    ingestedAt: builtAt,
    note: 'Canonical institution-universe record. Cost fields are enriched separately.'
  };
}

const args = parseArgs(process.argv);
if (!args.input || !args.out || !args['survey-year']) {
  console.error('Usage: node scripts/build-ipeds-directory.mjs --input HDxxxx.csv --survey-year 2025 --out data/ipeds-directory.json [--source-url URL]');
  process.exit(2);
}

const inputPath = path.resolve(args.input);
const outPath = path.resolve(args.out);
const surveyYear = String(args['survey-year']);
if (!/^20\d{2}$/.test(surveyYear)) throw new Error('survey-year must be a four-digit year.');
const sourceUrl = String(args['source-url'] || 'https://nces.ed.gov/ipeds/datacenter/').trim();
const builtAt = new Date().toISOString();

const rows = parseCsv(fs.readFileSync(inputPath, 'utf8').replace(/^\uFEFF/, ''));
if (rows.length < 2) throw new Error('IPEDS directory CSV is empty or invalid.');
const headers = rows[0].map(value => value.trim().toUpperCase());
const index = Object.fromEntries(headers.map((key, i) => [key, i]));
for (const required of ['UNITID', 'INSTNM']) {
  if (!(required in index)) throw new Error(`IPEDS directory CSV is missing required column ${required}.`);
}
const get = (row, key) => index[key] == null ? '' : String(row[index[key]] || '').trim();
const meta = sourceMetadata({ surveyYear, sourceUrl, builtAt });
const seen = new Set();
const institutions = [];

for (const row of rows.slice(1)) {
  const unitId = get(row, 'UNITID').replace(/\D/g, '');
  const name = get(row, 'INSTNM');
  if (!unitId || !name || seen.has(unitId)) continue;
  seen.add(unitId);
  const controlCode = Number(get(row, 'CONTROL'));
  const opeId = get(row, 'OPEID');
  institutions.push({
    schemaVersion: 1,
    canonicalId: `ipeds:${unitId}`,
    unitId,
    identifiers: {
      ipedsUnitId: unitId,
      ope8Id: opeId,
      ope6Id: opeId ? opeId.replace(/\D/g, '').slice(0, 6) : ''
    },
    identity: {
      name,
      city: get(row, 'CITY'),
      state: get(row, 'STABBR'),
      ownershipCode: Number.isFinite(controlCode) ? controlCode : null,
      ownership: ownership(controlCode),
      schoolUrl: cleanUrl(get(row, 'WEBADDR')),
      netPriceCalculatorUrl: cleanUrl(get(row, 'NPCURL')),
      predominantDegreeCode: null
    },
    residency: {
      institutionState: get(row, 'STABBR'),
      categoriesAvailable: ['in_state', 'out_of_state'],
      eligibilityPolicy: null,
      note: 'Institution state is known; student-specific residency eligibility must come from a verified institutional/state policy or the user.'
    },
    costs: {},
    publishedCosts: null,
    history: [],
    provenance: {
      canonicalKey: { value: unitId, source: { ...meta, variable: 'UNITID' } },
      identity: { ...meta, variables: ['INSTNM', 'CITY', 'STABBR', 'CONTROL', 'WEBADDR', 'NPCURL'] },
      identifiers: { ...meta, variables: ['UNITID', 'OPEID'] },
      baseSourcePriority: [
        'Verified school-published cost of attendance',
        'Direct IPEDS Cost / Institutional Characteristics data',
        'College Scorecard distribution of IPEDS fields'
      ],
      planOverrideRule: 'User overrides apply only within a saved plan and never mutate this canonical record.'
    }
  });
}

institutions.sort((a, b) => a.identity.name.localeCompare(b.identity.name) || Number(a.unitId) - Number(b.unitId));
const payload = {
  schemaVersion: 1,
  generatedAt: builtAt,
  institutionCount: institutions.length,
  source: meta,
  institutions
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload));
console.log(`Wrote ${institutions.length} canonical IPEDS institutions to ${outPath}`);
