const API = 'https://william999.pythonanywhere.com/api';
const USERS_URL = `${API}/accounts/users/`;

const LEVEL_NAMES = {
  100: '100 level',
  200: '200 level',
  300: '300 level',
  400: '400 level'
};

let users = [];

const elements = {
  search: document.getElementById('search'),
  faculty: document.getElementById('faculty'),
  department: document.getElementById('department'),
  program: document.getElementById('program'),
  level: document.getElementById('level'),
  sort: document.getElementById('sort'),
  staffOnly: document.getElementById('staff-only'),
  records: document.getElementById('records'),
  count: document.getElementById('results-count'),
  empty: document.getElementById('empty-state'),
  emptyReset: document.getElementById('empty-reset'),
  logout: document.getElementById('logout-btn'),
  statTotal: document.getElementById('stat-total'),
  statStudents: document.getElementById('stat-students'),
  statStaff: document.getElementById('stat-staff'),
  statWeek: document.getElementById('stat-week')
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

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

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

function populateLevels() {
  const levels = Object.keys(LEVEL_NAMES).sort((a, b) => a - b);
  populateSelect(elements.level, levels, 'All levels', LEVEL_NAMES);
}

function levelMatches(user, level) {
  return String(user.level) === level;
}

function sortedUsers(list) {
  const byDate = (a, b) => new Date(b.date_joined) - new Date(a.date_joined);
  const sorted = [...list];

  if (elements.sort.value === 'oldest') {
    return sorted.sort((a, b) => new Date(a.date_joined) - new Date(b.date_joined));
  }
  if (elements.sort.value === 'name') {
    return sorted.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }
  if (elements.sort.value === 'materials') {
    return sorted.sort((a, b) => (b.material_count || 0) - (a.material_count || 0));
  }
  return sorted.sort(byDate);
}

function joinedThisWeek(user) {
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(user.date_joined).getTime() < oneWeek;
}

function renderStats() {
  const staff = users.filter((user) => user.is_staff).length;
  elements.statTotal.textContent = users.length;
  elements.statStudents.textContent = users.length - staff;
  elements.statStaff.textContent = staff;
  elements.statWeek.textContent = users.filter(joinedThisWeek).length;
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

function fieldMatches(user, value, slug, names) {
  return user[slug] === value || user[slug] === names[value];
}

function facultyMatches(user, faculty) {
  return fieldMatches(user, faculty, 'faculty', FACULTY_NAMES);
}

function departmentMatches(user, department) {
  return fieldMatches(user, department, 'department', DEPARTMENT_NAMES);
}

function programMatches(user, program) {
  return fieldMatches(user, program, 'program', PROGRAM_NAMES);
}

function matchesSearch(user, term) {
  if (!term) {
    return true;
  }
  const name = (user.full_name || '').toLowerCase();
  const matric = (user.matric_number || '').toLowerCase();
  return name.includes(term) || matric.includes(term);
}

function filteredUsers() {
  const term = elements.search.value.trim().toLowerCase();
  const faculty = elements.faculty.value;
  const department = elements.department.value;
  const program = elements.program.value;
  const level = elements.level.value;
  const staffOnly = elements.staffOnly.checked;

  return users.filter((user) => {
    if (!matchesSearch(user, term)) {
      return false;
    }
    if (faculty !== 'all' && !facultyMatches(user, faculty)) {
      return false;
    }
    if (department !== 'all' && !departmentMatches(user, department)) {
      return false;
    }
    if (program !== 'all' && !programMatches(user, program)) {
      return false;
    }
    if (level !== 'all' && !levelMatches(user, level)) {
      return false;
    }
    return !staffOnly || Boolean(user.is_staff);
  });
}

function buildBody(user) {
  const body = makeElement('div', 'resource-card__body');
  body.appendChild(makeElement('h3', 'resource-card__title', user.full_name));
  body.appendChild(makeElement('p', 'resource-card__ref', user.matric_number));

  const meta = makeElement('p', 'resource-card__meta');
  meta.textContent = `${labelFor(FACULTY_NAMES, user.faculty)} / ${labelFor(DEPARTMENT_NAMES, user.department)} / L${user.level} / joined ${formatDate(user.date_joined)}`;
  body.appendChild(meta);

  if (user.is_staff) {
    const wrap = makeElement('p', 'resource-card__meta');
    wrap.appendChild(makeElement('span', 'pill pill--staff', 'Staff'));
    body.appendChild(wrap);
  }
  return body;
}

function buildFoot(user) {
  const foot = makeElement('div', 'resource-card__foot');
  const value = makeElement('span', '');
  value.appendChild(makeElement('strong', 'resource-card__value', String(user.material_count)));
  value.appendChild(document.createTextNode(user.material_count === 1 ? ' material' : ' materials'));
  foot.appendChild(value);

  const button = makeElement('button', 'record-action record-action--danger', 'Remove');
  button.type = 'button';
  button.dataset.id = String(user.id);
  foot.appendChild(button);
  return foot;
}

function buildRecord(user) {
  const card = makeElement('article', 'resource-card resource-card--person');
  card.appendChild(makeElement('span', 'avatar', initials(user.full_name)));
  card.appendChild(buildBody(user));
  card.appendChild(buildFoot(user));
  return card;
}

function render() {
  const visible = sortedUsers(filteredUsers());
  elements.records.replaceChildren(...visible.map(buildRecord));
  elements.count.textContent = `${visible.length} ${visible.length === 1 ? 'record' : 'records'}`;
  elements.empty.hidden = visible.length > 0;
}

async function loadUsers() {
  const token = sessionStorage.getItem('lumina_access_token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  try {
    const response = await fetch(USERS_URL, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
    if (response.status === 401 || response.status === 403) {
      sessionStorage.removeItem('lumina_access_token');
      sessionStorage.removeItem('lumina_refresh_token');
      window.location.href = '/login.html';
      return;
    }
    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }
    users = await response.json();
    renderStats();
  } catch (error) {
    console.error('Failed to load the user list from Lumina.', error);
    users = [];
  }
  render();
}

function resetFilters() {
  elements.search.value = '';
  elements.faculty.value = 'all';
  elements.department.value = 'all';
  elements.program.value = 'all';
  elements.level.value = 'all';
  elements.sort.value = 'newest';
  elements.staffOnly.checked = false;
  populateDepartments('all');
  populatePrograms('all');
  refreshCascade();
  render();
}

function handleAction(event) {
  const button = event.target.closest('.record-action');
  if (!button) {
    return;
  }
  console.warn('Remove is not wired to the backend yet.', button.dataset.id);
}

function signOut() {
  sessionStorage.removeItem('lumina_access_token');
  sessionStorage.removeItem('lumina_refresh_token');
  window.location.href = '/login.html';
}

elements.search.addEventListener('input', render);
elements.faculty.addEventListener('change', () => {
  populateDepartments(elements.faculty.value);
  populatePrograms('all');
  refreshCascade();
  render();
});
elements.department.addEventListener('change', () => {
  populatePrograms(elements.department.value);
  refreshCascade();
  render();
});
elements.program.addEventListener('change', render);
elements.level.addEventListener('change', render);
elements.sort.addEventListener('change', render);
elements.staffOnly.addEventListener('change', render);
elements.records.addEventListener('click', handleAction);
elements.emptyReset.addEventListener('click', resetFilters);
elements.logout.addEventListener('click', signOut);

populateFaculties();
populateDepartments('all');
populateLevels();
refreshCascade();
loadUsers();
