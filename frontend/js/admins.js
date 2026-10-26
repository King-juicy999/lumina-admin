const ADMINS_URL = `${API}/accounts/admins/`;
const USERS_URL = `${API}/accounts/users/`;
const SUPER_REQUESTS_URL = `${API}/accounts/super-admin-requests/`;
const REASON_LIMIT = 500;
const RECENT_DECIDED_DAYS = 3;

const PROMOTION_FAILURES = {
  400: 'That person cannot be promoted this way.',
  403: 'You are not allowed to do that.',
  409: 'A request for this person is already waiting.',
  other: 'That did not go through.'
};

const REQUEST_STATUS_PILLS = {
  pending: 'pill--request-pending',
  approved: 'pill--request-approved',
  declined: 'pill--request-declined'
};

let teamMembers = [];
let students = [];
let superRequests = [];
let lastSuperSignature = '';
let lastPendingSignature = '';
let pendingMatrics = new Set();
let teamLoaded = false;

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
  requestsSection: document.getElementById('super-requests-section'),
  requestsHeading: document.getElementById('super-requests-heading'),
  requestsGrid: document.getElementById('requests-grid'),
  requestsLoading: document.getElementById('requests-loading'),
  requestsError: document.getElementById('requests-error'),
  requestsRetry: document.getElementById('requests-retry'),
  requestsEmpty: document.getElementById('requests-empty'),
  requestsEmptyMsg: document.getElementById('requests-empty-message'),
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

function viewerIsOwner() {
  return Boolean((window.profileData || {}).is_owner);
}

function buildStatusPill(status) {
  const label = status === 'pending' ? 'Pending' : status === 'approved' ? 'Approved' : 'Declined';
  const span = makeElement('span', 'pill', label);
  if (REQUEST_STATUS_PILLS[status]) {
    span.classList.add(REQUEST_STATUS_PILLS[status]);
  }
  return span;
}

function pendingTargetMatrics(list) {
  return list
    .filter((entry) => entry.status === 'pending')
    .map((entry) => entry.target && entry.target.matric_number)
    .sort();
}

function requestByCreatedDesc(a, b) {
  return new Date(b.created_at) - new Date(a.created_at);
}

function requestByDecidedDesc(a, b) {
  return new Date(b.decided_at || b.created_at) - new Date(a.decided_at || a.created_at);
}

function decidedRecently(entry) {
  const decided = new Date(entry.decided_at);
  if (Number.isNaN(decided.getTime())) {
    return false;
  }
  return Date.now() - decided.getTime() < RECENT_DECIDED_DAYS * 24 * 60 * 60 * 1000;
}

function orderRequests(list) {
  const pending = list.filter((entry) => entry.status === 'pending').sort(requestByCreatedDesc);
  if (viewerIsOwner()) {
    return pending;
  }
  const decided = list.filter((entry) => entry.status !== 'pending' && decidedRecently(entry)).sort(requestByDecidedDesc);
  return pending.concat(decided);
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
    if (!isSuper && profile.is_owner) {
      const btn = makeElement('button', 'record-action record-action--promote', 'Make super admin');
      btn.type = 'button';
      btn.dataset.id = String(member.id);
      btn.dataset.action = 'make-super-admin';
      foot.appendChild(btn);
    }
    if (!isSuper && profile.role === 'super_admin' && !profile.is_owner) {
      const requested = pendingMatrics.has(member.matric_number);
      const btn = makeElement('button', 'record-action record-action--promote', requested ? 'Request sent' : 'Request super admin');
      btn.type = 'button';
      if (!requested) {
        btn.dataset.id = String(member.id);
        btn.dataset.action = 'request-super-admin';
      }
      btn.disabled = requested;
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

function buildSuperRequestCard(entry) {
  const owner = viewerIsOwner();
  const card = makeElement('article', 'resource-card resource-card--person');
  card.appendChild(makeElement('span', 'avatar', initials(entry.target.full_name)));
  const body = makeElement('div', 'resource-card__body');
  body.appendChild(makeElement('h3', 'resource-card__title', entry.target.full_name));
  body.appendChild(makeElement('p', 'resource-card__ref', entry.target.matric_number));
  const status = makeElement('p', 'resource-card__meta');
  status.appendChild(buildStatusPill(entry.status));
  body.appendChild(status);
  if (owner) {
    body.appendChild(makeElement('p', 'resource-card__meta', `Requested by ${entry.requested_by_name || 'an admin'}`));
    body.appendChild(makeElement('p', 'resource-card__meta', `Reason: ${entry.reason || 'not given'}`));
    body.appendChild(makeElement('p', 'resource-card__meta', `Requested: ${formatDate(entry.created_at)}`));
  }
  if (entry.status !== 'pending' && entry.decided_by_name) {
    body.appendChild(makeElement('p', 'resource-card__meta', `Decided by ${entry.decided_by_name}`));
  }
  card.appendChild(body);

  const foot = makeElement('div', 'resource-card__foot');
  if (owner && entry.status === 'pending') {
    const approve = makeElement('button', 'record-action record-action--approve', 'Approve');
    approve.type = 'button';
    approve.dataset.id = String(entry.id);
    approve.dataset.action = 'approve-super-admin';
    foot.appendChild(approve);
    const decline = makeElement('button', 'record-action record-action--deny', 'Decline');
    decline.type = 'button';
    decline.dataset.id = String(entry.id);
    decline.dataset.action = 'decline-super-admin';
    foot.appendChild(decline);
  }
  card.appendChild(foot);
  return card;
}

function renderSuperRequests() {
  const ordered = orderRequests(superRequests);
  const signature = JSON.stringify(ordered);
  if (signature !== lastSuperSignature) {
    lastSuperSignature = signature;
    elements.requestsGrid.replaceChildren(...ordered.map(buildSuperRequestCard));
    elements.requestsEmpty.hidden = ordered.length > 0;
  }
  elements.requestsLoading.hidden = true;
  elements.requestsError.hidden = true;
}

function renderTeam() {
  pendingMatrics = new Set(pendingTargetMatrics(superRequests));
  elements.teamGrid.replaceChildren(...teamMembers.map(buildTeamCard));
  elements.teamLoading.hidden = true;
  elements.teamError.hidden = true;
  teamLoaded = true;
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

async function loadSuperRequests() {
  if (lastSuperSignature === '') {
    elements.requestsLoading.hidden = false;
  }
  elements.requestsError.hidden = true;
  const token = sessionStorage.getItem('lumina_access_token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }
  try {
    const response = await fetch(SUPER_REQUESTS_URL, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
    });
    if (response.status === 401 || response.status === 403) {
      clearSession();
      window.location.href = '/login.html';
      return;
    }
    if (!response.ok) throw new Error(`status ${response.status}`);
    superRequests = await response.json();
    const latestPendingSignature = pendingTargetMatrics(superRequests).join('|');
    const pendingChanged = latestPendingSignature !== lastPendingSignature;
    lastPendingSignature = latestPendingSignature;
    renderSuperRequests();
    if (pendingChanged && teamLoaded && !viewerIsOwner()) {
      renderTeam();
    }
  } catch (error) {
    console.error('The super admin requests could not be loaded.', error);
    elements.requestsLoading.hidden = true;
    elements.requestsError.hidden = false;
  }
}

const ROLE_FAILURES = {
  400: 'That change is not possible for this account.',
  403: 'You are not allowed to do that.',
  404: 'That account no longer exists.',
  other: 'That change did not go through.'
};

async function changeRole(action, id) {
  try {
    const response = await authorisedFetch(`${USERS_URL}${id}/${action}/`, {
      method: 'POST'
    });
    if (!response.ok) {
      console.error('The role change was refused.', response.status, await response.text());
      showNotice(ROLE_FAILURES[response.status] || ROLE_FAILURES.other, 'bad');
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

async function submitSuperRequest(targetId, values) {
  const reason = (values.note || '').trim();
  if (!reason) {
    return 'Write a reason for the owner.';
  }
  if (reason.length > REASON_LIMIT) {
    return 'Keep the reason to 500 characters or fewer.';
  }
  try {
    const response = await authorisedFetch(SUPER_REQUESTS_URL, {
      method: 'POST',
      body: JSON.stringify({ target_id: targetId, reason })
    });
    if (!response.ok) {
      console.error('The super admin request was refused.', response.status, await response.text());
      showNotice(PROMOTION_FAILURES[response.status] || PROMOTION_FAILURES.other, 'bad');
      return false;
    }
    showNotice('Request sent.', 'good');
    return true;
  } catch (error) {
    console.error('The super admin request did not complete.', error);
    showNotice(PROMOTION_FAILURES.other, 'bad');
    return false;
  }
}

async function decideSuperRequest(entry, action) {
  const approving = action === 'approve-super-admin';
  try {
    const response = await authorisedFetch(`${SUPER_REQUESTS_URL}${entry.id}/${approving ? 'approve' : 'decline'}/`, {
      method: 'POST'
    });
    if (!response.ok) {
      if (response.status === 409) {
        const data = await response.json().catch(() => ({}));
        console.error('The super admin request was already decided.', response.status, data);
        showNotice(`Already decided by ${data.decided_by_name || 'someone else'}`, 'bad');
        return true;
      }
      console.error('The super admin decision was refused.', response.status, await response.text());
      showNotice('That decision did not go through.', 'bad');
      return false;
    }
    showNotice(approving ? `${entry.target.full_name} is now a super admin.` : 'Request declined.', 'good');
    return true;
  } catch (error) {
    console.error('The super admin decision did not complete.', error);
    showNotice('That decision did not go through.', 'bad');
    return false;
  }
}

async function handleTeamClick(event) {
  const button = event.target.closest('.record-action');
  if (!button) return;
  const id = Number(button.dataset.id);
  const action = button.dataset.action;
  if (action === 'request-super-admin') {
    const sent = await openActionModal({
      title: 'Request super admin',
      intro: 'The owner reviews this and decides.',
      noteLabel: 'Reason',
      confirmLabel: 'Send request',
      onConfirm: (values) => submitSuperRequest(id, values)
    });
    if (sent) {
      await loadTeam();
      await loadSuperRequests();
    }
    return;
  }
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

async function handleRequestAction(event) {
  const button = event.target.closest('.record-action');
  if (!button) return;
  const entry = superRequests.find((item) => item.id === Number(button.dataset.id));
  if (!entry) return;
  const action = button.dataset.action;
  if (action !== 'approve-super-admin' && action !== 'decline-super-admin') return;
  const approving = action === 'approve-super-admin';
  const ok = await openActionModal({
    title: approving ? `Promote ${entry.target.full_name} to super admin` : `Decline the request for ${entry.target.full_name}`,
    intro: approving ? 'This raises the user to super admin.' : 'The requester will be told no.',
    confirmLabel: approving ? 'Approve' : 'Decline',
    hideNote: true,
    onConfirm: () => decideSuperRequest(entry, action)
  });
  if (ok) {
    await loadTeam();
    await loadSuperRequests();
  }
}

function resetSearch() {
  elements.search.value = '';
  renderSearch();
}

function revealRequestsSection() {
  const owner = viewerIsOwner();
  elements.requestsHeading.textContent = owner ? 'Super admin requests' : 'Your requests';
  elements.requestsEmptyMsg.textContent = owner ? 'No requests waiting.' : 'You have no recent requests.';
  elements.requestsSection.hidden = false;
}

function signOut() {
  endSession();
}

if (!isSuperAdmin()) {
  window.location.href = 'users.html';
} else {
  window.profileReady.then(() => {
    revealRequestsSection();
    loadTeam();
    loadStudents();
    loadSuperRequests();
    startPolling(loadSuperRequests);
  });
  elements.search.addEventListener('input', renderSearch);
  elements.teamGrid.addEventListener('click', handleTeamClick);
  elements.searchGrid.addEventListener('click', handleSearchClick);
  elements.requestsGrid.addEventListener('click', handleRequestAction);
  elements.emptyReset.addEventListener('click', resetSearch);
  elements.teamRetry.addEventListener('click', loadTeam);
  elements.searchRetry.addEventListener('click', loadStudents);
  elements.requestsRetry.addEventListener('click', loadSuperRequests);
  elements.logout.addEventListener('click', signOut);
}