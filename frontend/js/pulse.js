const PULSE_URL = `${API}/accounts/staff-pulse/`;
const PULSE_BASE_MS = 30000;
const PULSE_MAX_MS = 300000;
const PULSE_JITTER_MS = 2000;
const PULSE_TOAST_MS = 6000;
const PULSE_TOAST_OUT_MS = 240;
const PULSE_TOAST_MAX = 4;
const PULSE_MINE_TOAST_MS = 10000;
const PULSE_MINE_URL = `${API}/accounts/notifications/`;
const PULSE_MINE_KEY = 'lumina_pulse_mine';
const PULSE_MINE_FIRST = 3;
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
let pulseMineInFlight = false;
const pulseMineShown = new Set();

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
      pulseToast(PULSE_ITEMS[key]);
      pulseNotice(PULSE_ITEMS[key]);
    }
    sessionStorage.setItem(`lumina_pulse_${key}`, String(item.latest_id));
  }
  const mine = items.mine;
  if (mine && mine.latest_id !== undefined) {
    void pulseMine(mine);
  }
  if (changed.length > 0) {
    document.dispatchEvent(new CustomEvent('lumina:staff-pulse', { detail: { changed: changed, items: items } }));
  }
}

async function pulseMineFetch(sinceId) {
  const response = await authorisedFetch(`${PULSE_MINE_URL}poll/?since=${sinceId}`);
  if (response.status === 401 || response.status === 403) {
    pulseRunning = false;
    return null;
  }
  if (!response.ok) {
    throw new Error(`status ${response.status}`);
  }
  const data = await response.json();
  return data.results || [];
}

function pulseMineShow(notice) {
  if (pulseMineShown.has(String(notice.id))) {
    return;
  }
  pulseMineShown.add(String(notice.id));
  const item = { ref: notice.title, message: notice.message };
  pulseToast(item, PULSE_MINE_TOAST_MS);
  pulseNotice(item);
  void pulseMineAck(notice.id);
}

async function pulseMineAck(id) {
  try {
    await authorisedFetch(`${PULSE_MINE_URL}${id}/read/`, { method: 'POST' });
  } catch (error) {
    console.error('The personal notice could not be marked read.', error);
  }
}

async function pulseMine(mine) {
  if (pulseMineInFlight) {
    return;
  }
  pulseMineInFlight = true;
  try {
    const stored = sessionStorage.getItem(PULSE_MINE_KEY);
    const latestId = Number(mine.latest_id);
    let sinceId = null;
    if (stored === null) {
      if (Number(mine.count) > 0) {
        sinceId = 0;
      }
    } else if (latestId > Number(stored)) {
      sinceId = Number(stored);
    }
    if (sinceId !== null && pulseRunning) {
      const notices = await pulseMineFetch(sinceId);
      if (notices === null) {
        return;
      }
      const shown = sinceId === 0 ? notices.slice(-PULSE_MINE_FIRST) : notices;
      for (const notice of shown) {
        pulseMineShow(notice);
      }
    }
    sessionStorage.setItem(PULSE_MINE_KEY, String(latestId));
  } catch (error) {
    console.error('The personal notices could not be read.', error);
    pulseFailures += 1;
  } finally {
    pulseMineInFlight = false;
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

function pulseToast(item, ms = PULSE_TOAST_MS) {
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
    if (item.href) {
      window.location.href = item.href;
    }
  });
  close.addEventListener('click', dismiss);

  timer = window.setTimeout(dismiss, ms);
  toast.append(body, close);
  host.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('pulse-toast--in');
  });
}

function pulseNotice(item) {
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
      if (item.href) {
        window.location.href = item.href;
      }
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
