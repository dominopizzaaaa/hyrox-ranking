/* Race Rank — HYROX results explorer
 * Loads a gzip-compressed results cache in the browser and renders leaderboards,
 * per-event tables, and an overview dashboard. All filtering happens client-side.
 */
'use strict';

const DATASET_URL = './athletes.json.gz';
const METADATA_URL = './dataset-meta.json';

const DEFAULTS = { race: 'all', gender: 'all', age: 'all', nationality: 'all', comp: 'all', tier: 'all', limit: '50' };

/* IOC / HYROX country codes -> display names. Falls back to the raw code. */
const COUNTRIES = {
  GBR: 'United Kingdom', ENG: 'England', SCO: 'Scotland', WAL: 'Wales', NIR: 'Northern Ireland',
  GER: 'Germany', USA: 'United States', NED: 'Netherlands', FRA: 'France', AUS: 'Australia',
  ESP: 'Spain', IRL: 'Ireland', CHN: 'China', MEX: 'Mexico', ITA: 'Italy', SIN: 'Singapore',
  NZL: 'New Zealand', RSA: 'South Africa', THA: 'Thailand', IND: 'India', CAN: 'Canada',
  POL: 'Poland', AUT: 'Austria', SWE: 'Sweden', HKG: 'Hong Kong', BEL: 'Belgium', KOR: 'South Korea',
  MAS: 'Malaysia', SUI: 'Switzerland', DEN: 'Denmark', POR: 'Portugal', PHI: 'Philippines',
  ARG: 'Argentina', INA: 'Indonesia', COL: 'Colombia', CZE: 'Czechia', NOR: 'Norway', BRA: 'Brazil',
  TPE: 'Chinese Taipei', HUN: 'Hungary', JPN: 'Japan', VEN: 'Venezuela', UAE: 'United Arab Emirates',
  LTU: 'Lithuania', ROU: 'Romania', GRE: 'Greece', MLT: 'Malta', LUX: 'Luxembourg', MAR: 'Morocco',
  FIN: 'Finland', CHI: 'Chile', UKR: 'Ukraine', CRO: 'Croatia', SLO: 'Slovenia', TUR: 'Turkey',
  RUS: 'Russia', SVK: 'Slovakia', PUR: 'Puerto Rico', EGY: 'Egypt', GUA: 'Guatemala', ISL: 'Iceland',
  EST: 'Estonia', LAT: 'Latvia', SRB: 'Serbia', BUL: 'Bulgaria', CYP: 'Cyprus', ISR: 'Israel',
  QAT: 'Qatar', KSA: 'Saudi Arabia', KUW: 'Kuwait', LIB: 'Lebanon', JOR: 'Jordan', VIE: 'Vietnam',
  MGL: 'Mongolia', KAZ: 'Kazakhstan', PAK: 'Pakistan', SRI: 'Sri Lanka', BAN: 'Bangladesh',
  ECU: 'Ecuador', PER: 'Peru', URU: 'Uruguay', PAR: 'Paraguay', BOL: 'Bolivia', CRC: 'Costa Rica',
  PAN: 'Panama', DOM: 'Dominican Republic', JAM: 'Jamaica', TRI: 'Trinidad & Tobago', BAH: 'Bahamas',
  NGR: 'Nigeria', KEN: 'Kenya', GHA: 'Ghana', UGA: 'Uganda', ZIM: 'Zimbabwe', BOT: 'Botswana',
  NAM: 'Namibia', MRI: 'Mauritius', TUN: 'Tunisia', ALG: 'Algeria', OMA: 'Oman', BRN: 'Bahrain',
  MAC: 'Macau', BRU: 'Brunei', MYA: 'Myanmar', CAM: 'Cambodia', NEP: 'Nepal', GEO: 'Georgia',
  ARM: 'Armenia', AZE: 'Azerbaijan', ALB: 'Albania', MKD: 'North Macedonia', BIH: 'Bosnia & Herzegovina',
  MNE: 'Montenegro', KOS: 'Kosovo', MDA: 'Moldova', BLR: 'Belarus', AND: 'Andorra', MON: 'Monaco',
  LIE: 'Liechtenstein', SMR: 'San Marino', FRO: 'Faroe Islands', GIB: 'Gibraltar',
  // Additional IOC / HYROX codes seen in the dataset.
  LBN: 'Lebanon', ESA: 'El Salvador', IRI: 'Iran', SAM: 'Samoa', CUB: 'Cuba', WLS: 'Wales',
  HON: 'Honduras', PLE: 'Palestine', TGA: 'Tonga', SYR: 'Syria', JEY: 'Jersey', HAI: 'Haiti',
  IMN: 'Isle of Man', GGY: 'Guernsey', COK: 'Cook Islands', CMR: 'Cameroon', TTO: 'Trinidad & Tobago',
  IRQ: 'Iraq', CIV: "Côte d'Ivoire", SUR: 'Suriname', FIJ: 'Fiji', GUM: 'Guam', NCA: 'Nicaragua',
  CPV: 'Cape Verde', COD: 'DR Congo', PYF: 'French Polynesia', AFG: 'Afghanistan', REU: 'Réunion',
  CUW: 'Curaçao', MDV: 'Maldives', CAY: 'Cayman Islands', BAR: 'Barbados', MAD: 'Madagascar',
  NCL: 'New Caledonia', SUD: 'Sudan', ANG: 'Angola', IOT: 'British Indian Ocean Territory',
  IVB: 'British Virgin Islands', PNG: 'Papua New Guinea', NIU: 'Niue', GUY: 'Guyana', ZAM: 'Zambia',
  LAO: 'Laos', ARU: 'Aruba', GLP: 'Guadeloupe', ETH: 'Ethiopia', BER: 'Bermuda', SWZ: 'Eswatini',
  KGZ: 'Kyrgyzstan', LES: 'Lesotho', YEM: 'Yemen', GRN: 'Grenada', BLM: 'Saint Barthélemy',
  MTQ: 'Martinique', DMA: 'Dominica', UMI: 'US Minor Outlying Islands', LCA: 'Saint Lucia',
  ASA: 'American Samoa', BEN: 'Benin', GUF: 'French Guiana', TAN: 'Tanzania', SOM: 'Somalia',
  ALA: 'Åland Islands', GUI: 'Guinea', LBR: 'Liberia', TOG: 'Togo', MAW: 'Malawi', SXM: 'Sint Maarten',
  BDI: 'Burundi', SLE: 'Sierra Leone', BIZ: 'Belize', LBA: 'Libya', ATA: 'Antarctica', MOZ: 'Mozambique',
  GAB: 'Gabon', VAT: 'Vatican City', ISV: 'US Virgin Islands', CGO: 'Congo', MTN: 'Mauritania',
  ERI: 'Eritrea', PRK: 'North Korea', MAF: 'Saint Martin', NIG: 'Niger', SSD: 'South Sudan',
  SKN: 'Saint Kitts & Nevis', RWA: 'Rwanda', ANT: 'Antigua & Barbuda', BUR: 'Burkina Faso',
  GRL: 'Greenland', BHU: 'Bhutan', TKM: 'Turkmenistan', GBS: 'Guinea-Bissau', SEY: 'Seychelles',
  TKL: 'Tokelau', TCA: 'Turks & Caicos', GAM: 'Gambia', BES: 'Bonaire', CAF: 'Central African Republic',
  VIN: 'Saint Vincent & the Grenadines', MLI: 'Mali', COM: 'Comoros', SOL: 'Solomon Islands',
  CHA: 'Chad', TJK: 'Tajikistan', SGS: 'South Georgia', BVT: 'Bouvet Island', MYT: 'Mayotte',
  TLS: 'Timor-Leste', NFK: 'Norfolk Island', NRU: 'Nauru', DJI: 'Djibouti', SPM: 'Saint Pierre & Miquelon',
  PLW: 'Palau', MNP: 'Northern Mariana Islands', TUV: 'Tuvalu', FLK: 'Falkland Islands', KIR: 'Kiribati',
  STP: 'São Tomé & Príncipe', SGP: 'Singapore', UZB: 'Uzbekistan', MHL: 'Marshall Islands', MSR: 'Montserrat',
  HYROX: 'HYROX', HRX: 'HYROX', SHN: 'China', Unknown: 'Unknown'
};

/* Every recognised nationality code. Tokens outside this set (stray first names,
 * literal "Comma"/"Double Quote", '(NED' fragments) are source-data artefacts and
 * are treated as Unknown when displaying. */
const KNOWN_CODES = new Set(Object.keys(COUNTRIES));

const GENDERS = { male: 'Men', female: 'Women', mixed: 'Mixed' };
const COMP_TYPES = ['Individual', 'Doubles', 'Relay', 'Adaptive'];
const TIERS = ['Open', 'Pro'];
const LIMITS = ['25', '50', '100', 'all'];

const state = { rows: [], meta: null, filters: { ...DEFAULTS } };

const pathname = window.location.pathname;
const page = pathname.includes('leaderboard') ? 'leaderboard'
  : pathname.includes('races') ? 'races'
  : pathname.includes('admin') ? 'policy' : 'home';

/* ---------- helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const clean = (v) => (v == null || v === '' ? 'Unknown' : String(v));

function countryName(code) {
  return clean(code).split(',').map((c) => {
    const key = c.trim();
    return COUNTRIES[key] || key;
  }).filter((v, i, arr) => arr.indexOf(v) === i).join(' / ');
}
function genderName(g) { return GENDERS[clean(g).toLowerCase()] || clean(g); }

function formatTime(total) {
  const s = Number(total);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

function uniqueSorted(field) {
  return [...new Set(state.rows.map((r) => clean(r[field])))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/* ---------- URL sync ---------- */
function readQuery() {
  const q = new URLSearchParams(window.location.search);
  Object.keys(DEFAULTS).forEach((k) => { if (q.has(k)) state.filters[k] = q.get(k); });
}
function writeQuery() {
  const q = new URLSearchParams();
  Object.entries(state.filters).forEach(([k, v]) => { if (v !== DEFAULTS[k]) q.set(k, v); });
  window.history.replaceState(null, '', `${window.location.pathname}${q.size ? `?${q}` : ''}`);
}

/* ---------- filtering ---------- */
function matches(row, includeRace = true) {
  const f = state.filters;
  if (includeRace && f.race !== 'all' && row.race !== f.race) return false;
  if (f.gender !== 'all' && row.gender !== f.gender) return false;
  if (f.age !== 'all' && row.ageGroup !== f.age) return false;
  if (f.nationality !== 'all' && row.nationality !== f.nationality) return false;
  if (f.comp !== 'all' && row.compType !== f.comp) return false;
  if (f.tier !== 'all' && row.tier !== f.tier) return false;
  return true;
}

/* One fastest result per athlete/team, for the all-time leaderboard. */
function bestPerAthlete(rows) {
  const best = new Map();
  for (const row of rows) {
    const key = `${row.firstName}|${row.lastName}|${row.nationality}|${row.compType}|${row.tier}`.toLowerCase();
    const prev = best.get(key);
    if (!prev || row.seconds < prev.seconds) best.set(key, row);
  }
  return [...best.values()].sort((a, b) => a.seconds - b.seconds);
}

/* ---------- notice ---------- */
function renderNotice() {
  const el = $('#datasetNotice');
  if (!el || !state.meta) return;
  const date = state.meta.lastUpdated
    ? new Date(state.meta.lastUpdated).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'n/a';
  el.className = 'notice ready';
  el.textContent = `${state.meta.sourceLabel} · Updated ${date} · ${state.meta.coverage}`;
}

/* ---------- home dashboard ---------- */
function renderHome() {
  const grid = $('#statGrid');
  if (!grid || !state.meta) return;
  const rows = state.rows;
  const events = state.meta.totalEvents || new Set(rows.map((r) => r.race)).size;
  const countries = new Set();
  rows.forEach((r) => r.nationality.split(',').forEach((c) => { if (c.trim() && c.trim() !== 'Unknown') countries.add(c.trim()); }));
  const stats = [
    { n: rows.length.toLocaleString(), l: 'Verified finishes' },
    { n: events.toLocaleString(), l: 'Events worldwide' },
    { n: countries.size.toLocaleString(), l: 'Nations represented' },
    { n: (state.meta.years && state.meta.years.length) ? `${state.meta.years[0]}–${state.meta.years[state.meta.years.length - 1]}` : '—', l: 'Seasons covered' },
  ];
  grid.replaceChildren();
  stats.forEach((s) => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `<span class="stat-number">${s.n}</span><span class="stat-label">${s.l}</span>`;
    grid.append(card);
  });

  // Fastest men / women individual pro headline
  const fastest = $('#fastestList');
  if (fastest) {
    const picks = [
      ['Fastest man (Pro)', rows.filter((r) => r.compType === 'Individual' && r.tier === 'Pro' && r.gender === 'male')],
      ['Fastest woman (Pro)', rows.filter((r) => r.compType === 'Individual' && r.tier === 'Pro' && r.gender === 'female')],
      ['Fastest doubles (Pro)', rows.filter((r) => r.compType === 'Doubles' && r.tier === 'Pro')],
    ];
    fastest.replaceChildren();
    picks.forEach(([label, list]) => {
      if (!list.length) return;
      const top = list.reduce((a, b) => (a.seconds <= b.seconds ? a : b));
      const li = document.createElement('li');
      li.innerHTML = `<span class="fl-label">${label}</span>`
        + `<span class="fl-name">${top.firstName} ${top.lastName}</span>`
        + `<span class="fl-meta">${top.race} · ${countryName(top.nationality)}</span>`
        + `<span class="pill ${top.tier.toLowerCase()}">${formatTime(top.seconds)}</span>`;
      fastest.append(li);
    });
  }
}

/* ---------- filter controls ---------- */
function buildSelect(el, values, allLabel, display = (v) => v) {
  if (!el) return;
  const key = el.dataset.filter;
  const current = state.filters[key];
  el.replaceChildren();
  el.add(new Option(`All ${allLabel}`, 'all'));
  values.forEach((v) => el.add(new Option(display(v), v)));
  el.value = (current === 'all' || values.includes(current)) ? current : 'all';
}

function buildFilters() {
  buildSelect($('#raceFilter'), uniqueSorted('race'), 'events');
  buildSelect($('#genderFilter'), uniqueSorted('gender'), 'genders', genderName);
  buildSelect($('#ageFilter'), uniqueSorted('ageGroup'), 'age groups');
  buildSelect($('#nationalityFilter'),
    uniqueSorted('nationality').filter((v) => v !== 'Unknown'),
    'nations', countryName);

  const comp = $('#compFilter');
  if (comp) comp.value = COMP_TYPES.includes(state.filters.comp) ? state.filters.comp : 'all';
  const tier = $('#tierFilter');
  if (tier) tier.value = TIERS.includes(state.filters.tier) ? state.filters.tier : 'all';
  const limit = $('#limitFilter');
  if (limit) limit.value = LIMITS.includes(state.filters.limit) ? state.filters.limit : '50';

  document.querySelectorAll('[data-filter]').forEach((el) => {
    el.addEventListener('change', () => {
      state.filters[el.dataset.filter] = el.value;
      writeQuery();
      render();
    });
  });
  const clearBtn = $('#clearFilters');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    state.filters = { ...DEFAULTS };
    document.querySelectorAll('[data-filter]').forEach((el) => { el.value = state.filters[el.dataset.filter]; });
    writeQuery();
    render();
  });
}

/* ---------- table rendering ---------- */
function categoryLabel(row) { return `${row.compType} · ${row.tier}`; }

function renderTable(body, rows, showRace) {
  body.replaceChildren();
  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 8;
    td.className = 'empty';
    td.textContent = 'No finishes match these filters.';
    tr.append(td);
    body.append(tr);
    return;
  }
  const frag = document.createDocumentFragment();
  rows.forEach((row, i) => {
    const tr = document.createElement('tr');
    const contextCell = showRace ? `<td>${row.race}</td>` : `<td>${categoryLabel(row)}</td>`;
    tr.innerHTML = [
      `<td class="rank">${i + 1}</td>`,
      `<td class="athlete">${row.firstName} ${row.lastName}</td>`,
      contextCell,
      `<td>${countryName(row.nationality)}</td>`,
      `<td>${row.ageGroup}</td>`,
      `<td>${genderName(row.gender)}</td>`,
      showRace ? `<td>${categoryLabel(row)}</td>` : `<td class="hide-sm">${row.year || ''}</td>`,
      `<td><span class="pill ${row.tier.toLowerCase()}">${formatTime(row.seconds)}</span></td>`,
    ].join('');
    frag.append(tr);
  });
  body.append(frag);
}

function activeLabel() {
  const f = state.filters;
  const bits = [];
  if (f.race !== 'all') bits.push(f.race);
  if (f.comp !== 'all') bits.push(f.comp);
  if (f.tier !== 'all') bits.push(f.tier);
  if (f.gender !== 'all') bits.push(genderName(f.gender));
  if (f.age !== 'all') bits.push(`ages ${f.age}`);
  if (f.nationality !== 'all') bits.push(countryName(f.nationality));
  return bits.join(' · ');
}

function renderLeaderboard() {
  const filtered = state.rows.filter((r) => matches(r));
  const best = bestPerAthlete(filtered);
  const limit = state.filters.limit === 'all' ? best.length : Number(state.filters.limit);
  const label = activeLabel();
  $('#title').textContent = best.length ? `Top ${Math.min(limit, best.length).toLocaleString()} all-time${label ? ` · ${label}` : ''}` : 'No matching finishes';
  const raceCount = new Set(filtered.map((r) => r.race)).size;
  $('#resultsSummary').textContent = `${best.length.toLocaleString()} athletes/teams across ${raceCount.toLocaleString()} events (best result each).`;
  renderTable($('#rankingBody'), best.slice(0, limit), true);
}

function renderRaces() {
  const race = state.filters.race;
  const title = $('#raceResultsTitle');
  const summary = $('#raceResultsSummary');
  if (race === 'all') {
    title.textContent = 'Choose an event';
    summary.textContent = 'Pick an event above to rank its finishers.';
    renderTable($('#raceResultsBody'), [], false);
    return;
  }
  const rows = state.rows.filter((r) => r.race === race && matches(r, false)).sort((a, b) => a.seconds - b.seconds);
  title.textContent = race;
  const label = activeLabel().replace(race, '').replace(/^ · /, '');
  summary.textContent = `${rows.length.toLocaleString()} finishers${label ? ` · ${label}` : ''}, ranked by time.`;
  renderTable($('#raceResultsBody'), rows, false);
}

/* ---------- events list (newest first) ---------- */
/* Each unique event with its year and finisher count, sorted newest -> oldest. */
function eventSummaries() {
  const map = new Map();
  for (const r of state.rows) {
    let e = map.get(r.race);
    if (!e) { e = { race: r.race, year: r.year || '', count: 0 }; map.set(r.race, e); }
    e.count += 1;
  }
  return [...map.values()].sort((a, b) => {
    const ya = Number(a.year) || 0;
    const yb = Number(b.year) || 0;
    if (yb !== ya) return yb - ya;
    return a.race.localeCompare(b.race, undefined, { numeric: true });
  });
}

function renderEventList() {
  const list = $('#eventList');
  if (!list) return;
  const events = eventSummaries();
  const frag = document.createDocumentFragment();
  events.forEach((e) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'event-item';
    if (e.race === state.filters.race) btn.classList.add('active');
    btn.dataset.race = e.race;
    btn.innerHTML = `<span class="event-name">${e.race}</span>`
      + `<span class="event-meta">${e.year ? `${e.year} · ` : ''}${e.count.toLocaleString()} finishers</span>`;
    btn.addEventListener('click', () => selectEvent(e.race));
    li.append(btn);
    frag.append(li);
  });
  list.replaceChildren(frag);
}

function selectEvent(race) {
  state.filters.race = race;
  const raceFilter = $('#raceFilter');
  if (raceFilter) raceFilter.value = race;
  document.querySelectorAll('#eventList .event-item').forEach((b) => {
    b.classList.toggle('active', b.dataset.race === race);
  });
  writeQuery();
  renderRaces();
  $('#raceResultsTitle')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- global athlete search ---------- */
function renderSearch() {
  const body = $('#searchBody');
  const count = $('#searchCount');
  if (!body) return;
  const term = ($('#nameSearch')?.value || '').trim().toLowerCase();
  if (term.length < 2) {
    count.textContent = '';
    renderTable(body, [], true);
    const tr = body.querySelector('td.empty');
    if (tr) tr.textContent = 'Type at least two letters to search.';
    return;
  }
  const matched = state.rows
    .filter((r) => `${r.firstName} ${r.lastName}`.toLowerCase().includes(term))
    .sort((a, b) => a.seconds - b.seconds);
  const capped = matched.slice(0, 200);
  count.textContent = matched.length
    ? `${matched.length.toLocaleString()} matching finishes${matched.length > capped.length ? ` · showing fastest ${capped.length}` : ''}`
    : 'No athletes match that name.';
  renderTable(body, capped, true);
}

let searchTimer = null;
function wireEventsPage() {
  renderEventList();

  const tabBrowse = $('#tabBrowse');
  const tabSearch = $('#tabSearch');
  const eventsPanel = $('#eventsPanel');
  const searchPanel = $('#searchPanel');
  const setTab = (mode) => {
    const search = mode === 'search';
    tabSearch.classList.toggle('active', search);
    tabBrowse.classList.toggle('active', !search);
    tabSearch.setAttribute('aria-selected', String(search));
    tabBrowse.setAttribute('aria-selected', String(!search));
    searchPanel.hidden = !search;
    eventsPanel.hidden = search;
    if (search) { $('#nameSearch')?.focus(); renderSearch(); }
  };
  tabBrowse?.addEventListener('click', () => setTab('browse'));
  tabSearch?.addEventListener('click', () => setTab('search'));

  const nameSearch = $('#nameSearch');
  nameSearch?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderSearch, 150);
  });
}

function render() {
  if (page === 'home') renderHome();
  if (page === 'leaderboard') renderLeaderboard();
  if (page === 'races') renderRaces();
}

/* ---------- load ---------- */
async function decompress(response) {
  if (response.headers.get('content-encoding')) return response.json();
  if (!('DecompressionStream' in window) || !response.body) {
    throw new Error('This browser cannot read the compressed cache.');
  }
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).json();
}

async function init() {
  try {
    const [dataRes, metaRes] = await Promise.all([
      fetch(DATASET_URL, { cache: 'no-cache' }),
      fetch(METADATA_URL, { cache: 'no-cache' }),
    ]);
    if (!dataRes.ok) throw new Error('Dataset failed to load.');
    state.rows = await decompress(dataRes);
    state.meta = metaRes.ok ? await metaRes.json() : { sourceLabel: 'Cached results', coverage: `${state.rows.length} rows` };
    readQuery();
    renderNotice();
    if (page === 'policy') return;
    if (page === 'home') { renderHome(); return; }
    buildFilters();
    if (page === 'races') wireEventsPage();
    render();
  } catch (err) {
    const notice = $('#datasetNotice');
    if (notice) { notice.className = 'notice error'; notice.textContent = 'Unable to load the results cache.'; }
    console.error(err);
  }
}

init();
