const datasetUrl = './athletes.json.gz';
const metadataUrl = './dataset-meta.json';
const defaults = { race: 'all', division: 'all', gender: 'all', age: 'all', nationality: 'all', format: 'all', tier: 'all', limit: '10' };
let athletes = [];
let metadata = null;
let filterState = { ...defaults };
const nationalityNames = { SIN: 'Singapore', MAS: 'Malaysia', INA: 'Indonesia', PHI: 'Philippines', GBR: 'United Kingdom', USA: 'United States', UAE: 'United Arab Emirates' };
const genderNames = { male: 'Men', female: 'Women', mixed: 'Mixed' };

const pathname = window.location.pathname;
const pageType = pathname.includes('races.html') ? 'races' : pathname.includes('admin.html') ? 'policy' : pathname.includes('leaderboard.html') ? 'leaderboard' : 'home';

function elements() {
  return {
    race: document.querySelector('#raceFilter'), division: document.querySelector('#divisionFilter'), gender: document.querySelector('#genderFilter'),
    age: document.querySelector('#ageFilter'), nationality: document.querySelector('#nationalityFilter'), format: document.querySelector('#formatFilter'), tier: document.querySelector('#tierFilter'), limit: document.querySelector('#limitFilter'),
    leaderboardTitle: document.querySelector('#title'), leaderboardSummary: document.querySelector('#resultsSummary'), leaderboardBody: document.querySelector('#rankingBody'),
    raceTitle: document.querySelector('#raceResultsTitle'), raceSummary: document.querySelector('#raceResultsSummary'), raceBody: document.querySelector('#raceResultsBody'),
    notice: document.querySelector('#datasetNotice'), clear: document.querySelector('#clearFilters')
  };
}

function text(value) { return value == null || value === '' ? 'Unknown' : String(value); }
function displayNationality(value) {
  return text(value).split(',').map((part) => {
    const code = part.trim();
    return nationalityNames[code] || code;
  }).join(', ');
}
function displayGender(value) { return genderNames[text(value).toLowerCase()] || text(value); }
function classification(division) {
  const value = text(division).toLowerCase();
  const format = value.includes('adaptive') ? 'Adaptive' : value.includes('relay') ? 'Relay' : value.includes('doubles') ? 'Doubles' : 'Individual';
  return { format, level: value.includes('pro') ? 'Pro' : 'Open' };
}
function validRecord(record) {
  return record && Number.isFinite(Number(record.seconds)) && Number(record.seconds) > 0 && ['race', 'division', 'gender', 'ageGroup', 'nationality', 'firstName', 'lastName'].every((field) => record[field] != null);
}
function formatSeconds(value) {
  const total = Number(value);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = Math.floor(total % 60);
  return `${hours ? `${hours}:` : ''}${String(minutes).padStart(hours ? 2 : 1, '0')}:${String(seconds).padStart(2, '0')}`;
}
function uniqueValues(field) { return [...new Set(athletes.map((row) => text(row[field])))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); }
function labelFor(field, value) { return value === 'all' ? `All ${field}` : value; }
function writeOptions(select, values, label, display = (value) => value) {
  if (!select) return;
  const key = select.id === 'ageFilter' ? 'age' : select.id.replace('Filter', '');
  const current = filterState[key];
  select.replaceChildren();
  const all = new Option(`All ${label}`, 'all'); select.add(all);
  values.forEach((value) => select.add(new Option(display(value), value)));
  select.value = values.includes(current) || current === 'all' ? current : 'all';
}
function readQuery() {
  const query = new URLSearchParams(window.location.search);
  Object.keys(defaults).forEach((key) => { if (query.has(key)) filterState[key] = query.get(key); });
}
function updateQuery() {
  const query = new URLSearchParams();
  Object.entries(filterState).forEach(([key, value]) => { if (value !== defaults[key]) query.set(key, value); });
  const url = `${window.location.pathname}${query.size ? `?${query}` : ''}`;
  window.history.replaceState(null, '', url);
}
function writeNotice() {
  const notice = elements().notice;
  if (!notice || !metadata) return;
  const date = metadata.lastUpdated ? new Date(metadata.lastUpdated).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'not recorded';
  notice.className = `notice ${metadata.source === 'demo' ? 'warning' : 'ready'}`;
  notice.textContent = `${metadata.sourceLabel || 'Cached results'} · Updated ${date} · ${metadata.coverage || `${athletes.length} cached finishers`}`;
}
function buildFilters() {
  const el = elements();
  writeOptions(el.race, uniqueValues('race'), 'races'); writeOptions(el.division, uniqueValues('division'), 'divisions');
  writeOptions(el.gender, uniqueValues('gender'), 'genders', displayGender); writeOptions(el.age, uniqueValues('ageGroup'), 'age groups'); writeOptions(el.nationality, uniqueValues('nationality'), 'nationalities', displayNationality);
  if (el.format) el.format.value = ['all', 'Individual', 'Doubles', 'Relay', 'Adaptive'].includes(filterState.format) ? filterState.format : 'all';
  if (el.tier) el.tier.value = ['all', 'Open', 'Pro'].includes(filterState.tier) ? filterState.tier : 'all';
  if (el.limit) el.limit.value = ['10', '25', '50', 'all'].includes(filterState.limit) ? filterState.limit : '10';
  [el.race, el.division, el.gender, el.age, el.nationality, el.format, el.tier, el.limit].filter(Boolean).forEach((select) => {
    select.addEventListener('change', () => {
      const key = select.id === 'ageFilter' ? 'age' : select.id.replace('Filter', '');
      filterState[key] = select.value;
      updateQuery(); render();
    });
  });
  if (el.clear) el.clear.addEventListener('click', () => {
    filterState = { ...defaults };
    [el.race, el.division, el.gender, el.age, el.nationality, el.format, el.tier, el.limit].filter(Boolean).forEach((select) => { select.value = filterState[select.id === 'ageFilter' ? 'age' : select.id.replace('Filter', '')]; });
    updateQuery(); render();
  });
}
function matches(record, includeRace = true) {
  if (includeRace && filterState.race !== 'all' && record.race !== filterState.race) return false;
  if (filterState.division !== 'all' && record.division !== filterState.division) return false;
  if (filterState.gender !== 'all' && record.gender !== filterState.gender) return false;
  if (filterState.age !== 'all' && record.ageGroup !== filterState.age) return false;
  if (filterState.nationality !== 'all' && record.nationality !== filterState.nationality) return false;
  const category = classification(record.division);
  if (filterState.format !== 'all' && category.format !== filterState.format) return false;
  return filterState.tier === 'all' || category.level === filterState.tier;
}
function allTimeResults() {
  const best = new Map();
  athletes.filter((row) => matches(row)).forEach((row) => {
    const key = row.sourceAthleteId || [row.firstName, row.lastName, row.nationality, row.gender].join('|').toLowerCase();
    if (!best.has(key) || Number(row.seconds) < Number(best.get(key).seconds)) best.set(key, row);
  });
  return [...best.values()].sort((a, b) => Number(a.seconds) - Number(b.seconds));
}
function cell(row, value, className = '') { const td = document.createElement('td'); td.textContent = value; if (className) td.className = className; row.append(td); }
function appendRows(body, rows, showRace) {
  body.replaceChildren();
  if (!rows.length) { const row = document.createElement('tr'); const cellEl = document.createElement('td'); cellEl.colSpan = showRace ? 8 : 8; cellEl.textContent = 'No completed results match these filters.'; row.append(cellEl); body.append(row); return; }
  rows.forEach((result, index) => {
    const row = document.createElement('tr'); const category = classification(result.division);
    cell(row, `#${index + 1}`, 'rank'); cell(row, `${result.firstName} ${result.lastName}`); if (showRace) cell(row, result.race);
    cell(row, displayNationality(result.nationality)); cell(row, result.ageGroup); cell(row, displayGender(result.gender)); cell(row, result.division);
    if (!showRace) cell(row, `${category.format} · ${category.level}`);
    const time = document.createElement('td'); const pill = document.createElement('span'); pill.className = `pill ${category.level.toLowerCase()}`; pill.textContent = formatSeconds(result.seconds); time.append(pill); row.append(time); body.append(row);
  });
}
function currentViewLabel() {
  const labels = [];
  if (filterState.race !== 'all') labels.push(filterState.race);
  if (filterState.format !== 'all') labels.push(filterState.format.toLowerCase());
  if (filterState.tier !== 'all') labels.push(filterState.tier);
  if (filterState.gender !== 'all') labels.push(displayGender(filterState.gender));
  if (filterState.age !== 'all') labels.push(`ages ${filterState.age}`);
  if (filterState.nationality !== 'all') labels.push(`from ${displayNationality(filterState.nationality)}`);
  if (filterState.division !== 'all') labels.push(filterState.division);
  return labels.join(' · ');
}
function renderLeaderboard() {
  const el = elements(); const rows = allTimeResults(); const limit = filterState.limit === 'all' ? rows.length : Number(filterState.limit);
  const view = currentViewLabel();
  el.leaderboardTitle.textContent = rows.length ? `Top ${Math.min(limit, rows.length)} all-time${view ? ` · ${view}` : ''}` : 'No matching finishes';
  el.leaderboardSummary.textContent = `${rows.length} athlete best${rows.length === 1 ? '' : 's'} across ${new Set(athletes.filter((row) => matches(row)).map((row) => row.race)).size} race${rows.length === 1 ? '' : 's'}.`;
  appendRows(el.leaderboardBody, rows.slice(0, limit), true);
}
function renderRace() {
  const el = elements(); const selectedRace = filterState.race;
  if (selectedRace === 'all') {
    el.raceTitle.textContent = 'Choose a race'; el.raceSummary.textContent = 'Select a race to rank its matching finishers.';
    appendRows(el.raceBody, [], false); return;
  }
  const rows = athletes.filter((row) => row.race === selectedRace && matches(row)).sort((a, b) => Number(a.seconds) - Number(b.seconds));
  el.raceTitle.textContent = selectedRace; el.raceSummary.textContent = `${rows.length} matching finished result${rows.length === 1 ? '' : 's'} ranked by time.`;
  appendRows(el.raceBody, rows, false);
}
function render() { if (pageType === 'leaderboard') renderLeaderboard(); if (pageType === 'races') renderRace(); }
async function init() {
  try {
    const [dataResponse, metaResponse] = await Promise.all([fetch(datasetUrl, { cache: 'no-cache' }), fetch(metadataUrl, { cache: 'no-cache' })]);
    if (!dataResponse.ok) throw new Error('Dataset failed to load.');
    const source = await compressedJson(dataResponse); athletes = (Array.isArray(source) ? source : source.results || []).filter(validRecord);
    metadata = metaResponse.ok ? await metaResponse.json() : { sourceLabel: 'Cached results', coverage: `${athletes.length} result rows` };
    readQuery(); writeNotice(); if (pageType === 'home' || pageType === 'policy') return; buildFilters(); render();
  } catch (error) {
    const notice = elements().notice; if (notice) { notice.className = 'notice error'; notice.textContent = 'Unable to load the cached dataset. Please try again later.'; }
    console.error(error);
  }
}

async function compressedJson(response) {
  const encoded = response.headers.get('content-encoding');
  if (!datasetUrl.endsWith('.gz') || encoded) return response.json();
  if (!('DecompressionStream' in window) || !response.body) throw new Error('This browser cannot read the compressed results cache.');
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).json();
}
init();
