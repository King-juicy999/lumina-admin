const RESETS_URL = `${API}/accounts/password-resets/`;

let resetRequests = [];

const resetElements = {
  tabNotes: document.getElementById('tab-notes'),
  tabResets: document.getElementById('tab-resets'),
  notesPanel: document.getElementById('notes-panel'),
  resetsPanel: document.getElementById('resets-panel'),
  count: document.getElementById('resets-count'),
  grid: document.getElementById('resets-grid'),
  loading: document.getElementById('resets-loading'),
  error: document.getElementById('resets-error'),
  retry: document.getElementById('resets-retry'),
  empty: document.getElementById('resets-empty')
};

const RESET_FAILURES = {
  400: 'That request cannot be handled right now.',
  403: 'You are not allowed to do that.',
  404: 'That request is no longer there.',
  409: 'That password is not ready to send yet.',
  other: 'That did not go through. Try again.'
};

function resetNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function resetStamp(value) {
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function resetStatusPill(request) {
  const labels = {
    pending: 'Waiting',
    ready: 'Password ready',
    sent: 'Sent',
    delivered: 'Collected'
  };
  const pill = resetNode('span', `pill pill--reset-${request.status}`, labels[request.status] || request.status);
  return pill;
}

function buildResetCard(request) {
  const card = resetNode('article', 'inbox-note-card reset-card');
  card.dataset.id = String(request.id);

  const head = resetNode('div', 'reset-card__head');
  head.appendChild(resetStatusPill(request));
  head.appendChild(resetNode('span', 'inbox-note-date', `Asked ${resetStamp(request.requested_at)}`));
  card.appendChild(head);

  card.appendChild(resetNode('p', 'reset-card__name', request.full_name));
  card.appendChild(resetNode('p', 'resource-card__ref', request.matric_number));

  const foot = resetNode('div', 'reset-card__foot');
  if (request.status === 'pending') {
    foot.appendChild(resetButton('Reset password', 'issue', request));
  }
  if (request.status === 'ready') {
    foot.appendChild(resetButton('Send response', 'send', request));
    foot.appendChild(resetButton('Reset again', 'issue', request));
  }
  if (request.status === 'sent' || request.status === 'delivered') {
    foot.appendChild(resetButton('Reset again', 'issue', request));
  }
  card.appendChild(foot);

  return card;
}

function resetButton(label, action, request) {
  const button = resetNode('button', `record-action record-action--${action === 'send' ? 'promote' : 'password'}`, label);
  button.type = 'button';
  button.dataset.action = action;
  button.dataset.id = String(request.id);
  return button;
}

function renderResetCount() {
  const waiting = resetRequests.filter((request) => request.status === 'pending').length;
  resetElements.count.textContent = String(waiting);
  resetElements.count.hidden = waiting === 0;
}

function renderResets() {
  resetElements.grid.replaceChildren(...resetRequests.map(buildResetCard));
  resetElements.loading.hidden = true;
  resetElements.error.hidden = true;
  resetElements.empty.hidden = resetRequests.length > 0;
  renderResetCount();
  if (!resetElements.resetsPanel.hidden) {
    setBandCount(`${resetRequests.length} ${resetRequests.length === 1 ? 'request' : 'requests'}`);
  }
}

async function loadResets() {
  resetElements.loading.hidden = false;
  resetElements.error.hidden = true;
  try {
    const response = await authorisedFetch(RESETS_URL);
    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }
    resetRequests = await response.json();
    renderResets();
  } catch (error) {
    console.error('Password reset requests could not be loaded.', error);
    resetRequests = [];
    resetElements.loading.hidden = true;
    resetElements.error.hidden = false;
    resetElements.empty.hidden = true;
    renderResetCount();
  }
}

function setInboxTab(name) {
  const onResets = name === 'resets';
  resetElements.tabNotes.classList.toggle('active', !onResets);
  resetElements.tabNotes.setAttribute('aria-selected', String(!onResets));
  resetElements.tabResets.classList.toggle('active', onResets);
  resetElements.tabResets.setAttribute('aria-selected', String(onResets));
  resetElements.notesPanel.hidden = onResets;
  resetElements.resetsPanel.hidden = !onResets;
  if (onResets) {
    loadResets();
    return;
  }
  const visible = notes.filter((note) => {
    if (elements.filterCategory.value && note.category !== elements.filterCategory.value) return false;
    if (elements.filterStatus.value && note.status !== elements.filterStatus.value) return false;
    return true;
  }).length;
  setBandCount(`${visible} ${visible === 1 ? 'note' : 'notes'}`);
}

function setBandCount(text) {
  const band = document.getElementById('results-count');
  if (band) {
    band.textContent = text;
  }
}

async function handleResetClick(event) {
  const button = event.target.closest('.record-action');
  if (!button) {
    return;
  }
  const request = resetRequests.find((entry) => entry.id === Number(button.dataset.id));
  if (!request) {
    return;
  }
  if (button.dataset.action === 'issue') {
    issueReset(request);
    return;
  }
  sendReset(request);
}

async function issueReset(request) {
  const done = await openActionModal({
    title: `Reset the password for ${request.full_name}`,
    intro: 'A new password is created for this matric number only. It is not shown to anyone until you send it.',
    confirmLabel: 'Reset password',
    hideNote: true,
    onConfirm: async () => {
      try {
        const response = await authorisedFetch(`${RESETS_URL}${request.id}/issue/`, {
          method: 'POST'
        });
        if (!response.ok) {
          console.error('The password reset was refused.', response.status, await response.text());
          showNotice(RESET_FAILURES[response.status] || RESET_FAILURES.other, 'bad');
          return false;
        }
        return response.json();
      } catch (error) {
        console.error('The password reset did not complete.', error);
        showNotice(RESET_FAILURES.other, 'bad');
        return false;
      }
    }
  });
  if (done && done.status) {
    applyResetResult(request.id, done);
    showNotice('Password ready to send.', 'good');
  }
}

async function sendReset(request) {
  const done = await openActionModal({
    title: `Send the password to ${request.full_name}`,
    intro: `They will collect it by entering ${request.matric_number} and choosing Check response. Only that matric number can collect it.`,
    confirmLabel: 'Send response',
    hideNote: true,
    onConfirm: async () => {
      try {
        const response = await authorisedFetch(`${RESETS_URL}${request.id}/send/`, {
          method: 'POST'
        });
        if (!response.ok) {
          console.error('The password could not be sent.', response.status, await response.text());
          showNotice(RESET_FAILURES[response.status] || RESET_FAILURES.other, 'bad');
          return false;
        }
        return response.json();
      } catch (error) {
        console.error('The password could not be sent.', error);
        showNotice(RESET_FAILURES.other, 'bad');
        return false;
      }
    }
  });
  if (done && done.status) {
    applyResetResult(request.id, done);
    showNotice('Password sent.', 'good');
  }
}

function applyResetResult(id, updated) {
  const request = resetRequests.find((entry) => entry.id === id);
  if (request) {
    Object.assign(request, updated);
  }
  renderResets();
}

function startResets() {
  resetElements.tabNotes.addEventListener('click', () => setInboxTab('notes'));
  resetElements.tabResets.addEventListener('click', () => setInboxTab('resets'));
  resetElements.grid.addEventListener('click', handleResetClick);
  resetElements.retry.addEventListener('click', loadResets);
}
