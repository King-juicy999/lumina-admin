const PULSE_URL = `${API}/accounts/staff-pulse/`;
const PULSE_BASE_MS = 30000;
const PULSE_MAX_MS = 300000;
const PULSE_JITTER_MS = 2000;
const PULSE_TOAST_MS = 6000;
const PULSE_TOAST_OUT_MS = 240;
const PULSE_TOAST_MAX = 4;
const PULSE_ALERTS_KEY = 'lumina_alerts';
const PULSE_SVG_NS = 'http://www.w3.org/2000/svg';

const PULSE_ITEMS = {
  feedback: { ref: 'LUMINA / INBOX', message: 'New report in the inbox', href: 'inbox.html' },
  password_resets: { ref: 'LUMINA / INBOX', message: 'New password reset request', href: 'inbox.html' },
  ban_requests: { ref: 'LUMINA / REQUESTS', message: 'New ban request', href: 'requests.html' },
  super_admin_requests: { ref: 'LUMINA / ADMINS', message: 'New super admin request', href: 'admins.html' },
  uploads: { ref: 'LUMINA / LIBRARY', message: 'New upload in the library', href: 'materials.html' },
  signups: { ref: 'LUMINA / USERS', message: 'New student signed up', href: 'users.html' }
};

let pulseTimer = 0;
let pulseInFlight = false;
let pulseFailures = 0;
let pulseRunning = true;

function pulseNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function pulseLine(x1, y1, x2, y2) {
  const line = document.createElementNS(PULSE_SVG_NS, 'line');
  line.setAttribute('x1', String(x1));
  line.setAttribute('y1', String(y1));
  line.setAttribute('x2', String(x2));
  line.setAttribute('y2', String(y2));
  return line;
}

function pulseCross() {
  const svg = document.createElementNS(PULSE_SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('aria-hidden', 'true');
  svg.append(pulseLine(1, 1, 11, 11), pulseLine(11, 1, 1, 11));
  return svg;
}

function onStaffPulse(wanted, handler) {
  document.addEventListener('lumina:staff-pulse', (event) => {
    if (document.querySelector('dialog.action-modal[open]')) {
      return;
    }
    const detail = event.detail || {};
    const changed = detail.changed || [];
    const relevant = wanted ? wanted.some((key) => changed.includes(key)) : changed.length > 0;
    if (relevant) {
      handler(detail);
    }
  });
}

function pulseDelay() {
  const base = pulseFailures === 0 ? PULSE_BASE_MS : Math.min(PULSE_MAX_MS, PULSE_BASE_MS * Math.pow(2, pulseFailures));
  return base + Math.random() * PULSE_JITTER_MS * 2 - PULSE_JITTER_MS;
}

function pulseSchedule() {
  window.clearTimeout(pulseTimer);
  if (!pulseRunning) {
    return;
  }
  pulseTimer = window.setTimeout(pulseTick, pulseDelay());
}

function pulseTick() {
  if (pulseRunning && !pulseInFlight && !document.hidden) {
    pulseRequest();
    return;
  }
  pulseSchedule();
}

async function pulseRequest() {
  pulseInFlight = true;
  try {
    const response = await authorisedFetch(PULSE_URL);
    if (response.status === 401 || response.status === 403) {
      pulseRunning = false;
      return;
    }
    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }
    pulseFailures = 0;
    pulseApply(await response.json());
  } catch (error) {
    console.error('The staff pulse could not be read.', error);
    pulseFailures += 1;
  } finally {
    pulseInFlight = false;
  }
  pulseSchedule();
}

function pulseApply(data) {
  const items = data && data.items ? data.items : {};
  const changed = [];
  for (const key of Object.keys(PULSE_ITEMS)) {
    const item = items[key];
    if (!item || item.latest_id === undefined) {
      continue;
    }
    const stored = sessionStorage.getItem(`lumina_pulse_${key}`);
    if (stored !== null && Number(item.latest_id) > Number(stored)) {
      changed.push(key);
      pulseToast(key);
      pulseNotice(key);
    }
    sessionStorage.setItem(`lumina_pulse_${key}`, String(item.latest_id));
  }
  if (changed.length > 0) {
    document.dispatchEvent(new CustomEvent('lumina:staff-pulse', { detail: { changed: changed, items: items } }));
  }
}

function pulseStack() {
  let host = document.querySelector('.pulse-stack');
  if (!host) {
    host = pulseNode('div', 'pulse-stack');
    document.body.appendChild(host);
  }
  return host;
}

function pulseToast(key) {
  const item = PULSE_ITEMS[key];
  const host = pulseStack();
  while (host.children.length >= PULSE_TOAST_MAX) {
    host.firstElementChild.remove();
  }

  const toast = pulseNode('div', 'pulse-toast pulse-toast--in');
  toast.setAttribute('role', 'status');

  const body = pulseNode('button', 'pulse-toast__body');
  body.type = 'button';
  body.append(pulseNode('span', 'pulse-toast__ref', item.ref), pulseNode('span', 'pulse-toast__message', item.message));

  const close = pulseNode('button', 'pulse-toast__close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Dismiss');
  close.appendChild(pulseCross());

  let timer = 0;
  function dismiss() {
    window.clearTimeout(timer);
    toast.classList.add('pulse-toast--out');
    window.setTimeout(() => toast.remove(), PULSE_TOAST_OUT_MS);
  }

  body.addEventListener('click', () => {
    dismiss();
    window.location.href = item.href;
  });
  close.addEventListener('click', dismiss);

  timer = window.setTimeout(dismiss, PULSE_TOAST_MS);
  host.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('pulse-toast--in');
  });
}

function pulseNotice(key) {
  const item = PULSE_ITEMS[key];
  if (!document.hidden || localStorage.getItem(PULSE_ALERTS_KEY) !== 'on') {
    return;
  }
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }
  try {
    const notice = new Notification('Lumina Admin', { body: item.message });
    notice.addEventListener('click', () => {
      window.focus();
      window.location.href = item.href;
    });
  } catch (error) {
    console.error('The browser notification could not be shown.', error);
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    pulseTick();
  }
});

window.profileReady.then(pulseTick);
