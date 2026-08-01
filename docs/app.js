const datasetUrl = './athletes.json';

let athletes = [];
let filterState = {
  race: 'all',
  division: 'all',
  gender: 'all',
  age: 'all',
  nationality: 'all',
  mode: 'all'
};

const elements = {
  race: document.querySelector('#raceFilter'),
  division: document.querySelector('#divisionFilter'),
  gender: document.querySelector('#genderFilter'),
  age: document.querySelector('#ageFilter'),
  nationality: document.querySelector('#nationalityFilter'),
  mode: document.querySelector('#modeFilter'),
  title: document.querySelector('#title'),
  body: document.querySelector('#rankingBody')
};

function loadDataset() {
  return fetch(datasetUrl)
    .then((res) => res.json())
    .then((data) => {
      athletes = data;
      buildFilters();
      render();
    });
}

function buildFilters() {
  const races = ['all', ...new Set(athletes.map((a) => a.race))].sort();
  const divisions = ['all', ...new Set(athletes.map((a) => a.division))].sort();
  const genders = ['all', ...new Set(athletes.map((a) => a.gender))].sort();
  const ages = ['all', ...new Set(athletes.map((a) => a.ageGroup))].sort();
  const nationals = ['all', ...new Set(athletes.map((a) => a.nationality))].sort();

  populateSelect(elements.race, races);
  populateSelect(elements.division, divisions);
  populateSelect(elements.gender, genders);
  populateSelect(elements.age, ages);
  populateSelect(elements.nationality, nationals);
  bindEvents();
}

function populateSelect(element, values) {
  element.innerHTML = values
    .map((value) => `<option value="${value}">${value === 'all' ? 'All' : value}</option>`)
    .join('');
}

function bindEvents() {
  Object.entries(elements).forEach(([key, el]) => {
    if (key === 'title' || key === 'body') return;
    el.addEventListener('change', (event) => {
      filterState[key.replace('Filter', '').replace('age', 'age').replace('nationality', 'nationality')] = event.target.value;
      render();
    });
  });
}

function getModeLabel(division) {
  if (division.toLowerCase().includes('pro')) return 'Pro';
  return 'Open';
}

function isSolo(division) {
  return !division.toLowerCase().includes('relay') && !division.toLowerCase().includes('doubles') && !division.toLowerCase().includes('adaptive');
}

function computeRankings() {
  const filtered = athletes.filter((record) => {
    if (filterState.race !== 'all' && record.race !== filterState.race) return false;
    if (filterState.division !== 'all' && record.division !== filterState.division) return false;
    if (filterState.gender !== 'all' && record.gender !== filterState.gender) return false;
    if (filterState.age !== 'all' && record.ageGroup !== filterState.age) return false;
    if (filterState.nationality !== 'all' && record.nationality !== filterState.nationality) return false;

    const mode = getModeLabel(record.division);
    if (filterState.mode === 'solo' && !isSolo(record.division)) return false;
    if (filterState.mode === 'open' && mode !== 'Open') return false;
    if (filterState.mode === 'pro' && mode !== 'Pro') return false;

    return true;
  });

  const bestByAthlete = new Map();

  filtered.forEach((record) => {
    const key = `${record.firstName} ${record.lastName} ${record.nationality} ${record.gender} ${record.ageGroup}`;
    const current = bestByAthlete.get(key);
    if (!current || record.seconds < current.seconds) {
      bestByAthlete.set(key, record);
    }
  });

  return [...bestByAthlete.values()]
    .sort((a, b) => a.seconds - b.seconds)
    .slice(0, 10)
    .map((record, idx) => ({
      rank: idx + 1,
      ...record,
      mode: isSolo(record.division) ? 'Solo' : 'Team',
      category: getModeLabel(record.division)
    }));
}

function formatSeconds(total) {
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(Math.round(total % 60)).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function render() {
  const rows = computeRankings();
  elements.title.textContent = rows.length
    ? `Top ${rows.length} from the active filter set`
    : 'No results for the active filter set';

  elements.body.innerHTML = rows.map((row) => `
    <tr>
      <td>#${row.rank}</td>
      <td>${row.firstName} ${row.lastName}</td>
      <td>${row.nationality}</td>
      <td>${row.ageGroup}</td>
      <td>${row.gender}</td>
      <td>${row.division}</td>
      <td><span class="pill ${row.category.toLowerCase()}">${row.mode}</span></td>
      <td>${formatSeconds(row.seconds)}</td>
    </tr>
  `).join('');
}

loadDataset().catch((error) => {
  console.error(error);
  elements.body.innerHTML = '<tr><td colspan="8">Unable to load ranking data.</td></tr>';
});
