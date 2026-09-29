const API = 'https://william999.pythonanywhere.com/api';

const SAMPLE_STATS = {
  total: 1284,
  week: 37,
  programs: 46,
  hidden: 18
};

const ATTENTION = [
  { type: 'Request', title: 'CSC 402 Compiler Construction is missing, 300 level asked twice', meta: 'Open 4 days / 2 students waiting' },
  { type: 'Upload', title: 'PHY 205 submitted as a past question with no paper attached', meta: 'Filed by a second year / 1 hour ago' },
  { type: 'Account', title: 'Three sign-ups from one address on the same morning', meta: 'Flagged by the pattern check' }
];

const THIN = [
  { ref: 'CSC / 400', title: 'Computer Science 400 level', meta: '11 of 24 courses have material', foot: '13 courses empty' },
  { ref: 'MTH / 300', title: 'Mathematics 300 level', meta: '4 of 19 courses have material', foot: '15 courses empty' },
  { ref: 'ACC / 200', title: 'Accounting 200 level', meta: '6 of 17 courses have material', foot: '11 courses empty' },
  { ref: 'PHY / 100', title: 'Physics 100 level', meta: '3 of 14 courses have material', foot: '11 courses empty' }
];

const elements = {
  statTotal: document.getElementById('stat-total'),
  statWeek: document.getElementById('stat-week'),
  statPrograms: document.getElementById('stat-programs'),
  statHidden: document.getElementById('stat-hidden'),
  attentionLine: document.getElementById('attention-line'),
  attentionList: document.getElementById('attention-list'),
  coverage: document.getElementById('coverage-grid'),
  logout: document.getElementById('logout-btn')
};

function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function setStats(stats) {
  elements.statTotal.textContent = String(stats.total);
  elements.statWeek.textContent = String(stats.week);
  elements.statPrograms.textContent = String(stats.programs);
  elements.statHidden.textContent = String(stats.hidden);
}

function buildAttentionRow(item) {
  const row = makeElement('a', 'activity-row');
  row.href = 'materials.html';

  const call = makeElement('div', 'activity-row__call');
  call.appendChild(makeElement('span', 'activity-row__type', item.type));
  call.appendChild(makeElement('span', '', 'Needs review'));
  row.appendChild(call);

  row.appendChild(makeElement('p', 'activity-row__title', item.title));
  row.appendChild(makeElement('p', 'activity-row__meta', item.meta));
  return row;
}

function buildCoverageCard(item) {
  const card = makeElement('article', 'resource-card');

  const top = makeElement('div', 'resource-card__top');
  top.appendChild(makeElement('span', 'resource-card__pill-wrap', 'Thin'));
  top.appendChild(makeElement('span', '', item.ref));
  card.appendChild(top);

  const body = makeElement('div', 'resource-card__body');
  body.appendChild(makeElement('h3', 'resource-card__title', item.title));
  body.appendChild(makeElement('p', 'resource-card__ref', item.meta));
  card.appendChild(body);

  const foot = makeElement('div', 'resource-card__foot');
  foot.appendChild(makeElement('span', '', item.foot));
  card.appendChild(foot);
  return card;
}

function renderAttention() {
  elements.attentionLine.textContent = `${ATTENTION.length} open, oldest 4 days`;
  elements.attentionList.replaceChildren(...ATTENTION.map(buildAttentionRow));
}

function renderCoverage() {
  elements.coverage.replaceChildren(...THIN.map(buildCoverageCard));
}

async function loadStats() {
  const token = sessionStorage.getItem('lumina_access_token');
  try {
    const response = await fetch(`${API}/materials/stats/`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!response.ok) {
      throw new Error(`stats responded ${response.status}`);
    }
    const data = await response.json();
    setStats({
      total: data.total_materials || 0,
      week: data.materials_this_week || 0,
      programs: data.program_count || 0,
      hidden: data.hidden_materials || 0
    });
  } catch (error) {
    console.error('Could not read the library stats, showing the sample figures instead.', error);
  }
}

function signOut() {
  sessionStorage.removeItem('lumina_access_token');
  sessionStorage.removeItem('lumina_refresh_token');
  window.location.href = '/login.html';
}

setStats(SAMPLE_STATS);
renderAttention();
renderCoverage();
loadStats();
elements.logout.addEventListener('click', signOut);
