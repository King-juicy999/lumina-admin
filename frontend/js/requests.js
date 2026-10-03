const REQUESTS_URL = `${API}/accounts/ban-requests/`;

let banRequests = [];
const openedRequests = new Set();

const requestElements = {
  records: document.getElementById('records'),
  count: document.getElementById('results-count'),
  empty: document.getElementById('empty-state'),
  logout: document.getElementById('logout-btn')
};

function buildRequestBody(entry, isOpen) {
  const body = makeNode('div', 'resource-card__body');
  body.appendChild(makeNode('h3', 'resource-card__title', entry.user_name || `User ${entry.user}`));
  body.appendChild(makeNode('p', 'resource-card__ref', `Requested by ${entry.requested_by_name || 'an admin'}`));

  const meta = makeNode('p', 'resource-card__meta');
  meta.textContent = `Reason: ${humaniseCode(entry.reason || 'not given')}`;
  body.appendChild(meta);

  if (isOpen) {
    const note = makeNode('p', 'resource-card__meta');
    note.textContent = entry.note || 'No note was left with this request.';
    body.appendChild(note);
  }

  return body;
}

function buildRequestFoot(entry, isOpen) {
  const foot = makeNode('div', 'resource-card__foot');

  const toggle = makeNode('button', 'record-action record-action--toggle', isOpen ? 'Hide details' : 'View details');
  toggle.type = 'button';
  toggle.dataset.id = String(entry.id);
  foot.appendChild(toggle);

  const approve = makeNode('button', 'record-action record-action--approve', 'Approve');
  approve.type = 'button';
  approve.dataset.id = String(entry.id);
  foot.appendChild(approve);

  const deny = makeNode('button', 'record-action record-action--deny', 'Deny');
  deny.type = 'button';
  deny.dataset.id = String(entry.id);
  foot.appendChild(deny);

  return foot;
}

function buildRequestCard(entry) {
  const isOpen = openedRequests.has(entry.id);
  const card = makeNode('article', 'resource-card');
  card.appendChild(buildRequestBody(entry, isOpen));
  card.appendChild(buildRequestFoot(entry, isOpen));
  return card;
}

function renderRequests() {
  requestElements.records.replaceChildren(...banRequests.map(buildRequestCard));
  const total = banRequests.length;
  requestElements.count.textContent = `${total} ${total === 1 ? 'request' : 'requests'}`;
  requestElements.empty.hidden = total > 0;
}

function dropRequest(id) {
  banRequests = banRequests.filter((entry) => entry.id !== id);
  openedRequests.delete(id);
  renderRequests();
}

async function decideRequest(entry, decision) {
  const names = { approve: 'approve', deny: 'deny' };
  try {
    const response = await authorisedFetch(`${REQUESTS_URL}${entry.id}/${names[decision]}/`, {
      method: 'POST',
      body: JSON.stringify({ note: entry.note || '' })
    });
    if (!response.ok) {
      console.error(`The ban request was refused with ${response.status}.`, await response.text());
      showNotice(decision === 'approve' ? 'That approval did not go through.' : 'That refusal did not go through.', 'bad');
      return;
    }
    dropRequest(entry.id);
    showNotice(decision === 'approve' ? `${entry.user_name} is banned.` : 'The ban request was refused.', 'good');
  } catch (error) {
    console.error('The ban request decision did not complete.', error);
    showNotice('That decision did not go through.', 'bad');
  }
}

function handleRequestAction(event) {
  const button = event.target.closest('.record-action');
  if (!button) {
    return;
  }

  const id = Number(button.dataset.id);
  const entry = banRequests.find((item) => item.id === id);
  if (!entry) {
    return;
  }

  if (button.classList.contains('record-action--toggle')) {
    if (openedRequests.has(id)) {
      openedRequests.delete(id);
    } else {
      openedRequests.add(id);
    }
    renderRequests();
    return;
  }

  decideRequest(entry, button.dataset.action);
}

async function loadBanRequests() {
  if (!isSuperAdmin()) {
    window.location.href = 'index.html';
    return;
  }

  const token = sessionStorage.getItem('lumina_access_token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  try {
    const response = await fetch(REQUESTS_URL, {
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
    banRequests = await response.json();
  } catch (error) {
    console.error('The ban requests could not be loaded.', error);
    banRequests = [];
  }
  renderRequests();
}

function signOutOfRequests() {
  clearSession();
  window.location.href = '/login.html';
}

requestElements.records.addEventListener('click', handleRequestAction);
requestElements.logout.addEventListener('click', signOutOfRequests);

loadBanRequests();
