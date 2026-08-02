const datasetUrl = './athletes.json';
const metadataUrl = './dataset-meta.json';
const defaults = { race: 'all', division: 'all', gender: 'all', age: 'all', nationality: 'all', mode: 'all', limit: '10' };
let athletes = [];
let metadata = null;
let filterState = { ...defaults };

const pathname = window.location.pathname;
const pageType = pathname.includes('races.html') ? 'races' : pathname.includes('admin.html') ? 'policy' : pathname.includes('leaderboard.html') ? 'leaderboard' : 'home';

function elements() {
  return {
    race: document.querySelector('#raceFilter'), division: document.querySelector('#divisionFilter'), gender: document.querySelector('#genderFilter'),
    age: document.querySelector('#ageFilter'), nationality: document.querySelector('#nationalityFilter'), mode: document.querySelector('#modeFilter'), limit: document.querySelector('#limitFilter'),
    leaderboardTitle: document.querySelector('#title'), leaderboardSummary: document.querySelector('#resultsSummary'), leaderboardBody: document.querySelector('#rankingBody'),
    raceTitle: document.querySelector('#raceResultsTitle'), raceSummary: document.querySelector('#raceResultsSummary'), raceBody: document.querySelector('#raceResultsBody'),
    notice: document.querySelector('#datasetNotice'), clear: document.querySelector('#clearFilters')
  };
}

function text(value) { return value == null || value === '' ? 'Unknown' : String(value); }
function classification(division) {
  const value = text(division).toLowerCase();
  return { isSolo: !/(doubles|relay|adaptive)/.test(value), level: value.includes('pro') ? 'Pro' : 'Open' };
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
function writeOptions(select, values, label) {
  if (!select) return;
  const current = filterState[select.id.replace('Filter', '').replace('nationality', 'nationality').replace('division', 'division').replace('gender', 'gender').replace('race', 'race').replace('age', 'age')];
  select.replaceChildren();
  const all = new Option(`All ${label}`, 'all'); select.add(all);
  values.forEach((value) => select.add(new Option(value, value)));
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
  writeOptions(el.gender, uniqueValues('gender'), 'genders'); writeOptions(el.age, uniqueValues('ageGroup'), 'age groups'); writeOptions(el.nationality, uniqueValues('nationality'), 'nationalities');
  if (el.mode) el.mode.value = ['all', 'solo', 'open', 'pro'].includes(filterState.mode) ? filterState.mode : 'all';
  if (el.limit) el.limit.value = ['10', '25', '50', 'all'].includes(filterState.limit) ? filterState.limit : '10';
  [el.race, el.division, el.gender, el.age, el.nationality, el.mode, el.limit].filter(Boolean).forEach((select) => {
    select.addEventListener('change', () => {
      const key = select.id === 'ageFilter' ? 'age' : select.id.replace('Filter', '');
      filterState[key] = select.value;
      updateQuery(); render();
    });
  });
  if (el.clear) el.clear.addEventListener('click', () => {
    filterState = { ...defaults };
    [el.race, el.division, el.gender, el.age, el.nationality, el.mode, el.limit].filter(Boolean).forEach((select) => { select.value = filterState[select.id === 'ageFilter' ? 'age' : select.id.replace('Filter', '')]; });
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
  return filterState.mode === 'all' || (filterState.mode === 'solo' && category.isSolo) || (filterState.mode === 'open' && category.level === 'Open') || (filterState.mode === 'pro' && category.level === 'Pro');
}
function allTimeResults() {
  const best = new Map();
  athletes.filter((row) => matches(row)).forEach((row) => {
    const key = [row.firstName, row.lastName, row.nationality, row.gender, row.ageGroup, row.division].join('|').toLowerCase();
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
    cell(row, result.nationality); cell(row, result.ageGroup); cell(row, result.gender); cell(row, result.division);
    if (!showRace) cell(row, `${category.isSolo ? 'Individual' : 'Team'} · ${category.level}`);
    const time = document.createElement('td'); const pill = document.createElement('span'); pill.className = `pill ${category.level.toLowerCase()}`; pill.textContent = formatSeconds(result.seconds); time.append(pill); row.append(time); body.append(row);
  });
}
function renderLeaderboard() {
  const el = elements(); const rows = allTimeResults(); const limit = filterState.limit === 'all' ? rows.length : Number(filterState.limit);
  el.leaderboardTitle.textContent = rows.length ? `Top ${Math.min(limit, rows.length)} all-time` : 'No matching finishes';
  el.leaderboardSummary.textContent = `${rows.length} athlete best${rows.length === 1 ? '' : 's'} across ${new Set(athletes.filter((row) => matches(row)).map((row) => row.race)).size} race${rows.length === 1 ? '' : 's'}.`;
  appendRows(el.leaderboardBody, rows.slice(0, limit), true);
}
function renderRace() {
  const el = elements(); const selectedRace = filterState.race === 'all' ? athletes[0]?.race : filterState.race;
  const rows = athletes.filter((row) => row.race === selectedRace && matches(row)).sort((a, b) => Number(a.seconds) - Number(b.seconds));
  el.raceTitle.textContent = selectedRace || 'No race available'; el.raceSummary.textContent = `${rows.length} matching finished result${rows.length === 1 ? '' : 's'} ranked by time.`;
  appendRows(el.raceBody, rows, false);
}
function render() { if (pageType === 'leaderboard') renderLeaderboard(); if (pageType === 'races') renderRace(); }
async function init() {
  try {
    const [dataResponse, metaResponse] = await Promise.all([fetch(datasetUrl, { cache: 'no-cache' }), fetch(metadataUrl, { cache: 'no-cache' })]);
    if (!dataResponse.ok) throw new Error('Dataset failed to load.');
    const source = await dataResponse.json(); athletes = (Array.isArray(source) ? source : source.results || []).filter(validRecord);
    metadata = metaResponse.ok ? await metaResponse.json() : { sourceLabel: 'Cached results', coverage: `${athletes.length} result rows` };
    readQuery(); writeNotice(); if (pageType === 'home' || pageType === 'policy') return; buildFilters(); render();
  } catch (error) {
    const notice = elements().notice; if (notice) { notice.className = 'notice error'; notice.textContent = 'Unable to load the cached dataset. Please try again later.'; }
    console.error(error);
  }
}
init();
