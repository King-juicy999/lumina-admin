const DURATION_UNITS = [
  { value: 'minutes', label: 'Minutes', factor: 1 },
  { value: 'hours', label: 'Hours', factor: 60 },
  { value: 'days', label: 'Days', factor: 1440 }
];

const MINUTES_MAX = 43200;
const NOTE_MIN = 10;
const OTHER_CODE = 'other';

let reasonsRequest = null;

function makeNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function humaniseCode(code) {
  return code.replace(/_/g, ' ');
}

function minutesFrom(amount, unit) {
  const factor = DURATION_UNITS.find((entry) => entry.value === unit).factor;
  return amount * factor;
}

function buildField(labelText, control) {
  const field = makeNode('div', 'field');
  const label = makeNode('label', 'field-label', labelText);
  label.htmlFor = control.id;
  field.append(label, control);
  return field;
}

function buildDuration() {
  const amount = makeNode('input', 'field-input');
  amount.id = 'modal-duration';
  amount.type = 'number';
  amount.min = '1';
  amount.step = '1';
  amount.value = '1';

  const unit = makeNode('select', 'field-select');
  unit.id = 'modal-unit';
  for (const entry of DURATION_UNITS) {
    const option = makeNode('option', '', entry.label);
    option.value = entry.value;
    unit.appendChild(option);
  }
  unit.value = 'hours';

  const row = makeNode('div', 'action-modal__row');
  const amountField = makeNode('div', 'action-modal__col');
  amountField.appendChild(buildField('Length', amount));
  const unitField = makeNode('div', 'action-modal__col');
  unitField.appendChild(buildField('Unit', unit));
  row.append(amountField, unitField);
  return { row, amount, unit };
}

function buildReasons(list) {
  const select = makeNode('select', 'field-select');
  select.id = 'modal-reason';

  const first = makeNode('option', '', 'Choose a reason');
  first.value = '';
  select.appendChild(first);

  for (const entry of list) {
    const option = makeNode('option', '', entry.label || humaniseCode(entry.code));
    option.value = entry.code;
    select.appendChild(option);
  }
  return select;
}

function readValues(parts) {
  const values = (parts.note ? { note: parts.note.value.trim() } : {});
  if (parts.duration) {
    values.minutes = minutesFrom(Number(parts.duration.amount.value), parts.duration.unit.value);
  }
  if (parts.reason) {
    values.reason = parts.reason.value;
  }
  return values;
}

function validate(parts, values) {
  if (parts.duration) {
    const amount = Number(parts.duration.amount.value);
    const unit = parts.duration.unit.value;
    if (!Number.isInteger(amount) || amount < 1) {
      return 'Enter a whole number of minutes, hours or days, at least 1.';
    }
    if (minutesFrom(amount, unit) > MINUTES_MAX) {
      return 'A suspension can run for at most 30 days.';
    }
  }
  if (parts.reason && !values.reason) {
    return 'Choose a reason.';
  }
  if (values.reason === OTHER_CODE && (!values.note || values.note.length < NOTE_MIN)) {
    return 'Write at least 10 characters explaining this one.';
  }
  return null;
}

function openActionModal(config) {
  const opener = document.activeElement;
  const dialog = makeNode('dialog', 'action-modal');
  dialog.setAttribute('aria-labelledby', 'modal-title');

  const head = makeNode('div', 'action-modal__head');
  const title = makeNode('h2', 'action-modal__title', config.title);
  title.id = 'modal-title';
  head.appendChild(title);
  if (config.intro) {
    head.appendChild(makeNode('p', 'action-modal__intro', config.intro));
  }
  dialog.appendChild(head);

  const body = makeNode('div', 'action-modal__body');
  const parts = {};

  if (!config.hideNote) {
    parts.note = makeNode('textarea', 'field-input action-modal__note');
    parts.note.id = 'modal-note';
    parts.note.rows = '3';
  }

  if (config.duration) {
    parts.duration = buildDuration();
    body.appendChild(parts.duration.row);
  }
  if (config.reasons && config.reasons.length) {
    parts.reason = buildReasons(config.reasons);
    body.appendChild(buildField('Reason', parts.reason));
  }
  if (!config.hideNote) {
    body.appendChild(buildField(config.noteLabel || 'Note', parts.note));
  }
  dialog.appendChild(body);

  const error = makeNode('p', 'action-modal__error');
  error.setAttribute('role', 'alert');
  dialog.appendChild(error);

  const foot = makeNode('div', 'action-modal__foot');
  const cancel = makeNode('button', 'plate-btn plate-btn--ghost', 'Cancel');
  cancel.type = 'button';
  const confirm = makeNode('button', 'plate-btn', config.confirmLabel || 'Confirm');
  confirm.type = 'button';
  foot.append(cancel, confirm);
  dialog.appendChild(foot);

  return new Promise((resolve) => {
    function close(result) {
      dialog.remove();
      document.removeEventListener('keydown', onKeydown);
      if (opener && opener.focus) {
        opener.focus();
      }
      resolve(result);
    }

    function onKeydown(event) {
      if (event.key === 'Escape') {
        close(null);
      }
    }

    function submit() {
      if (confirm.disabled) {
        return;
      }
      error.textContent = '';
      const entered = readValues(parts);
      const complaint = validate(parts, entered);
      if (complaint) {
        error.textContent = complaint;
        return;
      }

      if (!config.onConfirm) {
        close(entered);
        return;
      }

      confirm.disabled = true;
      confirm.textContent = 'Working...';
      Promise.resolve(config.onConfirm(entered)).then(
        (done) => {
          if (done === false) {
            confirm.disabled = false;
            confirm.textContent = config.confirmLabel || 'Confirm';
            return;
          }
          close(done && typeof done === 'object' ? { ...entered, ...done } : entered);
        },
        (error) => {
          console.error('The action modal could not finish its request.', error);
          confirm.disabled = false;
          confirm.textContent = config.confirmLabel || 'Confirm';
        }
      );
    }

    cancel.addEventListener('click', () => close(null));
    confirm.addEventListener('click', submit);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        close(null);
      }
    });
    document.addEventListener('keydown', onKeydown);
    document.body.appendChild(dialog);
    dialog.showModal();

    const firstField = parts.duration ? parts.duration.amount : parts.note || parts.reason;
    if (firstField) {
      firstField.focus();
    }
  });
}

let noticeTimer = null;

function showNotice(message, tone) {
  const region = document.getElementById('notice');
  if (!region) {
    return;
  }
  region.textContent = message;
  region.className = `notice notice--${tone || 'info'} notice--visible`;
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    region.className = `notice notice--${tone || 'info'}`;
  }, 4000);
}

function fetchReasons(kind) {
  if (!reasonsRequest) {
    reasonsRequest = authorisedFetch(`${API}/accounts/moderation/reasons/`).then((response) => {
      if (!response.ok) {
        throw new Error(`The moderation reasons request answered ${response.status}.`);
      }
      return response.json();
    });
  }
  return reasonsRequest.then((data) => data[kind] || []).catch((error) => {
    reasonsRequest = null;
    throw error;
  });
}