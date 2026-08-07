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

/* Build a display name for a result row.
 * Individuals show "First Last". Doubles/Relay rows pack every teammate into the
 * firstName/lastName fields (comma-separated, sometimes glued with a stray
 * "Member" token), so we split those apart and join partners with " & ". */
function splitMembers(raw) {
  return String(raw || '')
    .split(',')
    // Undo the "MemberX" gluing artefact: "Alliche MemberMartin" -> two names.
    .flatMap((part) => part.split(/\s*Member(?=[A-ZÀ-Þ])/))
    .map((p) => p.replace(/\bMember\b/gi, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}
function displayName(row) {
  if (row.compType === 'Doubles' || row.compType === 'Relay') {
    const members = [...splitMembers(row.firstName), ...splitMembers(row.lastName)];
    if (members.length) return members.join(' & ');
  }
  return `${row.firstName} ${row.lastName}`.trim();
}
/* Lowercased searchable text: full name plus split team members. */
function searchName(row) {
  return `${row.firstName} ${row.lastName} ${displayName(row)}`.toLowerCase();
}

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
        + `<span class="fl-name">${escapeHtml(displayName(top))}</span>`
        + `<span class="fl-meta">${escapeHtml(top.race)} · ${countryName(top.nationality)}</span>`
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

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
    const contextCell = showRace ? `<td>${escapeHtml(row.race)}</td>` : `<td>${categoryLabel(row)}</td>`;
    tr.innerHTML = [
      `<td class="rank">${i + 1}</td>`,
      `<td class="athlete"><button type="button" class="athlete-link">${escapeHtml(displayName(row))}</button></td>`,
      contextCell,
      `<td>${countryName(row.nationality)}</td>`,
      `<td>${escapeHtml(row.ageGroup)}</td>`,
      `<td>${genderName(row.gender)}</td>`,
      showRace ? `<td>${categoryLabel(row)}</td>` : `<td class="hide-sm">${escapeHtml(row.year || '')}</td>`,
      `<td><span class="pill ${row.tier.toLowerCase()}">${formatTime(row.seconds)}</span></td>`,
    ].join('');
    tr.querySelector('.athlete-link').addEventListener('click', () => openAthleteProfile(row));
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
/* Each unique event with its HYROX season, year and finisher count.
 * The pyrox source has no calendar date, so season (S1 2018 -> S9 2026) is the
 * truest chronological signal; we sort by season desc, then year desc. */
function eventSummaries() {
  const map = new Map();
  for (const r of state.rows) {
    let e = map.get(r.race);
    if (!e) { e = { race: r.race, year: r.year || '', season: Number(r.season) || 0, count: 0 }; map.set(r.race, e); }
    e.count += 1;
  }
  return [...map.values()].sort((a, b) => {
    if (b.season !== a.season) return b.season - a.season;
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
    const tags = [e.season ? `Season ${e.season}` : '', e.year].filter(Boolean).join(' · ');
    btn.innerHTML = `<span class="event-name">${e.race}</span>`
      + `<span class="event-meta">${tags ? `${tags} · ` : ''}${e.count.toLocaleString()} finishers</span>`;
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
const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/;
function renderSearch() {
  const body = $('#searchBody');
  const count = $('#searchCount');
  if (!body) return;
  const term = ($('#nameSearch')?.value || '').trim().toLowerCase();
  // A single CJK/Kana/Hangul character is a valid query; Latin needs two letters.
  const minLen = CJK_RE.test(term) ? 1 : 2;
  if ([...term].length < minLen) {
    count.textContent = '';
    renderTable(body, [], true);
    const tr = body.querySelector('td.empty');
    if (tr) tr.textContent = 'Type a name to search (one character for CJK, two letters otherwise).';
    return;
  }
  const matched = state.rows
    .filter((r) => searchName(r).includes(term))
    .sort((a, b) => a.seconds - b.seconds);
  const capped = matched.slice(0, 200);
  count.textContent = matched.length
    ? `${matched.length.toLocaleString()} matching finishes${matched.length > capped.length ? ` · showing fastest ${capped.length}` : ''}`
    : 'No athletes match that name.';
  renderTable(body, capped, true);
}

/* ---------- athlete profile ---------- */
/* Identity key for grouping one athlete's results across events. The source has
 * no athlete id, so we key on name + gender (+ competition) and accept that rare
 * namesakes may merge. Team rows keep their combined name so partners stay together. */
function athleteKey(row) {
  return `${row.firstName}|${row.lastName}|${row.gender}|${row.compType}`.toLowerCase();
}

function ensureProfileModal() {
  let modal = $('#athleteModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'athleteModal';
  modal.className = 'modal-overlay';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="athleteModalName">
      <button type="button" class="modal-close" aria-label="Close">×</button>
      <p class="eyebrow">Athlete profile</p>
      <h2 id="athleteModalName"></h2>
      <p id="athleteModalMeta" class="muted"></p>
      <div id="athleteModalStats" class="profile-stats"></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Event</th><th>Season</th><th>Category</th><th>Time</th><th>Change</th></tr></thead>
          <tbody id="athleteModalBody"></tbody>
        </table>
      </div>
    </div>`;
  document.body.append(modal);
  const close = () => { modal.hidden = true; };
  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  return modal;
}

function openAthleteProfile(row) {
  const modal = ensureProfileModal();
  const key = athleteKey(row);
  // Chronological history: season then year ascending, so trends read oldest -> newest.
  const history = state.rows
    .filter((r) => athleteKey(r) === key)
    .sort((a, b) => (Number(a.season) || 0) - (Number(b.season) || 0)
      || (Number(a.year) || 0) - (Number(b.year) || 0)
      || b.seconds - a.seconds);

  $('#athleteModalName').textContent = displayName(row);
  const nations = countryName(row.nationality);
  $('#athleteModalMeta').textContent = [
    `${row.compType} · ${row.tier}`,
    genderName(row.gender),
    nations !== 'Unknown' ? nations : null,
    `${history.length} race${history.length === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' · ');

  const times = history.map((r) => r.seconds);
  const best = Math.min(...times);
  const worst = Math.max(...times);
  const first = times[0];
  const last = times[times.length - 1];
  const delta = last - first; // negative = faster (improved)
  const stats = $('#athleteModalStats');
  const trend = history.length < 2 ? 'Single race'
    : delta < 0 ? `Improved ${formatTime(-delta)} overall`
    : delta > 0 ? `Slower ${formatTime(delta)} overall`
    : 'No overall change';
  stats.innerHTML = [
    `<div class="pstat"><span class="pstat-n">${formatTime(best)}</span><span class="pstat-l">Personal best</span></div>`,
    `<div class="pstat"><span class="pstat-n">${formatTime(worst)}</span><span class="pstat-l">Slowest</span></div>`,
    `<div class="pstat"><span class="pstat-n ${delta < 0 ? 'up' : delta > 0 ? 'down' : ''}">${trend}</span><span class="pstat-l">First → latest</span></div>`,
  ].join('');

  const body = $('#athleteModalBody');
  body.replaceChildren();
  const frag = document.createDocumentFragment();
  history.forEach((r, i) => {
    const prev = i > 0 ? history[i - 1].seconds : null;
    let change = '<span class="muted">—</span>';
    if (prev != null) {
      const d = r.seconds - prev; // negative = faster than previous
      change = d === 0 ? '<span class="muted">±0</span>'
        : d < 0 ? `<span class="chg up">▼ ${formatTime(-d)}</span>`
        : `<span class="chg down">▲ ${formatTime(d)}</span>`;
    }
    const isBest = r.seconds === best;
    const tr = document.createElement('tr');
    tr.innerHTML = [
      `<td class="rank">${i + 1}</td>`,
      `<td>${escapeHtml(r.race)}</td>`,
      `<td>${r.season ? `S${r.season}` : ''} ${escapeHtml(r.year || '')}</td>`,
      `<td>${r.compType} · ${r.tier}</td>`,
      `<td><span class="pill ${r.tier.toLowerCase()}">${formatTime(r.seconds)}</span>${isBest ? ' <span class="pb-tag">PB</span>' : ''}</td>`,
      `<td>${change}</td>`,
    ].join('');
    frag.append(tr);
  });
  body.append(frag);
  modal.hidden = false;
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
