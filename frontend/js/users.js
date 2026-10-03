const API = 'https://william999.pythonanywhere.com/api';
const USERS_URL = `${API}/accounts/users/`;

const LEVEL_NAMES = {
  100: '100 Level',
  200: '200 Level',
  300: '300 Level',
  400: '400 Level'
};

let users = [];

const expanded = new Set();

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
  statWeek: document.getElementById('stat-week'),
  staffRoster: document.getElementById('staff-roster'),
  staffList: document.getElementById('staff-roster-list')
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

function formatStamp(value) {
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
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

function renderStaffRoster(staff) {
  elements.staffList.replaceChildren(
    ...staff.map((user) => {
      const item = makeElement('li', 'staff-roster__item');
      item.appendChild(makeElement('strong', 'staff-roster__name', user.full_name));
      item.appendChild(makeElement('span', 'staff-roster__ref', user.matric_number));
      return item;
    })
  );
  elements.staffRoster.hidden = staff.length === 0;
}

function renderStats() {
  const staff = users.filter((user) => user.is_staff);
  elements.statTotal.textContent = users.length;
  elements.statStudents.textContent = users.length - staff.length;
  elements.statStaff.textContent = staff.length;
  elements.statWeek.textContent = users.filter(joinedThisWeek).length;
  renderStaffRoster(staff);
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

function buildBody(user, isExpanded) {
  const body = makeElement('div', 'resource-card__body');
  body.appendChild(makeElement('h3', 'resource-card__title', user.full_name));
  body.appendChild(makeElement('p', 'resource-card__ref', user.matric_number));

  if (!isExpanded) {
    return body;
  }

  const meta = makeElement('p', 'resource-card__meta');
  meta.textContent = `${labelFor(FACULTY_NAMES, user.faculty)} / ${labelFor(DEPARTMENT_NAMES, user.department)} / ${user.level} Level / joined ${formatDate(user.date_joined)}`;
  body.appendChild(meta);

  const pills = makeElement('p', 'resource-card__pill-wrap');
  if (user.role === 'super_admin') {
    pills.appendChild(makeElement('span', 'pill pill--super', 'Super admin'));
  } else if (user.role === 'admin') {
    pills.appendChild(makeElement('span', 'pill pill--staff', 'Admin'));
  }
  if (user.status === 'suspended') {
    const until = user.suspended_until ? ` until ${formatStamp(user.suspended_until)}` : '';
    pills.appendChild(makeElement('span', 'pill pill--suspended', `Suspended${until}`));
  }
  if (pills.childElementCount) {
    body.appendChild(pills);
  }
  return body;
}

function buildFoot(user, isExpanded) {
  const foot = makeElement('div', 'resource-card__foot');

  const toggle = makeElement('button', 'record-action record-action--toggle', isExpanded ? 'Hide details' : 'View details');
  toggle.type = 'button';
  toggle.dataset.id = String(user.id);
  toggle.setAttribute('aria-expanded', String(isExpanded));
  foot.appendChild(toggle);

  if (!isExpanded) {
    return foot;
  }

  const value = makeElement('span', '');
  value.appendChild(makeElement('strong', 'resource-card__value', String(user.material_count)));
  value.appendChild(document.createTextNode(user.material_count === 1 ? ' material' : ' materials'));
  foot.appendChild(value);

  if (user.role === 'super_admin') {
    return foot;
  }
  if (user.role === 'admin' && !isSuperAdmin()) {
    return foot;
  }

  const suspended = user.status === 'suspended';
  foot.appendChild(actionButton(suspended ? 'Lift suspension' : 'Suspend', suspended ? 'unsuspend' : 'suspend', user));
  foot.appendChild(actionButton(isSuperAdmin() ? 'Ban' : 'Request ban', isSuperAdmin() ? 'ban' : 'ban-requests', user));
  return foot;
}

function actionButton(label, action, user) {
  const button = makeElement('button', `record-action record-action--${action}`, label);
  button.type = 'button';
  button.dataset.action = action;
  button.dataset.id = String(user.id);
  return button;
}

function buildRecord(user) {
  const isExpanded = expanded.has(user.id);
  const card = makeElement('article', 'resource-card resource-card--person');
  card.appendChild(makeElement('span', 'avatar', initials(user.full_name)));
  card.appendChild(buildBody(user, isExpanded));
  card.appendChild(buildFoot(user, isExpanded));
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
  const id = Number(button.dataset.id);

  if (button.classList.contains('record-action--toggle')) {
    if (expanded.has(id)) {
      expanded.delete(id);
    } else {
      expanded.add(id);
    }
    render();
    return;
  }

  const user = users.find((entry) => entry.id === id);
  if (!user) {
    return;
  }

  if (button.dataset.action === 'unsuspend') {
    liftSuspension(user);
    return;
  }
  if (button.dataset.action === 'suspend') {
    suspendUser(user);
    return;
  }
  banUser(user, button.dataset.action);
}

async function readActionResult(response) {
  if (response.status === 204) {
    return true;
  }
  return response.json();
}

async function runAction(url, body, messages) {
  try {
    const response = await authorisedFetch(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      console.error('The moderation request was refused.', response.status, await response.text());
      showNotice(messages[response.status] || messages.other, 'bad');
      return false;
    }
    showNotice(messages.done, 'good');
    return readActionResult(response);
  } catch (error) {
    console.error('The moderation request did not complete.', error);
    showNotice(messages.other, 'bad');
    return false;
  }
}

const ACTION_FAILURES = {
  400: 'Check the details and try again.',
  403: 'You are not allowed to do that.',
  404: 'That user no longer exists.',
  409: 'A ban request for that user is already waiting.',
  other: 'That action did not go through.'
};

async function suspendUser(user) {
  const reasons = await loadReasonList('suspend');
  const entered = await openActionModal({
    title: `Suspend ${user.full_name}`,
    intro: 'They will not be able to sign in until the suspension runs out.',
    duration: true,
    reasons,
    confirmLabel: 'Suspend',
    onConfirm: (values) => runAction(`${USERS_URL}${user.id}/suspend/`, values, {
      done: `${user.full_name} is suspended.`,
      ...ACTION_FAILURES
    })
  });
  if (entered) {
    updateUser(user.id, { status: 'suspended', suspended_until: entered.suspended_until || null });
  }
}

async function liftSuspension(user) {
  const entered = await openActionModal({
    title: `Lift the suspension on ${user.full_name}`,
    intro: 'They will be able to sign in again straight away.',
    confirmLabel: 'Lift suspension',
    hideNote: true,
    onConfirm: () => runAction(`${USERS_URL}${user.id}/unsuspend/`, {}, {
      done: `${user.full_name} can sign in again.`,
      ...ACTION_FAILURES
    })
  });
  if (entered) {
    updateUser(user.id, { status: 'active', suspended_until: null });
  }
}

async function banUser(user, action) {
  const asRequest = action === 'ban-requests';
  const reasons = await loadReasonList('ban');
  const entered = await openActionModal({
    title: asRequest ? `Request a ban on ${user.full_name}` : `Ban ${user.full_name}`,
    intro: asRequest
      ? 'The super admin decides whether this ban goes ahead.'
      : 'The account will show as deleted to the user. The record is kept.',
    reasons,
    confirmLabel: asRequest ? 'Send request' : 'Ban',
    onConfirm: (values) => runAction(`${USERS_URL}${user.id}/${action}/`, values, {
      done: asRequest ? 'Ban request sent to the super admin.' : `${user.full_name} is banned.`,
      ...ACTION_FAILURES
    })
  });
  if (entered && !asRequest) {
    removeUser(user.id);
  }
}

function updateUser(id, changes) {
  const user = users.find((entry) => entry.id === id);
  if (user) {
    Object.assign(user, changes);
    render();
  }
}

function loadReasonList(kind) {
  return fetchReasons(kind).catch((error) => {
    console.error('The moderation reasons could not be loaded.', error);
    return [];
  });
}

function removeUser(id) {
  users = users.filter((entry) => entry.id !== id);
  expanded.delete(id);
  renderStats();
  render();
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
