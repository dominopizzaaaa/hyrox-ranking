const datasetUrl = './athletes.json';
const storageKey = 'hyrox-ranking-snapshot';

let athletes = [];
let filterState = {
  race: 'all',
  division: 'all',
  gender: 'all',
  age: 'all',
  nationality: 'all',
  mode: 'all'
};

const pageType = window.location.pathname.includes('races.html')
  ? 'races'
  : window.location.pathname.includes('admin.html')
    ? 'admin'
    : 'leaderboard';

function getElements() {
  return {
    race: document.querySelector('#raceFilter'),
    division: document.querySelector('#divisionFilter'),
    gender: document.querySelector('#genderFilter'),
    age: document.querySelector('#ageFilter'),
    nationality: document.querySelector('#nationalityFilter'),
    mode: document.querySelector('#modeFilter'),
    title: document.querySelector('#title'),
    body: document.querySelector('#rankingBody'),
    raceTable: document.querySelector('#raceResultsBody'),
    raceTitle: document.querySelector('#raceResultsTitle')
  };
}

function loadDataset() {
  return fetch(datasetUrl)
    .then((res) => res.json())
    .then((data) => {
      const stored = localStorage.getItem(storageKey);
      athletes = stored ? JSON.parse(stored) : data;
      buildFilters();
      if (pageType === 'races') renderRaceView();
      else renderLeaderBoard();
    });
}

function buildFilters() {
  const elements = getElements();
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
  if (!element) return;
  element.innerHTML = values
    .map((value) => `<option value="${value}">${value === 'all' ? 'All' : value}</option>`)
    .join('');
}

function bindEvents() {
  const elements = getElements();
  Object.entries(elements).forEach(([key, el]) => {
    if (!el || key === 'title' || key === 'body' || key === 'raceTable' || key === 'raceTitle') return;
    el.addEventListener('change', (event) => {
      const normalized = key === 'age' ? 'age' : key;
      filterState[normalized] = event.target.value;
      if (pageType === 'races') renderRaceView();
      else renderLeaderBoard();
    });
  });
}

function getModeLabel(division) {
  if (!division) return 'Open';
  return division.toLowerCase().includes('pro') ? 'Pro' : 'Open';
}

function isSolo(division) {
  if (!division) return true;
  const text = division.toLowerCase();
  return !text.includes('relay') && !text.includes('doubles') && !text.includes('adaptive');
}

function computeLeaderBoard() {
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
      tag: isSolo(record.division) ? 'Solo' : 'Team',
      category: getModeLabel(record.division)
    }));
}

function renderLeaderBoard() {
  const elements = getElements();
  const rows = computeLeaderBoard();
  if (elements.title) {
    elements.title.textContent = rows.length
      ? `Top ${rows.length} from the active filter set`
      : 'No results for the active filter set';
  }
  if (!elements.body) return;

  elements.body.innerHTML = rows.map((row) => `
    <tr>
      <td>#${row.rank}</td>
      <td>${row.firstName} ${row.lastName}</td>
      <td>${row.nationality}</td>
      <td>${row.ageGroup}</td>
      <td>${row.gender}</td>
      <td>${row.division}</td>
      <td><span class="pill ${row.category.toLowerCase()}">${row.tag}</span></td>
      <td>${formatSeconds(row.seconds)}</td>
    </tr>
  `).join('');
}

function renderRaceView() {
  const elements = getElements();
  if (!elements.raceTable || !elements.raceTitle) return;

  const selectedRace = filterState.race === 'all' ? athletes[0]?.race : filterState.race;
  const relevant = athletes.filter((record) => record.race === selectedRace);

  const grouped = relevant.sort((a, b) => a.seconds - b.seconds).map((record, idx) => ({
    rank: idx + 1,
    ...record,
    category: getModeLabel(record.division),
    tag: isSolo(record.division) ? 'Solo' : 'Team'
  }));

  elements.raceTitle.textContent = `${selectedRace || 'Race'} — public result ranks`;
  elements.raceTable.innerHTML = grouped.map((row) => `
    <tr>
      <td>#${row.rank}</td>
      <td>${row.firstName} ${row.lastName}</td>
      <td>${row.nationality}</td>
      <td>${row.ageGroup}</td>
      <td>${row.gender}</td>
      <td>${row.division}</td>
      <td><span class="pill ${row.category.toLowerCase()}">${row.tag}</span></td>
      <td>${formatSeconds(row.seconds)}</td>
    </tr>
  `).join('');
}

function formatSeconds(total) {
  const sec = Number(total) || 0;
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(Math.round(sec % 60)).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function bindAdminWorkflow() {
  const fileInput = document.querySelector('#snapshotFile');
  const previewArea = document.querySelector('#snapshotPreview');
  const applyButton = document.querySelector('#applySnapshot');
  const resetButton = document.querySelector('#resetSnapshot');

  if (!fileInput || !previewArea || !applyButton) return;

  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    previewArea.value = text;
    localStorage.setItem(storageKey, text);
  });

  applyButton.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(previewArea.value);
      localStorage.setItem(storageKey, JSON.stringify(parsed));
      alert('Snapshot preview applied in browser storage. Refresh the leaderboard page to see the new ranking data.');
    } catch (error) {
      alert('That snapshot is not valid JSON.');
    }
  });

  resetButton.addEventListener('click', () => {
    localStorage.removeItem(storageKey);
    previewArea.value = 'Reset to default snapshot in browser storage.';
    window.location.reload();
  });
}

function init() {
  if (pageType === 'admin') {
    bindAdminWorkflow();
    return;
  }

  loadDataset().catch((error) => {
    console.error(error);
    const elements = getElements();
    if (elements.body) {
      elements.body.innerHTML = '<tr><td colspan="8">Unable to load ranking data.</td></tr>';
    }
  });
}

init();
