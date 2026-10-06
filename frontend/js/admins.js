const API = 'https://william999.pythonanywhere.com/api';
const ADMINS_URL = `${API}/accounts/admins/`;
const USERS_URL = `${API}/accounts/users/`;

let teamMembers = [];
let students = [];

const elements = {
  teamGrid: document.getElementById('team-grid'),
  teamLoading: document.getElementById('team-loading'),
  teamError: document.getElementById('team-error'),
  teamRetry: document.getElementById('team-retry'),
  searchGrid: document.getElementById('search-grid'),
  searchLoading: document.getElementById('search-loading'),
  searchError: document.getElementById('search-error'),
  searchRetry: document.getElementById('search-retry'),
  search: document.getElementById('search-students'),
  count: document.getElementById('results-count'),
  empty: document.getElementById('empty-state'),
  emptyMsg: document.getElementById('empty-message'),
  emptyReset: document.getElementById('empty-reset'),
  logout: document.getElementById('logout-btn')
};

function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function initials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function roleBadge(role) {
  const span = makeElement('span', 'pill', role === 'super_admin' ? 'Super admin' : 'Admin');
  span.classList.add(role === 'super_admin' ? 'pill--super' : 'pill--staff');
  return span;
}

function buildTeamCard(member) {
  const profile = window.profileData || {};
  const isSelf = member.id === profile.id;
  const isOwner = Boolean(member.is_owner);
  const isSuper = member.role === 'super_admin';

  const card = makeElement('article', 'resource-card resource-card--person');
  card.appendChild(makeElement('span', 'avatar', initials(member.full_name)));
  const body = makeElement('div', 'resource-card__body');
  body.appendChild(makeElement('h3', 'resource-card__title', member.full_name));
  body.appendChild(makeElement('p', 'resource-card__ref', member.matric_number));
  const meta = makeElement('p', 'resource-card__meta');
  meta.appendChild(roleBadge(member.role));
  if (member.is_owner) meta.appendChild(makeElement('span', 'pill pill--owner', 'Owner'));
  if (member.date_joined) meta.appendChild(document.createTextNode(` / joined ${formatDate(member.date_joined)}`));
  body.appendChild(meta);
  card.appendChild(body);

  const foot = makeElement('div', 'resource-card__foot');

  if (!isSelf && !isOwner) {
    if (isSuper && profile.is_owner) {
      const btn = makeElement('button', 'record-action record-action--remove', 'Remove super admin');
      btn.type = 'button';
      btn.dataset.id = String(member.id);
      btn.dataset.action = 'remove-super-admin';
      foot.appendChild(btn);
    }
    if (!isSuper && profile.role === 'super_admin') {
      const btn = makeElement('button', 'record-action record-action--promote', 'Make super admin');
      btn.type = 'button';
      btn.dataset.id = String(member.id);
      btn.dataset.action = 'make-super-admin';
      foot.appendChild(btn);
    }
    if (member.role === 'admin' && profile.role === 'super_admin') {
      const btn = makeElement('button', 'record-action record-action--remove', 'Remove admin');
      btn.type = 'button';
      btn.dataset.id = String(member.id);
      btn.dataset.action = 'remove-admin';
      foot.appendChild(btn);
    }
  }

  card.appendChild(foot);
  return card;
}

function buildStudentCard(student) {
  const card = makeElement('article', 'resource-card resource-card--person');
  card.appendChild(makeElement('span', 'avatar', initials(student.full_name)));
  const body = makeElement('div', 'resource-card__body');
  body.appendChild(makeElement('h3', 'resource-card__title', student.full_name));
  body.appendChild(makeElement('p', 'resource-card__ref', student.matric_number));
  const meta = makeElement('p', 'resource-card__meta');
  meta.appendChild(makeElement('span', 'pill pill--hidden', 'Student'));
  if (student.faculty) meta.appendChild(document.createTextNode(` / ${student.faculty}`));
  body.appendChild(meta);
  card.appendChild(body);
  const foot = makeElement('div', 'resource-card__foot');
  const btn = makeElement('button', 'record-action record-action--make-admin', 'Make admin');
  btn.type = 'button';
  btn.dataset.id = String(student.id);
  btn.dataset.action = 'make-admin';
  foot.appendChild(btn);
  card.appendChild(foot);
  return card;
}

function renderTeam() {
  elements.teamGrid.replaceChildren(...teamMembers.map(buildTeamCard));
  elements.teamLoading.hidden = true;
  elements.teamError.hidden = true;
}

function renderSearch() {
  const term = elements.search.value.trim().toLowerCase();
  const visible = students.filter((s) => {
    if (!term) return true;
    return (s.full_name || '').toLowerCase().includes(term) || (s.matric_number || '').toLowerCase().includes(term);
  });
  elements.searchGrid.replaceChildren(...visible.map(buildStudentCard));
  elements.count.textContent = `${visible.length} ${visible.length === 1 ? 'record' : 'records'}`;
  if (visible.length === 0) {
    if (students.length === 0) {
      elements.emptyMsg.textContent = 'No students available.';
    } else {
      elements.emptyMsg.textContent = 'No students match.';
    }
    elements.empty.hidden = false;
  } else {
    elements.empty.hidden = true;
  }
  elements.searchLoading.hidden = true;
  elements.searchError.hidden = true;
}


async function loadTeam() {
  if (!isSuperAdmin()) {
    window.location.href = 'users.html';
    return;
  }
  elements.teamLoading.hidden = false;
  elements.teamError.hidden = true;
  const token = sessionStorage.getItem('lumina_access_token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }
  try {
    const response = await fetch(ADMINS_URL, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
    });
    if (response.status === 401 || response.status === 403) {
      clearSession();
      window.location.href = '/login.html';
      return;
    }
    if (!response.ok) throw new Error(`status ${response.status}`);
    teamMembers = await response.json();
    renderTeam();
  } catch (error) {
    console.error('The admin team could not be loaded.', error);
    teamMembers = [];
    elements.teamLoading.hidden = true;
    elements.teamError.hidden = false;
  }
}

async function loadStudents() {
  elements.searchLoading.hidden = false;
  elements.searchError.hidden = true;
  const token = sessionStorage.getItem('lumina_access_token');
  try {
    const response = await fetch(USERS_URL, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
    });
    if (response.ok) {
      const all = await response.json();
      students = all.filter((u) => u.role === 'student');
      renderSearch();
    } else {
      throw new Error(`status ${response.status}`);
    }
  } catch (e) {
    console.error('Student search could not load.', e);
    students = [];
    elements.searchLoading.hidden = true;
    elements.searchError.hidden = false;
  }
}

async function changeRole(action, id) {
  try {
    const response = await authorisedFetch(`${USERS_URL}${id}/${action}/`, {
      method: 'POST'
    });
    if (!response.ok) {
      const text = await response.text();
      let msg = 'That change did not go through.';
      try {
        const data = JSON.parse(text);
        msg = data.detail || data.message || msg;
      } catch (_) {}
      showNotice(msg, 'bad');
      return false;
    }
    showNotice('Updated.', 'good');
    return true;
  } catch (error) {
    console.error('Role change did not complete.', error);
    showNotice('That change did not go through.', 'bad');
    return false;
  }
}

async function handleTeamClick(event) {
  const button = event.target.closest('.record-action');
  if (!button) return;
  const id = Number(button.dataset.id);
  const action = button.dataset.action;
  let title, intro, confirmLabel;
  if (action === 'make-super-admin') {
    title = 'Make super admin';
    intro = 'This raises the user to super admin.';
    confirmLabel = 'Make super admin';
  } else if (action === 'remove-super-admin') {
    title = 'Remove super admin';
    intro = 'This lowers the user to admin.';
    confirmLabel = 'Remove super admin';
  } else if (action === 'remove-admin') {
    title = 'Remove admin';
    intro = 'The user will lose admin access.';
    confirmLabel = 'Remove admin';
  } else {
    return;
  }
  const ok = await openActionModal({
    title,
    intro,
    confirmLabel,
    hideNote: true,
    onConfirm: () => changeRole(action, id)
  });
  if (ok) {
    await loadTeam();
    await loadStudents();
  }
}

async function handleSearchClick(event) {
  const button = event.target.closest('.record-action');
  if (!button || button.dataset.action !== 'make-admin') return;
  const id = Number(button.dataset.id);
  const ok = await openActionModal({
    title: 'Make admin',
    intro: 'Give admin access to this student.',
    confirmLabel: 'Make admin',
    hideNote: true,
    onConfirm: () => changeRole('make-admin', id)
  });
  if (ok) {
    await loadTeam();
    await loadStudents();
  }
}

function resetSearch() {
  elements.search.value = '';
  renderSearch();
}

function signOut() {
  clearSession();
  window.location.href = '/login.html';
}

if (!isSuperAdmin()) {
  window.location.href = 'users.html';
} else {
  window.profileReady.then(() => {
    loadTeam();
    loadStudents();
  });
  elements.search.addEventListener('input', renderSearch);
  elements.teamGrid.addEventListener('click', handleTeamClick);
  elements.searchGrid.addEventListener('click', handleSearchClick);
  elements.emptyReset.addEventListener('click', resetSearch);
  elements.teamRetry.addEventListener('click', loadTeam);
  elements.searchRetry.addEventListener('click', loadStudents);
  elements.logout.addEventListener('click', signOut);
}