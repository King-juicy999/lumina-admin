const API = 'http://localhost:8000/api';
const MATERIALS_URL = `${API}/materials/`;

const elements = {
  search: document.getElementById('search'),
  faculty: document.getElementById('faculty'),
  department: document.getElementById('department'),
  program: document.getElementById('program'),
  status: document.getElementById('status'),
  sort: document.getElementById('sort'),
  records: document.getElementById('records'),
  count: document.getElementById('results-count'),
  trail: document.getElementById('filter-trail'),
  empty: document.getElementById('empty-state'),
  emptyReset: document.getElementById('empty-reset'),
  logout: document.getElementById('logout-btn')
};

const BADGE_TONE = {
  'Lecture notes': 'material-badge--notes',
  'Past questions': 'material-badge--questions',
  'Textbook': '',
  'Tutorial': '',
  'Slides': ''
};

const CODE_SPLIT = /^([A-Z]+)(\d.*)$/;

const revealedUploaders = new Set();

function populateSelect(select, values, firstLabel, names) {
  const first = makeElement('option', '', firstLabel);
  first.value = 'all';
  select.replaceChildren(first);
  for (const value of values) {
    const option = makeElement('option', '', names ? labelFor(names, value) : value);
    option.value = value;
    select.appendChild(option);
  }
}

function populateFaculties() {
  populateSelect(elements.faculty, Object.keys(CASCADE), 'All faculties', FACULTY_NAMES);
}

function populateDepartments(faculty) {
  const departments = faculty === 'all' ? {} : CASCADE[faculty].departments;
  populateSelect(elements.department, Object.keys(departments), 'All departments', DEPARTMENT_NAMES);
}

function programsFor(department) {
  for (const data of Object.values(CASCADE)) {
    if (data.departments[department]) {
      return data.departments[department];
    }
  }
  return [];
}

function populatePrograms(department) {
  populateSelect(elements.program, programsFor(department), 'All programs', PROGRAM_NAMES);
}

function formatCourseCode(value) {
  return (value || '').trim().toUpperCase().replace(CODE_SPLIT, '$1 $2');
}

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

function buildTop(material) {
  const top = makeElement('div', 'resource-card__top');
  const wrap = makeElement('div', 'resource-card__pill-wrap');
  const tone = BADGE_TONE[material.material_type] || '';
  wrap.appendChild(makeElement('span', `material-badge ${tone}`.trim(), material.material_type));
  wrap.appendChild(makeElement('span', 'pill pill--live', 'Live'));
  top.appendChild(wrap);

  const ref = `${formatCourseCode(material.course_code)} · ${material.level || ''} Level`;
  top.appendChild(makeElement('span', '', ref));
  return top;
}

function buildFiling(material) {
  const line = makeElement('p', 'resource-card__meta');
  line.appendChild(makeElement('span', '', labelFor(FACULTY_NAMES, material.faculty)));

  const facultyLabel = labelFor(DEPARTMENT_NAMES, material.department);
  if (facultyLabel) {
    line.appendChild(document.createTextNode(' · '));
    line.appendChild(makeElement('span', '', facultyLabel));
  }

  const programLabel = labelFor(PROGRAM_NAMES, material.program_id);
  if (programLabel) {
    line.appendChild(document.createTextNode(' · '));
    line.appendChild(makeElement('span', '', programLabel));
  }

  line.appendChild(document.createTextNode(` · ${material.semester || ''} semester`));
  return line;
}

function buildUploaderRow(material) {
  const row = makeElement('p', 'resource-card__meta');
  row.appendChild(document.createTextNode('Filed by '));

  if (!material.is_anonymous) {
    row.appendChild(makeElement('span', 'resource-card__uploader', material.uploader_name || 'Unknown'));
    return row;
  }

  const revealed = revealedUploaders.has(material.id);
  if (revealed) {
    row.appendChild(makeElement('span', 'resource-card__uploader', material.uploader_real_name || 'Name unavailable'));
  } else {
    row.appendChild(makeElement('span', 'resource-card__uploader', 'Anonymous student'));
  }

  const toggle = makeElement('button', 'record-link', revealed ? 'Hide identity' : 'View who posted');
  toggle.type = 'button';
  toggle.dataset.reveal = String(material.id);
  row.appendChild(toggle);
  return row;
}

function buildBody(material) {
  const body = makeElement('div', 'resource-card__body');
  body.appendChild(makeElement('h3', 'resource-card__title', material.course_title || material.title));
  body.appendChild(makeElement('p', 'resource-card__ref', material.session || ''));
  body.appendChild(buildFiling(material));
  body.appendChild(buildUploaderRow(material));
  return body;
}

function buildFoot(material) {
  const foot = makeElement('div', 'resource-card__foot');
  const value = makeElement('span', '');
  value.appendChild(makeElement('strong', 'resource-card__value', String(material.download_count || 0)));
  value.appendChild(document.createTextNode(' downloads'));
  foot.appendChild(value);

  const button = makeElement('button', 'record-action', 'Hide');
  button.type = 'button';
  button.dataset.id = String(material.id);
  foot.appendChild(button);
  return foot;
}

function buildRecord(material) {
  const card = makeElement('article', 'resource-card');
  card.appendChild(buildTop(material));
  card.appendChild(buildBody(material));
  card.appendChild(buildFoot(material));
  return card;
}

function urlForSearch() {
  const params = new URLSearchParams();
  const term = elements.search.value.trim();
  if (term) {
    params.set('q', term);
  }
  const faculty = elements.faculty.value;
  if (faculty !== 'all') {
    params.set('faculty', faculty);
  }
  const department = elements.department.value;
  if (department !== 'all') {
    params.set('department', department);
  }
  const program = elements.program.value;
  if (program !== 'all') {
    params.set('program', program);
  }
  const status = elements.status.value;
  const sort = elements.sort.value;
  if (sort === 'downloads') {
    params.set('sort', 'download');
  } else if (sort === 'course') {
    params.set('sort', 'title');
  } else {
    params.set('sort', 'newest');
  }
  return `${MATERIALS_URL}?${params.toString()}`;
}

async function loadMaterials() {
  const token = sessionStorage.getItem('lumina_access_token');
  try {
    const response = await fetch(urlForSearch(), {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }
    const data = await response.json();
    const list = Array.isArray(data) ? data : (data.results || []);
    elements.records.replaceChildren(...list.map(buildRecord));
    elements.count.textContent = `${list.length} ${list.length === 1 ? 'record' : 'records'}`;
    elements.empty.hidden = list.length > 0;
  } catch (error) {
    console.error('Failed to load the real material records from Lumina.', error);
    elements.records.replaceChildren();
    elements.count.textContent = '0 records';
    elements.empty.hidden = false;
  }
}

function resetFilters() {
  elements.search.value = '';
  elements.faculty.value = 'all';
  elements.department.value = 'all';
  elements.program.value = 'all';
  elements.status.value = 'all';
  elements.sort.value = 'recent';
  populateDepartments('all');
  populatePrograms('all');
  refreshCascade();
  loadMaterials();
}

function refreshCascade() {
  const faculty = elements.faculty.value;
  const department = elements.department.value;
  const departmentField = elements.department.closest('.field');
  const programField = elements.program.closest('.field');

  departmentField.hidden = faculty === 'all';
  programField.hidden = department === 'all';
  populatePrograms(department);
}

function handleHide(event) {
  const button = event.target.closest('.record-action');
  if (!button) {
    return;
  }
  console.warn('Hide/Restore is not wired to the backend yet.', button.dataset.id);
}

function handleReveal(event) {
  const button = event.target.closest('.record-link');
  if (!button) {
    return;
  }
  const id = Number(button.dataset.reveal);
  if (revealedUploaders.has(id)) {
    revealedUploaders.delete(id);
  } else {
    revealedUploaders.add(id);
  }
  loadMaterials();
}

function signOut() {
  sessionStorage.removeItem('lumina_access_token');
  sessionStorage.removeItem('lumina_refresh_token');
  window.location.href = '/login.html';
}

elements.search.addEventListener('input', () => loadMaterials());
elements.faculty.addEventListener('change', () => {
  const faculty = elements.faculty.value;
  populateDepartments(faculty);
  populatePrograms('all');
  refreshCascade();
  loadMaterials();
});
elements.department.addEventListener('change', () => {
  populatePrograms(elements.department.value);
  refreshCascade();
  loadMaterials();
});
elements.program.addEventListener('change', () => loadMaterials());
elements.status.addEventListener('change', () => loadMaterials());
elements.sort.addEventListener('change', () => loadMaterials());
elements.records.addEventListener('click', handleHide);
elements.records.addEventListener('click', handleReveal);
elements.emptyReset.addEventListener('click', resetFilters);
elements.logout.addEventListener('click', signOut);

populateFaculties();
populateDepartments('all');
refreshCascade();
loadMaterials();
