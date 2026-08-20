(function (global) {
  'use strict';

  const API_BASE = 'https://api.data.gov/ed/collegescorecard/v1/schools';
  const DATASET_RELEASE_DATE = '2026-06-10';
  const DEFAULT_API_KEY = 'DEMO_KEY';
  const BASE_COST_YEAR = 2025;
  const DB_NAME = 'collegetab-college-cache';
  const DB_VERSION = 1;
  const STORE_NAME = 'institutions';
  const HISTORY_YEARS = Array.from({ length: 11 }, (_, index) => 2015 + index);
  let directoryPromise = null;

  const OWNERSHIP = {
    1: 'Public',
    2: 'Private nonprofit',
    3: 'Private for-profit'
  };

  const COST_FIELDS = [
    'tuition.in_state',
    'tuition.out_of_state',
    'booksupply',
    'roomboard.oncampus',
    'roomboard.offcampus',
    'otherexpense.oncampus',
    'otherexpense.offcampus',
    'otherexpense.withfamily',
    'attendance.academic_year',
    'avg_net_price.public',
    'avg_net_price.private'
  ];

  const SEARCH_FIELDS = [
    'id',
    'ope8_id',
    'ope6_id',
    'school.name',
    'school.city',
    'school.state',
    'school.ownership',
    'school.school_url',
    'school.price_calculator_url',
    'school.degrees_awarded.predominant',
    ...COST_FIELDS.map(field => `${BASE_COST_YEAR}.cost.${field}`),
    ...COST_FIELDS.map(field => `latest.cost.${field}`)
  ];

  function apiKey() {
    return String(global.COLLEGETAB_SCORECARD_API_KEY || DEFAULT_API_KEY).trim() || DEFAULT_API_KEY;
  }

  function finiteOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function textOrEmpty(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function source(variable, { academicYear = 'latest available', note = '' } = {}) {
    return {
      provider: 'IPEDS via College Scorecard',
      dataset: 'College Scorecard institution-level data',
      variable,
      academicYear,
      releaseDate: DATASET_RELEASE_DATE,
      retrievedAt: nowIso(),
      note
    };
  }

  function sourcedValue(value, variable, options) {
    return {
      value: finiteOrNull(value),
      source: source(variable, options)
    };
  }

  function currentCostValue(row, field, variable, note = '') {
    const explicitKey = `${BASE_COST_YEAR}.cost.${field}`;
    const explicit = finiteOrNull(row[explicitKey]);
    if (explicit != null) {
      return sourcedValue(explicit, variable, {
        academicYear: `${BASE_COST_YEAR}-${String(BASE_COST_YEAR + 1).slice(-2)}`,
        note
      });
    }
    const fallbackNote = [note, 'The Scorecard latest alias was used because the explicit 2025-26 field was unavailable; its precise source year is not inferred by CollegeTab.'].filter(Boolean).join(' ');
    return sourcedValue(row[`latest.cost.${field}`], variable, { academicYear: 'latest available', note: fallbackNote });
  }

  function publishedSource(variable, publication) {
    return {
      provider: 'School-published cost of attendance',
      dataset: publication.title || 'Official institutional cost of attendance',
      variable,
      academicYear: publication.academicYear,
      releaseDate: publication.publishedDate || '',
      retrievedAt: publication.retrievedAt || nowIso(),
      verifiedAt: publication.verifiedAt || nowIso(),
      url: publication.sourceUrl,
      note: publication.note || 'Verified school-published value retained separately from federal fields.'
    };
  }

  function normalizePublishedNumber(value, variable, publication) {
    const numeric = finiteOrNull(value);
    return numeric == null ? null : { value: numeric, source: publishedSource(variable, publication) };
  }

  function normalizeScorecardRow(row) {
    const unitId = String(row.id ?? '').replace(/\D/g, '');
    if (!unitId) throw new Error('College Scorecard record is missing an IPEDS UNITID.');

    const tuitionNote = 'College Scorecard/IPEDS reports tuition and required fees together. CollegeTab does not invent a tuition/fee split.';
    const otherNote = 'IPEDS other expenses can include transportation and personal expenses together. CollegeTab preserves the combined amount until a verified split or user override is supplied.';

    return {
      schemaVersion: 1,
      canonicalId: `ipeds:${unitId}`,
      unitId,
      identifiers: {
        ipedsUnitId: unitId,
        ope8Id: textOrEmpty(row.ope8_id),
        ope6Id: textOrEmpty(row.ope6_id)
      },
      identity: {
        name: textOrEmpty(row['school.name']) || `Institution ${unitId}`,
        city: textOrEmpty(row['school.city']),
        state: textOrEmpty(row['school.state']),
        ownershipCode: finiteOrNull(row['school.ownership']),
        ownership: OWNERSHIP[row['school.ownership']] || 'Unknown',
        schoolUrl: textOrEmpty(row['school.school_url']),
        netPriceCalculatorUrl: textOrEmpty(row['school.price_calculator_url']),
        predominantDegreeCode: finiteOrNull(row['school.degrees_awarded.predominant'])
      },
      costs: {
        tuitionFeesInState: currentCostValue(row, 'tuition.in_state', 'TUITIONFEE_IN', tuitionNote),
        tuitionFeesOutOfState: currentCostValue(row, 'tuition.out_of_state', 'TUITIONFEE_OUT', tuitionNote),
        booksSupplies: currentCostValue(row, 'booksupply', 'BOOKSUPPLY'),
        roomBoardOnCampus: currentCostValue(row, 'roomboard.oncampus', 'ROOMBOARD_ON'),
        roomBoardOffCampus: currentCostValue(row, 'roomboard.offcampus', 'ROOMBOARD_OFF'),
        otherExpensesOnCampus: currentCostValue(row, 'otherexpense.oncampus', 'OTHEREXPENSE_ON', otherNote),
        otherExpensesOffCampus: currentCostValue(row, 'otherexpense.offcampus', 'OTHEREXPENSE_OFF', otherNote),
        otherExpensesWithFamily: currentCostValue(row, 'otherexpense.withfamily', 'OTHEREXPENSE_FAM', otherNote),
        attendanceAcademicYear: currentCostValue(row, 'attendance.academic_year', 'COSTT4_A'),
        averageNetPricePublic: currentCostValue(row, 'avg_net_price.public', 'NPT4_PUB'),
        averageNetPricePrivate: currentCostValue(row, 'avg_net_price.private', 'NPT4_PRIV')
      },
      publishedCosts: null,
      residency: {
        institutionState: textOrEmpty(row['school.state']),
        categoriesAvailable: ['in_state', 'out_of_state'],
        eligibilityPolicy: null,
        note: 'Federal cost data supplies price categories, not a student-specific residency eligibility decision. CollegeTab requires the user or a verified school policy to determine which category applies.'
      },
      history: [],
      provenance: {
        canonicalKey: {
          value: unitId,
          source: {
            provider: 'IPEDS / NCES',
            variable: 'UNITID',
            releaseDate: DATASET_RELEASE_DATE,
            retrievedAt: nowIso(),
            note: 'IPEDS UNITID is CollegeTab’s canonical institution key. OPE IDs are retained only as crosswalk identifiers.'
          }
        },
        identity: {
          provider: 'College Scorecard / IPEDS',
          dataset: 'College Scorecard institution-level data',
          variables: ['school.name', 'school.city', 'school.state', 'school.ownership', 'school.school_url', 'school.price_calculator_url'],
          releaseDate: DATASET_RELEASE_DATE,
          retrievedAt: nowIso()
        },
        identifiers: {
          provider: 'College Scorecard / IPEDS crosswalk fields',
          variables: ['id', 'ope8_id', 'ope6_id'],
          releaseDate: DATASET_RELEASE_DATE,
          retrievedAt: nowIso()
        },
        baseSourcePriority: [
          'Verified school-published cost of attendance',
          'Direct IPEDS Cost / Institutional Characteristics data',
          'College Scorecard distribution of IPEDS fields'
        ],
        planOverrideRule: 'A user override wins inside that saved plan but never mutates the canonical source record.'
      },
      cache: {
        fetchedAt: nowIso(),
        releaseDate: DATASET_RELEASE_DATE
      }
    };
  }

  function buildSearchUrl(query, limit = 10) {
    const params = new URLSearchParams({
      api_key: apiKey(),
      'school.name': query,
      fields: SEARCH_FIELDS.join(','),
      per_page: String(Math.max(1, Math.min(20, limit))),
      page: '0'
    });
    return `${API_BASE}?${params}`;
  }

  function buildInstitutionUrl(unitId) {
    const params = new URLSearchParams({
      api_key: apiKey(),
      id: String(unitId).replace(/\D/g, ''),
      fields: SEARCH_FIELDS.join(','),
      per_page: '1',
      page: '0'
    });
    return `${API_BASE}?${params}`;
  }

  async function loadCanonicalDirectory(url = global.COLLEGETAB_DIRECTORY_URL) {
    const cleanUrl = String(url || '').trim();
    if (!cleanUrl) return null;
    if (!directoryPromise) {
      directoryPromise = fetchJson(cleanUrl, { timeoutMs: 15000 })
        .then(payload => {
          if (!Array.isArray(payload?.institutions)) throw new Error('Canonical IPEDS directory is not in the expected CollegeTab format.');
          return payload;
        })
        .catch(error => { directoryPromise = null; throw error; });
    }
    return directoryPromise;
  }

  function searchDirectoryPayload(payload, query, limit) {
    const needle = String(query || '').trim().toLocaleLowerCase();
    if (!needle || !Array.isArray(payload?.institutions)) return [];
    return payload.institutions
      .map(record => {
        const name = String(record?.identity?.name || '').toLocaleLowerCase();
        const city = String(record?.identity?.city || '').toLocaleLowerCase();
        const state = String(record?.identity?.state || '').toLocaleLowerCase();
        const starts = name.startsWith(needle) ? 0 : name.includes(needle) ? 1 : city.includes(needle) || state === needle ? 2 : 9;
        return { record, starts };
      })
      .filter(item => item.starts < 9)
      .sort((a, b) => a.starts - b.starts || a.record.identity.name.localeCompare(b.record.identity.name))
      .slice(0, limit)
      .map(item => item.record);
  }

  async function fetchInstitutionByUnitId(unitId) {
    const cleanId = String(unitId || '').replace(/\D/g, '');
    if (!cleanId) return null;
    const payload = await fetchJson(buildInstitutionUrl(cleanId));
    const row = payload?.results?.[0];
    if (!row) return null;
    const record = normalizeScorecardRow(row);
    await cacheRecord(record);
    return record;
  }

  function buildHistoryUrl(unitId) {
    const fields = ['id', 'school.name'];
    for (const year of HISTORY_YEARS) {
      for (const field of COST_FIELDS.slice(0, 8)) fields.push(`${year}.cost.${field}`);
    }
    const params = new URLSearchParams({
      api_key: apiKey(),
      id: String(unitId),
      fields: fields.join(','),
      per_page: '1',
      page: '0'
    });
    return `${API_BASE}?${params}`;
  }

  async function fetchJson(url, { timeoutMs = 9000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`College Scorecard request failed (${response.status}). ${detail}`.trim());
      }
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function openDb() {
    if (!('indexedDB' in global)) return null;
    return await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'canonicalId' });
          store.createIndex('nameNormalized', 'nameNormalized', { unique: false });
          store.createIndex('unitId', 'unitId', { unique: true });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(() => null);
  }

  async function cacheRecord(record) {
    const db = await openDb();
    if (!db) return false;
    return await new Promise(resolve => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({
        ...record,
        nameNormalized: record.identity.name.toLocaleLowerCase()
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  }

  async function cachedSearch(query, limit = 10) {
    const db = await openDb();
    if (!db) return [];
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return [];
    return await new Promise(resolve => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => {
        const rows = (request.result || [])
          .filter(record => record?.identity?.name?.toLocaleLowerCase().includes(needle))
          .slice(0, limit)
          .map(({ nameNormalized, ...record }) => record);
        resolve(rows);
      };
      request.onerror = () => resolve([]);
    });
  }

  async function searchInstitutions(query, { limit = 10 } = {}) {
    const clean = String(query || '').trim().replace(/\s+/g, ' ');
    if (clean.length < 2) return { results: [], source: 'none', total: 0 };

    if (String(global.COLLEGETAB_DIRECTORY_URL || '').trim()) {
      try {
        const directory = await loadCanonicalDirectory();
        const results = searchDirectoryPayload(directory, clean, limit);
        if (results.length) {
          return {
            results,
            source: 'IPEDS canonical directory',
            total: results.length,
            directorySurveyYear: directory?.source?.surveyYear || '',
            releaseDate: directory?.generatedAt || ''
          };
        }
      } catch (directoryError) {
        // A configured directory failure should not prevent Scorecard fallback search.
      }
    }

    try {
      const payload = await fetchJson(buildSearchUrl(clean, limit));
      const results = Array.isArray(payload.results) ? payload.results.map(normalizeScorecardRow) : [];
      await Promise.all(results.map(cacheRecord));
      return {
        results,
        source: 'College Scorecard API',
        total: Number(payload?.metadata?.total || results.length),
        releaseDate: DATASET_RELEASE_DATE,
        usingDemoKey: apiKey() === DEFAULT_API_KEY
      };
    } catch (error) {
      const cached = await cachedSearch(clean, limit);
      if (cached.length) {
        return { results: cached, source: 'local cache', total: cached.length, error, releaseDate: DATASET_RELEASE_DATE };
      }
      throw error;
    }
  }

  function rowHistoryValue(row, year, key, variable, note = '') {
    return sourcedValue(row[`${year}.cost.${key}`], variable, { academicYear: `${year}-${String(year + 1).slice(-2)}`, note });
  }

  async function fetchInstitutionHistory(record) {
    if (!record?.unitId) return record;
    try {
      const payload = await fetchJson(buildHistoryUrl(record.unitId), { timeoutMs: 11000 });
      const row = payload?.results?.[0];
      if (!row) return record;
      const tuitionNote = 'Tuition and required fees are combined in this federal variable.';
      const otherNote = 'Other expenses may combine transportation and personal expenses.';
      const history = HISTORY_YEARS.map(year => ({
        year,
        label: `${year}-${String(year + 1).slice(-2)}`,
        tuitionFeesInState: rowHistoryValue(row, year, 'tuition.in_state', 'TUITIONFEE_IN', tuitionNote),
        tuitionFeesOutOfState: rowHistoryValue(row, year, 'tuition.out_of_state', 'TUITIONFEE_OUT', tuitionNote),
        booksSupplies: rowHistoryValue(row, year, 'booksupply', 'BOOKSUPPLY'),
        roomBoardOnCampus: rowHistoryValue(row, year, 'roomboard.oncampus', 'ROOMBOARD_ON'),
        roomBoardOffCampus: rowHistoryValue(row, year, 'roomboard.offcampus', 'ROOMBOARD_OFF'),
        otherExpensesOnCampus: rowHistoryValue(row, year, 'otherexpense.oncampus', 'OTHEREXPENSE_ON', otherNote),
        otherExpensesOffCampus: rowHistoryValue(row, year, 'otherexpense.offcampus', 'OTHEREXPENSE_OFF', otherNote),
        otherExpensesWithFamily: rowHistoryValue(row, year, 'otherexpense.withfamily', 'OTHEREXPENSE_FAM', otherNote)
      })).filter(item => Object.entries(item).some(([key, value]) => key !== 'year' && key !== 'label' && value?.value != null));
      const merged = { ...record, history, cache: { ...record.cache, historyFetchedAt: nowIso() } };
      await cacheRecord(merged);
      return merged;
    } catch (error) {
      return { ...record, historyError: String(error?.message || error) };
    }
  }

  function mergeVerifiedSchoolPublished(record, publication) {
    if (!record?.unitId) throw new Error('A canonical IPEDS UNITID is required before school-published data can be merged.');
    if (!publication || String(publication.unitId || '').replace(/\D/g, '') !== String(record.unitId)) throw new Error('School-published data must match the canonical IPEDS UNITID.');
    if (!/^20\d{2}-\d{2}$/.test(String(publication.academicYear || ''))) throw new Error('School-published data requires an academic year such as 2026-27.');
    let parsedUrl;
    try { parsedUrl = new URL(publication.sourceUrl); } catch { throw new Error('School-published data requires a valid source URL.'); }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('School-published source URL must use HTTP or HTTPS.');

    const values = publication.costs && typeof publication.costs === 'object' ? publication.costs : {};
    const keys = [
      'tuitionInState', 'mandatoryFeesInState', 'tuitionOutOfState', 'mandatoryFeesOutOfState',
      'roomBoardOnCampus', 'roomBoardOffCampus', 'booksSupplies',
      'transportationOnCampus', 'transportationOffCampus', 'transportationWithFamily',
      'personalOnCampus', 'personalOffCampus', 'personalWithFamily'
    ];
    const publishedCosts = {};
    for (const key of keys) {
      const normalized = normalizePublishedNumber(values[key], key, publication);
      if (normalized) publishedCosts[key] = normalized;
    }

    const merged = {
      ...record,
      publishedCosts: {
        academicYear: publication.academicYear,
        sourceUrl: parsedUrl.href,
        title: publication.title || 'Official institutional cost of attendance',
        publishedDate: publication.publishedDate || '',
        verifiedAt: publication.verifiedAt || nowIso(),
        values: publishedCosts
      },
      residency: {
        ...(record.residency || {}),
        eligibilityPolicy: publication.residencyPolicy ? {
          text: String(publication.residencyPolicy.text || '').slice(0, 2000),
          url: publication.residencyPolicy.url || parsedUrl.href,
          academicYear: publication.academicYear,
          verifiedAt: publication.verifiedAt || nowIso()
        } : record.residency?.eligibilityPolicy || null
      },
      cache: { ...(record.cache || {}), schoolPublishedMergedAt: nowIso() }
    };
    cacheRecord(merged);
    return merged;
  }

  function fieldSource(record, key) {
    return record?.costs?.[key]?.source || null;
  }

  const canonicalSchema = {
    canonicalId: 'ipeds:<UNITID>',
    unitId: 'IPEDS UNITID — stable canonical key inside CollegeTab',
    identifiers: ['ipedsUnitId', 'ope8Id', 'ope6Id'],
    identity: ['name', 'city', 'state', 'ownership', 'schoolUrl', 'netPriceCalculatorUrl'],
    costs: [
      'tuitionFeesInState',
      'tuitionFeesOutOfState',
      'booksSupplies',
      'roomBoardOnCampus',
      'roomBoardOffCampus',
      'otherExpensesOnCampus',
      'otherExpensesOffCampus',
      'otherExpensesWithFamily',
      'attendanceAcademicYear',
      'averageNetPricePublic',
      'averageNetPricePrivate'
    ],
    publishedCosts: 'Optional verified school-published component values retained alongside, never destructively replacing, federal fields.',
    residency: 'Institution state plus optional verified residency eligibility policy. Price categories never imply student eligibility.',
    history: 'Annual IPEDS cost observations, each carrying source, academic year, release date, and retrieval date.',
    sourcePrecedence: 'verified school-published > direct IPEDS > College Scorecard-distributed IPEDS; plan-level user overrides supersede display calculations without mutating canonical data'
  };

  global.CollegeTabData = Object.freeze({
    API_BASE,
    DATASET_RELEASE_DATE,
    BASE_COST_YEAR,
    canonicalSchema,
    loadCanonicalDirectory,
    searchInstitutions,
    fetchInstitutionByUnitId,
    fetchInstitutionHistory,
    normalizeScorecardRow,
    mergeVerifiedSchoolPublished,
    fieldSource,
    cacheRecord
  });
})(window);
