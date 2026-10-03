const API = 'https://william999.pythonanywhere.com/api';
const REQUESTS_URL = `${API}/accounts/ban-requests/`;

let banRequests = [];

const requestElements = {
  records: document.getElementById('records'),
  count: document.getElementById('results-count'),
  empty: document.getElementById('empty-state'),
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

function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function populateRequestList(requests) {
  requestElements.records.replaceChildren(...requests.map(buildRequestCard));
  const total = requests.length;
  requestElements.count.textContent = `${total} ${total === 1 ? 'request' : 'requests'}`;
  requestElements.empty.hidden = total > 0;
}

function dropRequest(id) {
  banRequests = banRequests.filter((entry) => entry.id !== id);
  populateRequestList(banRequests);
}

function runAction(url, body) {
  const messages = {
    400: 'Check the details and try again.',
    403: 'You are not allowed to do that.',
    404: 'That record no longer exists.',
    other: 'That action did not go through.'
  };
  return new Promise((resolve) => {
    const btn = document.querySelector('.action-modal__foot .plate-btn:not(.plate-btn--ghost)');
    const confirmText = btn ? btn.textContent : 'Confirm';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Working...';
    }
    authorisedFetch(url, { method: 'POST', body: JSON.stringify(body) })
      .then((response) => {
        if (btn) {
          btn.disabled = false;
          btn.textContent = confirmText;
        }
        if (!response.ok) {
          console.error('The ban decision was refused.', response.status);
          showNotice(messages[response.status] || messages.other, 'bad');
          resolve(false);
          return;
        }
        resolve(true);
      })
      .catch((error) => {
        if (btn) {
          btn.disabled = false;
          btn.textContent = confirmText;
        }
        console.error('The ban decision did not complete.', error);
        showNotice(messages.other, 'bad');
        resolve(false);
      });
  });
}

async function decideRequest(entry, decision) {
  const names = { approve: 'approve', deny: 'deny' };
  const url = `${REQUESTS_URL}${entry.id}/${names[decision]}/`;
  const ok = await runAction(url, { decision_note: entry.decision_note || '' });
  if (ok) {
    dropRequest(entry.id);
    showNotice(decision === 'approve' ? `${entry.target.full_name} is banned.` : 'The ban request was refused.', 'good');
  }
}

function buildRequestCard(entry) {
  const card = makeElement('article', 'resource-card');
  const avatar = makeElement('span', 'avatar', initials(entry.target.full_name));
  card.appendChild(avatar);

  const body = makeElement('div', 'resource-card__body');
  body.appendChild(makeElement('h3', 'resource-card__title', entry.target.full_name));
  body.appendChild(makeElement('p', 'resource-card__ref', entry.target.matric_number));
  body.appendChild(makeElement('p', 'resource-card__meta', `Faculty: ${labelFor(FACULTY_NAMES, entry.target.faculty)}`));
  body.appendChild(makeElement('p', 'resource-card__meta', `Department: ${labelFor(DEPARTMENT_NAMES, entry.target.department)}`));
  body.appendChild(makeElement('p', 'resource-card__meta', `Programme: ${labelFor(PROGRAM_NAMES, entry.target.program)}`));
  body.appendChild(makeElement('p', 'resource-card__meta', `Requested by ${entry.requested_by_name || 'an admin'}`));
  body.appendChild(makeElement('p', 'resource-card__meta', `Reason: ${entry.reason_label || 'not given'}`));
  body.appendChild(makeElement('p', 'resource-card__meta', `Requested: ${formatDate(entry.created_at)}`));
  body.appendChild(makeElement('p', 'resource-card__meta', `Note: ${entry.note || 'none'}`));
  card.appendChild(body);

  const foot = makeElement('div', 'resource-card__foot');
  const approve = makeElement('button', 'record-action record-action--approve', 'Approve ban');
  approve.type = 'button';
  approve.dataset.action = 'approve';
  approve.dataset.id = String(entry.id);
  foot.appendChild(approve);
  const deny = makeElement('button', 'record-action record-action--deny', 'Deny');
  deny.type = 'button';
  deny.dataset.action = 'deny';
  deny.dataset.id = String(entry.id);
  foot.appendChild(deny);
  card.appendChild(foot);
  return card;
}

function handleRequestAction(event) {
  const button = event.target.closest('.record-action');
  if (!button || !button.dataset.action) {
    return;
  }
  const id = Number(button.dataset.id);
  const entry = banRequests.find((item) => item.id === id);
  if (!entry) {
    return;
  }
  const decision = button.dataset.action;
  const title =
    decision === 'approve' ? `Approve the ban on ${entry.target.full_name}` : `Deny the ban request`;
  const intro =
    decision === 'approve'
      ? 'The account will show as deleted to the user. The record is kept.'
      : 'The request is refused and the account keeps access.';
  openActionModal({
    title,
    intro,
    confirmLabel: decision === 'approve' ? 'Approve ban' : 'Deny',
    onConfirm: (values) => {
      entry.decision_note = values.note || '';
      return decideRequest(entry, decision);
    }
  });
}

async function loadBanRequests() {
  const token = sessionStorage.getItem('lumina_access_token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }
  if (!isSuperAdmin()) {
    window.location.href = 'users.html';
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
  populateRequestList(banRequests);
}

function signOut() {
  clearSession();
  window.location.href = '/login.html';
}

requestElements.records.addEventListener('click', handleRequestAction);
requestElements.logout.addEventListener('click', signOut);

loadBanRequests();
