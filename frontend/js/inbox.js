const API = 'https://william999.pythonanywhere.com/api';
const INBOX_URL = `${API}/feedback/inbox/`;

let notes = [];
let summary = null;

const elements = {
  summaryRow: document.getElementById('summary-row'),
  summaryChips: document.getElementById('summary-chips'),
  filterCategory: document.getElementById('filter-category'),
  filterStatus: document.getElementById('filter-status'),
  notesGrid: document.getElementById('notes-grid'),
  resultsCount: document.getElementById('results-count'),
  loading: document.getElementById('loading'),
  error: document.getElementById('error'),
  emptyState: document.getElementById('empty-state'),
  retryBtn: document.getElementById('retry-btn'),
  logout: document.getElementById('logout-btn'),
  inboxBadge: document.getElementById('inbox-badge')
};

function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(value) {
  return new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function categoryBadge(category) {
  const badge = makeElement('span', 'pill pill--category', category);
  return badge;
}

function statusPill(status) {
  const pill = makeElement('span', 'pill', status.charAt(0).toUpperCase() + status.slice(1));
  pill.classList.add(`pill--status-${status}`);
  return pill;
}

function previewText(message) {
  return message.split('\n')[0].substring(0, 120) || '(No message)';
}

function buildNoteCard(note) {
  const card = makeElement('article', 'inbox-note-card');
  const top = makeElement('div', 'inbox-note-top');

  const left = makeElement('div', 'inbox-note-left');
  left.appendChild(categoryBadge(note.category));

  const middle = makeElement('div', 'inbox-note-middle');
  const preview = makeElement('p', 'inbox-note-preview', previewText(note.message));
  middle.appendChild(preview);

  const right = makeElement('div', 'inbox-note-right');
  const dateSpan = makeElement('span', 'inbox-note-date', formatDate(note.created_at));
  right.appendChild(dateSpan);
  right.appendChild(statusPill(note.status));
  if (note.reply_count > 0) {
    const replyBadge = makeElement('span', 'inbox-reply-count', String(note.reply_count));
    right.appendChild(replyBadge);
  }

  top.append(left, middle, right);
  card.appendChild(top);
  card.dataset.id = String(note.id);
  card.addEventListener('click', () => openNote(note.id));

  return card;
}

function renderNotes() {
  const categoryFilter = elements.filterCategory.value;
  const statusFilter = elements.filterStatus.value;

  const filtered = notes.filter((n) => {
    if (categoryFilter && n.category !== categoryFilter) return false;
    if (statusFilter && n.status !== statusFilter) return false;
    return true;
  });

  elements.notesGrid.replaceChildren(...filtered.map(buildNoteCard));
  elements.resultsCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'note' : 'notes'}`;

  if (filtered.length === 0 && notes.length > 0) {
    elements.emptyState.hidden = false;
  } else {
    elements.emptyState.hidden = true;
  }

  elements.loading.hidden = true;
  elements.error.hidden = true;
  renderSummary();
}

function renderSummary() {
  if (!summary) return;

  elements.summaryChips.replaceChildren();
  const statuses = ['new', 'seen', 'planned', 'fixed', 'declined'];

  for (const status of statuses) {
    const count = summary.counts_by_status[status] || 0;
    const chip = makeElement('button', 'summary-chip', `${status.charAt(0).toUpperCase() + status.slice(1)} ${count}`);
    chip.type = 'button';
    chip.dataset.status = status;
    if (status === elements.filterStatus.value) {
      chip.classList.add('summary-chip--active');
    }
    chip.addEventListener('click', () => {
      if (elements.filterStatus.value === status) {
        elements.filterStatus.value = '';
      } else {
        elements.filterStatus.value = status;
      }
      renderNotes();
    });
    elements.summaryChips.appendChild(chip);
  }

  elements.summaryRow.hidden = false;
}

async function loadSummary() {
  try {
    const response = await authorisedFetch(`${INBOX_URL}summary/`);
    if (response.ok) {
      summary = await response.json();
      renderSummary();
      updateInboxBadge();
    }
  } catch (e) {
    console.error('Summary could not be loaded.', e);
  }
}

async function loadNotes() {
  elements.loading.hidden = false;
  elements.error.hidden = true;
  const token = sessionStorage.getItem('lumina_access_token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }
  try {
    const response = await fetch(INBOX_URL, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
    });
    if (response.status === 401 || response.status === 403) {
      clearSession();
      window.location.href = '/login.html';
      return;
    }
    if (!response.ok) throw new Error(`status ${response.status}`);
    notes = await response.json();
  } catch (error) {
    console.error('Inbox could not be loaded.', error);
    elements.loading.hidden = true;
    elements.error.hidden = false;
    return;
  }
  await loadSummary();
  renderNotes();
}

function updateInboxBadge() {
  if (!summary || !window.profileData || !window.profileData.is_owner) return;
  const newCount = summary.new_count || 0;
  if (newCount > 0) {
    elements.inboxBadge.textContent = String(newCount);
    elements.inboxBadge.hidden = false;
  } else {
    elements.inboxBadge.hidden = true;
  }
}

async function openNote(noteId) {
  const token = sessionStorage.getItem('lumina_access_token');
  let noteData = null;
  try {
    const response = await fetch(`${INBOX_URL}${noteId}/`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`status ${response.status}`);
    noteData = await response.json();
  } catch (error) {
    console.error('Note could not be loaded.', error);
    showNotice('Note could not be loaded.', 'bad');
    return;
  }

  const note = notes.find((n) => n.id === noteId);
  showNoteModal(note, noteData);
}

function showNoteModal(note, noteData) {
  const opener = document.activeElement;
  const dialog = makeElement('dialog', 'note-modal');
  dialog.setAttribute('aria-labelledby', 'note-modal-title');

  const head = makeElement('div', 'note-modal__head');
  const title = makeElement('h2', 'note-modal__title', note.category);
  title.id = 'note-modal-title';
  head.appendChild(title);
  dialog.appendChild(head);

  const body = makeElement('div', 'note-modal__body');

  const message = makeElement('p', 'note-modal__message');
  message.textContent = noteData.message;
  body.appendChild(message);

  const senderLabel = makeElement('p', 'note-modal__sender');
  if (note.contact_matric || note.contact_email) {
    const label = makeElement('span', 'note-modal__sender-label', 'Sender shared their details');
    body.appendChild(label);
    if (note.contact_matric) {
      const matric = makeElement('p', 'note-modal__contact', note.contact_matric);
      body.appendChild(matric);
    }
    if (note.contact_email) {
      const email = makeElement('p', 'note-modal__contact', note.contact_email);
      body.appendChild(email);
    }
  } else {
    senderLabel.textContent = 'Sent anonymously';
    body.appendChild(senderLabel);
  }

  if (noteData.replies && noteData.replies.length > 0) {
    const thread = makeElement('div', 'note-modal__thread');
    for (const reply of noteData.replies) {
      const replyItem = makeElement('div', 'note-reply-item');
      const time = makeElement('p', 'note-reply-time', formatTime(reply.created_at));
      const replyBody = makeElement('p', 'note-reply-body');
      replyBody.textContent = reply.body;
      replyItem.append(time, replyBody);
      thread.appendChild(replyItem);
    }
    body.appendChild(thread);
  }

  const replySection = makeElement('div', 'note-modal__reply-section');
  const replyLabel = makeElement('label', 'field-label', 'Your reply');
  replyLabel.htmlFor = 'note-reply-text';

  const replyWrapper = makeElement('div', 'note-reply-wrapper');
  const replyInput = makeElement('textarea', 'field-input note-reply-input');
  replyInput.id = 'note-reply-text';
  replyInput.placeholder = 'Share your response here';
  replyInput.maxLength = '2000';

  const counter = makeElement('p', 'note-reply-counter', '0 / 2000');
  replyInput.addEventListener('input', () => {
    const length = replyInput.value.length;
    counter.textContent = `${length} / 2000`;
  });

  replyWrapper.append(replyInput, counter);
  replySection.append(replyLabel, replyWrapper);
  body.appendChild(replySection);

  const statusSection = makeElement('div', 'note-modal__status-section');
  const statusLabel = makeElement('label', 'field-label', 'Status');
  statusLabel.htmlFor = 'note-status-select';

  const statusSelect = makeElement('select', 'field-select note-status-select');
  statusSelect.id = 'note-status-select';
  const statuses = ['new', 'seen', 'planned', 'fixed', 'declined'];
  for (const status of statuses) {
    const option = makeElement('option', '', status.charAt(0).toUpperCase() + status.slice(1));
    option.value = status;
    if (status === note.status) option.selected = true;
    statusSelect.appendChild(option);
  }

  statusSelect.addEventListener('change', async () => {
    const token = sessionStorage.getItem('lumina_access_token');
    try {
      const response = await fetch(`${INBOX_URL}${note.id}/status/`, {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusSelect.value })
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      note.status = statusSelect.value;
      const card = elements.notesGrid.querySelector(`[data-id="${note.id}"]`);
      if (card) {
        const pills = card.querySelectorAll('.pill');
        for (const pill of pills) {
          for (const className of pill.classList) {
            if (className.startsWith('pill--status-')) {
              pill.remove();
              break;
            }
          }
        }
        const right = card.querySelector('.inbox-note-right');
        const dateSpan = right.querySelector('.inbox-note-date');
        dateSpan.parentNode.insertBefore(statusPill(note.status), dateSpan.nextSibling);
      }
      renderSummary();
      loadSummary();
    } catch (error) {
      console.error('Status update failed.', error);
      showNotice('Status could not be updated.', 'bad');
    }
  });

  statusSection.append(statusLabel, statusSelect);
  body.appendChild(statusSection);
  dialog.appendChild(body);

  const foot = makeElement('div', 'note-modal__foot');
  const sendBtn = makeElement('button', 'plate-btn', 'Send reply');
  sendBtn.type = 'button';

  function closeDialog(reload) {
    dialog.remove();
    document.removeEventListener('keydown', onKeydown);
    if (opener && opener.focus) {
      opener.focus();
    }
    if (reload) {
      loadNotes();
    }
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      closeDialog(false);
    }
  }

  sendBtn.addEventListener('click', async () => {
    const replyText = replyInput.value.trim();
    if (!replyText) {
      showNotice('Write a reply before sending.', 'bad');
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';

    const token = sessionStorage.getItem('lumina_access_token');
    try {
      const response = await fetch(`${INBOX_URL}${note.id}/reply/`, {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyText })
      });
      if (!response.ok) throw new Error(`status ${response.status}`);

      note.reply_count = (note.reply_count || 0) + 1;
      showNotice('Reply sent.', 'good');
      loadSummary();
      closeDialog(false);
    } catch (error) {
      console.error('Reply could not be sent.', error);
      showNotice('Reply could not be sent.', 'bad');
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send reply';
    }
  });

  const closeBtn = makeElement('button', 'plate-btn plate-btn--ghost', 'Close');
  closeBtn.type = 'button';
  closeBtn.addEventListener('click', () => closeDialog(false));

  foot.append(closeBtn, sendBtn);
  dialog.appendChild(foot);

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      closeDialog(false);
    }
  });

  document.addEventListener('keydown', onKeydown);
  document.body.appendChild(dialog);
  dialog.showModal();
  replyInput.focus();
}

function signOut() {
  clearSession();
  window.location.href = '/login.html';
}

window.profileReady.then(() => {
  if (!window.profileData || !window.profileData.is_owner) {
    window.location.href = 'users.html';
  } else {
    loadNotes();
    elements.filterCategory.addEventListener('change', renderNotes);
    elements.filterStatus.addEventListener('change', renderNotes);
    elements.retryBtn.addEventListener('click', loadNotes);
    elements.logout.addEventListener('click', signOut);
  }
});
