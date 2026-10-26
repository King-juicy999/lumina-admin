const AUDIT_URL = `${API}/accounts/audit/`;
const PAGE_SIZE = 50;
const REFRESH_INTERVAL = 30000;
const DAY_MS = 24 * 60 * 60 * 1000;

const ACTION_SENTENCES = {
  login: () => 'Signed in',
  logout: () => 'Signed out',
  suspend: (entry) => `Suspended ${targetName(entry)}`,
  unsuspend: (entry) => `Unsuspended ${targetName(entry)}`,
  ban: (entry) => `Banned ${targetName(entry)}`,
  ban_request: (entry) => `Asked the owner to ban ${targetName(entry)}`,
  ban_approve: (entry) => `Approved the ban request for ${targetName(entry)}`,
  ban_deny: (entry) => `Denied the ban request for ${targetName(entry)}`,
  restore_user: (entry) => `Restored ${targetName(entry)}`,
  hide_material: (entry) => `Hid material ${entry.target_material_id}`,
  restore_material: (entry) => `Restored material ${entry.target_material_id}`,
  promote_admin: (entry) => `Promoted ${targetName(entry)}`,
  demote_admin: (entry) => `Demoted ${targetName(entry)}`,
  reset_password: (entry) => `Reset the password for ${targetName(entry)}`,
  promotion_request: (entry) => `Asked the owner to promote ${targetName(entry)}`,
  promotion_approve: (entry) => `Approved the promotion for ${targetName(entry)}`,
  promotion_decline: (entry) => `Declined the promotion for ${targetName(entry)}`,
  permanent_delete: (entry) => `Permanently deleted ${targetName(entry)}`
};

const ROLE_PILLS = {
  owner: ['pill--owner', 'Owner'],
  super_admin: ['pill--super', 'Super admin'],
  admin: ['pill--staff', 'Admin']
};

const TAB_GROUPS = ['admins', 'super_admins', 'owner'];

let activeTab = 'admins';

const tabState = {};
TAB_GROUPS.forEach((group) => {
  tabState[group] = {
    entries: [],
    loaded: false,
    failed: false,
    complete: false,
    loadingOlder: false,
    olderFailed: false,
    action: '',
    actor: ''
  };
});

const elements = {
  tabs: Array.from(document.querySelectorAll('.audit-tabs .audit-tab')),
  action: document.getElementById('action-filter'),
  actor: document.getElementById('actor-filter'),
  list: document.getElementById('audit-list'),
  state: document.getElementById('audit-state'),
  older: document.getElementById('load-older')
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

function makeOption(value, label) {
  const node = makeElement('option', null, label);
  node.value = value;
  return node;
}

function targetName(entry) {
  return entry.target_full_name || entry.target_user || 'someone';
}

function humanise(value) {
  return String(value || '').replace(/_/g, ' ');
}

function describeAction(entry) {
  const build = ACTION_SENTENCES[entry.action];
  if (build) {
    return build(entry);
  }
  return humanise(entry.action);
}

function rolePill(role) {
  const match = ROLE_PILLS[role];
  if (!match) {
    return null;
  }
  return makeElement('span', `pill ${match[0]}`, match[1]);
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
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

function dayKey(value) {
  return new Date(value).toDateString();
}

function dayLabel(value, today, yesterday) {
  const key = dayKey(value);
  if (key === today) {
    return 'Today';
  }
  if (key === yesterday) {
    return 'Yesterday';
  }
  return new Date(value).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function byNewest(a, b) {
  return new Date(b.created_at) - new Date(a.created_at);
}

function currentTab() {
  return tabState[activeTab];
}

function buildAuditUrl(group, before) {
  const state = tabState[group];
  const params = new URLSearchParams();
  params.set('group', group);
  params.set('limit', String(PAGE_SIZE));
  if (state.action) {
    params.set('action', state.action);
  }
  if (state.actor) {
    params.set('actor', state.actor);
  }
  if (before) {
    params.set('before', before);
  }
  return `${AUDIT_URL}?${params.toString()}`;
}

async function fetchRows(url) {
  const response = await authorisedFetch(url);
  if (!response.ok) {
    throw new Error(`the activity responded ${response.status}`);
  }
  return response.json();
}

function addEntries(state, rows) {
  const seen = new Set(state.entries.map((entry) => entry.id));
  const fresh = rows.filter((entry) => !seen.has(entry.id));
  if (!fresh.length) {
    return false;
  }
  state.entries = state.entries.concat(fresh).sort(byNewest);
  return true;
}

function showState(message, failed) {
  elements.list.hidden = true;
  elements.state.hidden = false;
  elements.state.replaceChildren();
  elements.state.appendChild(makeElement('p', null, message));
  if (!failed) {
    return;
  }
  const button = makeElement('button', 'empty-reset', 'Retry');
  button.type = 'button';
  button.addEventListener('click', () => loadTab(activeTab));
  elements.state.appendChild(button);
}

async function loadTab(group) {
  const state = tabState[group];
  state.failed = false;
  state.olderFailed = false;
  elements.action.value = state.action;
  elements.actor.value = state.actor;
  if (!state.loaded) {
    showState('Reading the activity.');
  }
  try {
    const rows = await fetchRows(buildAuditUrl(group));
    if (group !== activeTab) {
      return;
    }
    state.entries = rows;
    state.loaded = true;
    state.complete = rows.length < PAGE_SIZE;
    renderTab();
  } catch (error) {
    console.error('The activity could not be loaded.', error);
    if (group !== activeTab) {
      return;
    }
    state.failed = true;
    if (state.loaded && state.entries.length) {
      renderTab();
    } else {
      showState('The activity could not be read just now.', true);
    }
  }
}

async function loadOlder() {
  const state = currentTab();
  if (state.loadingOlder || state.complete || !state.entries.length) {
    return;
  }
  state.loadingOlder = true;
  state.olderFailed = false;
  renderOlder(state);
  try {
    const before = state.entries[state.entries.length - 1].created_at;
    const rows = await fetchRows(buildAuditUrl(activeTab, before));
    state.complete = rows.length < PAGE_SIZE;
    addEntries(state, rows);
  } catch (error) {
    console.error('The older entries could not be loaded.', error);
    state.olderFailed = true;
  }
  state.loadingOlder = false;
  renderTab();
}

async function refreshTab() {
  const group = activeTab;
  const state = tabState[group];
  if (!state.loaded) {
    return;
  }
  try {
    const rows = await fetchRows(buildAuditUrl(group));
    if (group !== activeTab || !addEntries(state, rows)) {
      return;
    }
    renderTab();
  } catch (error) {
    console.error('The activity could not be refreshed.', error);
  }
}

function renderTabButtons() {
  for (const button of elements.tabs) {
    const on = button.dataset.group === activeTab;
    button.classList.toggle('audit-tab--on', on);
    button.setAttribute('aria-pressed', String(on));
  }
}

function renderActorOptions(state) {
  const seen = new Map();
  for (const entry of state.entries) {
    if (entry.actor_id === undefined || entry.actor_id === null) {
      continue;
    }
    const key = String(entry.actor_id);
    if (!seen.has(key)) {
      seen.set(key, entry.actor_name || 'Unknown');
    }
  }
  elements.actor.replaceChildren();
  elements.actor.appendChild(makeOption('', 'Everyone'));
  for (const pair of seen) {
    elements.actor.appendChild(makeOption(pair[0], pair[1]));
  }
}

function renderOlder(state) {
  const show = state.loaded && state.entries.length > 0 && !state.complete;
  elements.older.hidden = !show;
  if (!show) {
    return;
  }
  if (state.olderFailed) {
    elements.older.textContent = 'Could not load older entries. Try again';
    elements.older.disabled = false;
    return;
  }
  if (state.loadingOlder) {
    elements.older.textContent = 'Loading older entries.';
    elements.older.disabled = true;
    return;
  }
  elements.older.textContent = 'Load older';
  elements.older.disabled = false;
}

function buildEntry(entry) {
  const card = makeElement('article', 'audit-entry');
  const top = makeElement('div', 'audit-entry__top');
  const time = makeElement('span', 'audit-entry__time', formatTime(entry.created_at));
  time.title = formatStamp(entry.created_at);
  top.appendChild(time);
  top.appendChild(makeElement('span', 'audit-entry__actor', entry.actor_name || 'Unknown'));
  const role = rolePill(entry.actor_role);
  if (role) {
    top.appendChild(role);
  }
  card.appendChild(top);
  card.appendChild(makeElement('p', 'audit-entry__sentence', describeAction(entry)));
  const reason = humanise(entry.reason_code);
  const note = entry.note ? String(entry.note) : '';
  if (reason || note) {
    const detail = makeElement('div', 'audit-entry__detail');
    if (reason) {
      detail.appendChild(makeElement('span', 'audit-entry__reason', `Reason: ${reason}`));
    }
    if (note) {
      detail.appendChild(makeElement('span', 'audit-entry__note', entry.note));
    }
    card.appendChild(detail);
  }
  return card;
}

function renderList(state) {
  elements.state.hidden = true;
  elements.state.replaceChildren();
  elements.list.hidden = false;
  elements.list.replaceChildren();
  const today = dayKey(Date.now());
  const yesterday = dayKey(Date.now() - DAY_MS);
  let lastDay = '';
  for (const entry of state.entries) {
    const key = dayKey(entry.created_at);
    if (key !== lastDay) {
      elements.list.appendChild(makeElement('h2', 'audit-day', dayLabel(entry.created_at, today, yesterday)));
      lastDay = key;
    }
    elements.list.appendChild(buildEntry(entry));
  }
}

function renderTab() {
  renderTabButtons();
  const state = currentTab();
  elements.action.value = state.action;
  renderActorOptions(state);
  elements.actor.value = state.actor;
  if (state.loaded && !state.entries.length) {
    showState('No activity to show.');
  } else if (state.failed && !state.entries.length) {
    showState('The activity could not be read just now.', true);
  } else {
    renderList(state);
    renderOlder(state);
  }
}

function switchTab(group) {
  if (group === activeTab) {
    return;
  }
  activeTab = group;
  const state = currentTab();
  renderTabButtons();
  if (state.loaded || state.failed) {
    renderTab();
  } else {
    loadTab(group);
  }
}

function handleActionFilter() {
  const state = currentTab();
  state.action = elements.action.value;
  state.actor = '';
  loadTab(activeTab);
}

function handleActorFilter() {
  const state = currentTab();
  state.actor = elements.actor.value;
  loadTab(activeTab);
}

for (const button of elements.tabs) {
  button.addEventListener('click', () => switchTab(button.dataset.group));
}
elements.action.addEventListener('change', handleActionFilter);
elements.actor.addEventListener('change', handleActorFilter);
elements.older.addEventListener('click', loadOlder);

window.profileReady.then(() => {
  if (!window.profileData || !window.profileData.is_owner) {
    window.location.href = 'index.html';
    return;
  }
  loadTab(activeTab);
  startPolling(refreshTab, REFRESH_INTERVAL);
});
