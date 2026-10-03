const API = 'https://william999.pythonanywhere.com/api';
const RECYCLE_SUMMARY_URL = `${API}/accounts/recycle/summary/`;
const RECYCLE_USERS_URL = `${API}/accounts/users/`;
const RECYCLE_MATERIALS_URL = `${API}/materials/recycle/`;

let activeTab = 'users';
let recycleUsers = [];
let recycleMaterials = [];

const recElements = {
  statUsers: document.getElementById('stat-deleted-users'),
  statMaterials: document.getElementById('stat-deleted-materials'),
  tabUsers: document.getElementById('tab-users'),
  tabMaterials: document.getElementById('tab-materials'),
  usersGrid: document.getElementById('users-grid'),
  materialsGrid: document.getElementById('materials-grid'),
  search: document.getElementById('search'),
  faculty: document.getElementById('faculty'),
  department: document.getElementById('department'),
  program: document.getElementById('program'),
  count: document.getElementById('results-count'),
  empty: document.getElementById('empty-state'),
  emptyMessage: document.getElementById('empty-message'),
  emptyReset: document.getElementById('empty-reset'),
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
  populateSelect(recElements.faculty, Object.keys(CASCADE), 'All faculties', FACULTY_NAMES);
}

function populateDepartments(faculty) {
  const departments = faculty === 'all' ? {} : CASCADE[faculty].departments;
  populateSelect(recElements.department, Object.keys(departments), 'All departments', DEPARTMENT_NAMES);
}

function populatePrograms(department) {
  populateSelect(recElements.program, programsFor(department), 'All programs', PROGRAM_NAMES);
}

function setTab(name) {
  if (name === activeTab) {
    return;
  }
  activeTab = name;
  const usersTab = name === 'users';
  recElements.tabUsers.classList.toggle('active', usersTab);
  recElements.tabUsers.setAttribute('aria-selected', String(usersTab));
  recElements.tabMaterials.classList.toggle('active', !usersTab);
  recElements.tabMaterials.setAttribute('aria-selected', String(!usersTab));
  recElements.usersGrid.hidden = !usersTab;
  recElements.materialsGrid.hidden = usersTab;
  recElements.search.placeholder = usersTab
    ? 'Name or matric number'
    : 'Course code or title';
  render();
}

recElements.tabUsers.addEventListener('click', () => setTab('users'));
recElements.tabMaterials.addEventListener('click', () => setTab('materials'));

function populateCounts() {
  return new Promise((resolve) => {
    const token = sessionStorage.getItem('lumina_access_token');
    fetch(RECYCLE_SUMMARY_URL, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      }
    })
      .then((response) => response.json())
      .then((summary) => {
        recElements.statUsers.textContent = summary.users || 0;
        recElements.statMaterials.textContent = summary.materials || 0;
        resolve();
      })
      .catch((error) => {
        console.error('Recycle summary could not be loaded.', error);
        resolve();
      });
  });
}

async function loadRecycleUsers() {
  if (!isSuperAdmin()) {
    window.location.href = 'users.html';
    return;
  }
  const token = sessionStorage.getItem('lumina_access_token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }
  try {
    const response = await fetch(RECYCLE_USERS_URL, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
    if (response.status === 401 || response.status === 403) {
      clearSession();
      window.location.href = '/login.html';
      return;
    }
    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }
    recycleUsers = await response.json();
  } catch (error) {
    console.error('Deleted users could not be loaded.', error);
    recycleUsers = [];
  }
  renderUsers();
}

function userMatches(user, term) {
  if (!term) {
    return true;
  }
  const name = (user.full_name || '').toLowerCase();
  const matric = (user.matric_number || '').toLowerCase();
  return name.includes(term) || matric.includes(term);
}

function filteredUsers() {
  const term = recElements.search.value.trim().toLowerCase();
  const faculty = recElements.faculty.value;
  const department = recElements.department.value;
  const program = recElements.program.value;

  return recycleUsers.filter((user) => {
    if (!userMatches(user, term)) {
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
    return true;
  });
}

function buildUserCard(user) {
  const card = makeElement('article', 'resource-card resource-card--person');
  card.appendChild(makeElement('span', 'avatar', initials(user.full_name)));

  const body = makeElement('div', 'resource-card__body');
  body.appendChild(makeElement('h3', 'resource-card__title', user.full_name));
  body.appendChild(makeElement('p', 'resource-card__ref', user.matric_number));
  body.appendChild(
    makeElement(
      'p',
      'resource-card__meta',
      `Faculty: ${labelFor(FACULTY_NAMES, user.faculty)} / ${labelFor(
        DEPARTMENT_NAMES,
        user.department
      )} / ${user.level} Level`
    )
  );
  body.appendChild(
    makeElement(
      'p',
      'resource-card__meta',
      `Banned on ${formatStamp(user.banned_at)}, ${user.ban_reason_label || 'not given'}`
    )
  );
  body.appendChild(makeElement('p', 'resource-card__meta', `Ban note: ${user.ban_note || 'none'}`));
  body.appendChild(
    makeElement('p', 'resource-card__meta', `Banned by ${user.banned_by_name || 'an admin'}`)
  );
  card.appendChild(body);

  const foot = makeElement('div', 'resource-card__foot');
  const restore = makeElement('button', 'record-action record-action--restore', 'Restore');
  restore.type = 'button';
  restore.dataset.id = String(user.id);
  foot.appendChild(restore);
  card.appendChild(foot);
  return card;
}

function renderUsers() {
  const visible = filteredUsers();
  recElements.usersGrid.replaceChildren(...visible.map(buildUserCard));
  recElements.count.textContent = `${visible.length} ${visible.length === 1 ? 'record' : 'records'}`;
  setEmptyState(visible.length === 0, true);
}

async function loadRecycleMaterials() {
  if (!isSuperAdmin()) {
    window.location.href = 'users.html';
    return;
  }
  const token = sessionStorage.getItem('lumina_access_token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }
  try {
    const response = await fetch(RECYCLE_MATERIALS_URL, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
    if (response.status === 401 || response.status === 403) {
      clearSession();
      window.location.href = '/login.html';
      return;
    }
    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }
    recycleMaterials = await response.json();
  } catch (error) {
    console.error('Deleted materials could not be loaded.', error);
    recycleMaterials = [];
  }
  renderMaterials();
}

function materialMatches(material, term) {
  if (!term) {
    return true;
  }
  const code = (material.course_code || '').toLowerCase();
  const title = (material.course_title || '').toLowerCase();
  return code.includes(term) || title.includes(term);
}

function filteredMaterials() {
  const term = recElements.search.value.trim().toLowerCase();
  return recycleMaterials.filter((material) => materialMatches(material, term));
}

function buildMaterialCard(material) {
  const card = makeElement('article', 'resource-card');

  const top = makeElement('div', 'resource-card__top');
  top.appendChild(makeElement('span', 'pill pill--hidden', 'Deleted'));
  top.appendChild(makeElement('span', '', `${material.course_code} · ${material.level || ''} Level`));
  card.appendChild(top);

  const body = makeElement('div', 'resource-card__body');
  body.appendChild(makeElement('h3', 'resource-card__title', material.course_title || material.title));
  body.appendChild(makeElement('p', 'resource-card__ref', material.session || ''));
  body.appendChild(
    makeElement(
      'p',
      'resource-card__meta',
      `Filed by ${labelFor(FACULTY_NAMES, material.faculty)} / ${labelFor(DEPARTMENT_NAMES, material.department)}, ${material.uploader_real_name || 'an admin'}`
    )
  );
  body.appendChild(
    makeElement(
      'p',
      'resource-card__meta',
      `Removed on ${formatStamp(material.removed_at)}, ${material.removal_reason_label || 'not given'}`
    )
  );
  body.appendChild(makeElement('p', 'resource-card__meta', `Removal note: ${material.removal_note || 'none'}`));
  card.appendChild(body);

  const foot = makeElement('div', 'resource-card__foot');
  const restore = makeElement('button', 'record-action record-action--restore', 'Restore');
  restore.type = 'button';
  restore.dataset.id = String(material.id);
  foot.appendChild(restore);
  card.appendChild(foot);
  return card;
}

function renderMaterials() {
  const visible = filteredMaterials();
  recElements.materialsGrid.replaceChildren(...visible.map(buildMaterialCard));
  recElements.count.textContent = `${visible.length} ${visible.length === 1 ? 'record' : 'records'}`;
  setEmptyState(visible.length === 0, false);
}

function setEmptyState(noRecords, usersTab) {
  if (noRecords && (usersTab ? recycleUsers.length : recycleMaterials.length) === 0) {
    recElements.emptyMessage.textContent = 'Nothing in the recycle bin.';
    recElements.emptyReset.hidden = true;
  } else if (noRecords) {
    recElements.emptyMessage.textContent = 'No records match';
    recElements.emptyReset.hidden = false;
  }
  recElements.empty.hidden = !noRecords;
}

function render() {
  if (activeTab === 'users') {
    renderUsers();
  } else {
    renderMaterials();
  }
}

function setCascade(department) {
  const departmentField = recElements.department.closest('.field');
  const programField = recElements.program.closest('.field');

  departmentField.hidden = recElements.faculty.value === 'all';
  programField.hidden = department === 'all';
  populatePrograms(department);
  render();
}

async function runRestore(kind, id, item) {
  const url =
    kind === 'users'
      ? `${RECYCLE_USERS_URL}${id}/restore/`
      : `${RECYCLE_MATERIALS_URL}${id}/restore/`;
  try {
    const response = await authorisedFetch(url, {
      method: 'POST',
      body: JSON.stringify({})
    });
    if (!response.ok) {
      console.error('Restore refused for', item, response.status);
      showNotice('That action did not go through.', 'bad');
      return;
    }
    if (kind === 'users') {
      recycleUsers = recycleUsers.filter((u) => u.id !== id);
    } else {
      recycleMaterials = recycleMaterials.filter((m) => m.id !== id);
    }
    if (activeTab === kind) {
      render();
    }
    showNotice('Restored.', 'good');
  } catch (error) {
    console.error('Restore did not complete.', error);
    showNotice('That action did not go through.', 'bad');
  }
}

function restoreItem(id, kind) {
  const list = kind === 'users' ? recycleUsers : recycleMaterials;
  const item = list.find((entry) => entry.id === id);
  if (!item) {
    return;
  }
  const title = kind === 'users' ? `Restore ${item.full_name}` : `Restore ${item.course_title || item.title}`;
  openActionModal({
    title,
    intro: 'This restores the deleted record to its normal listing.',
    confirmLabel: 'Restore',
    onConfirm: () => runRestore(kind, id, item)
  });
}

function handleRecordsClick(event) {
  const button = event.target.closest('.record-action');
  if (!button || !button.dataset.id) {
    return;
  }
  const id = Number(button.dataset.id);
  restoreItem(id, activeTab);
}

function resetFilters() {
  recElements.search.value = '';
  recElements.faculty.value = 'all';
  recElements.department.value = 'all';
  recElements.program.value = 'all';
  populateDepartments('all');
  populatePrograms('all');
  setCascade('all');
  render();
}

function signOut() {
  clearSession();
  window.location.href = '/login.html';
}

recElements.usersGrid.addEventListener('click', handleRecordsClick);
recElements.materialsGrid.addEventListener('click', handleRecordsClick);
recElements.emptyReset.addEventListener('click', resetFilters);
recElements.logout.addEventListener('click', signOut);
recElements.search.addEventListener('input', render);
recElements.faculty.addEventListener('change', () => {
  populateDepartments(recElements.faculty.value);
  populatePrograms('all');
  setCascade(recElements.department.value);
  render();
});
recElements.department.addEventListener('change', () => {
  populatePrograms(recElements.department.value);
  setCascade(recElements.department.value);
  render();
});
recElements.program.addEventListener('change', render);

populateFaculties();
populateDepartments('all');
populatePrograms('all');
setCascade('all');
populateCounts();
loadRecycleUsers();
loadRecycleMaterials();
