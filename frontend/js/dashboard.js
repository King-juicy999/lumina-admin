const DASH_STATS_URL = `${API}/materials/stats/`;
const DASH_RECYCLE_URL = `${API}/accounts/recycle/summary/`;
const DASH_INBOX_URL = `${API}/feedback/inbox/summary/`;
const DASH_BANS_URL = `${API}/accounts/ban-requests/`;
const DASH_RESETS_URL = `${API}/accounts/password-resets/`;
const DASH_USERS_URL = `${API}/accounts/users/`;
const DASH_HEALTH_URL = `${API}/health/`;

const DASH_FAILURE = 'That could not be read just now.';
const DASH_LATEST_COUNT = 4;
const DASH_GAUGE_MAX_MS = 1500;

const DASH_RANGES = [
  { id: '1W', label: '1W', days: 7 },
  { id: '1M', label: '1M', days: 30 },
  { id: '1Y', label: '1Y', months: 12 }
];

const DASH_ROLES = [
  { id: 'student', label: 'Students', tone: 'stamp' },
  { id: 'admin', label: 'Admins', tone: 'ledger' },
  { id: 'super_admin', label: 'Super admins', tone: 'red' }
];

const DASH_STATUSES = [
  { id: 'new', label: 'New' },
  { id: 'seen', label: 'Seen' },
  { id: 'planned', label: 'Planned' },
  { id: 'fixed', label: 'Fixed' },
  { id: 'declined', label: 'Declined' }
];

const DASH_QUEUE = [
  { id: 'bans', label: 'Ban requests', note: 'decisions waiting', href: 'requests.html', page: 'Ban requests', value: 0 },
  { id: 'resets', label: 'Password resets', note: 'requests waiting', href: 'inbox.html', page: 'Inbox', value: 0 },
  { id: 'notes', label: 'Feedback notes', note: 'new since your last look', href: 'inbox.html', page: 'Inbox', value: 0 }
];

const DASH_ADMIN_QUEUE = [
  { id: 'added', label: 'Added this week', note: 'new in the catalogue', href: 'materials.html', page: 'Materials', value: 0 },
  { id: 'joined', label: 'Joined this week', note: 'sign ups this week', href: 'users.html', page: 'Users', value: 0 },
  { id: 'suspended', label: 'Suspended students', note: 'access held', href: 'users.html', page: 'Users', value: 0 }
];

const SVG_NS = 'http://www.w3.org/2000/svg';
const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const CHART_PAD = { top: 18, right: 18, bottom: 34, left: 46 };
const CODE_SPLIT = /\s*?([A-Z]{2,3})\s*(\d+)$/;

function dash(name) {
  return dashAdmin ? name + '-admin' : name;
}

function queueEntries() {
  return dashAdmin ? DASH_ADMIN_QUEUE : DASH_QUEUE;
}

let dashUsers = null;
let dashRange = '1W';
let dashQueueOrder = ['notes', 'resets', 'bans'];
let dashChart = null;
let dashAdmin = false;

function svgNode(tag, attributes) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const name in attributes) {
    node.setAttribute(name, attributes[name]);
  }
  return node;
}

function dashReduced() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function formatNumber(value) {
  return Number(value).toLocaleString('en-GB');
}

function firstNameOf(name) {
  const parts = String(name || '').trim().split(/\s+/);
  return parts[0] || 'there';
}

function greetingFor(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(value) {
  const stamp = new Date(value).getTime();
  if (!Number.isFinite(stamp)) return 'recently';
  const minutes = Math.max(0, Math.floor((Date.now() - stamp) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)} mo ago`;
}

function initialsOf(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function shortDate(value) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

async function readJson(url) {
  const response = await authorisedFetch(url);
  if (!response.ok) {
    throw new Error(`request responded ${response.status}`);
  }
  return response.json();
}

function setTileState(tile, message, onRetry) {
  const node = tile.querySelector('.dash-state');
  if (!node) return;
  node.replaceChildren();
  node.classList.toggle('dash-state--busy', !onRetry);
  if (!message) {
    node.hidden = true;
    return;
  }
  node.hidden = false;
  node.appendChild(makeElement('span', 'dash-state__text', message));
  if (onRetry) {
    const button = makeElement('button', 'dash-retry', 'Retry');
    button.type = 'button';
    button.addEventListener('click', onRetry);
    node.appendChild(button);
  }
}

function beginTile(tile) {
  tile.setAttribute('aria-busy', 'true');
  setTileState(tile, 'Reading the latest figures.');
}

function endTile(tile) {
  tile.setAttribute('aria-busy', 'false');
  setTileState(tile, '');
}

function failTile(tile, logMessage, error, loader) {
  console.error(logMessage, error);
  tile.setAttribute('aria-busy', 'false');
  setTileState(tile, DASH_FAILURE, loader);
}

function countUp(node, target) {
  const value = Math.max(0, Math.round(Number(target) || 0));
  if (dashReduced() || value === 0) {
    node.textContent = formatNumber(value);
    return;
  }
  const duration = 900;
  const started = performance.now();
  function step(now) {
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    node.textContent = formatNumber(Math.round(value * eased));
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }
  requestAnimationFrame(step);
}

function loadUsers() {
  if (!dashUsers) {
    dashUsers = readJson(DASH_USERS_URL).catch((error) => {
      dashUsers = null;
      throw error;
    });
  }
  return dashUsers;
}

function joinedRecently(user) {
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const stamp = new Date(user.date_joined).getTime();
  return Number.isFinite(stamp) && Date.now() - stamp < oneWeek;
}

function renderGreeting() {
  const node = document.getElementById(dash('dash-greeting'));
  const profile = window.profileData || {};
  node.textContent = `${greetingFor(new Date().getHours())}, ${firstNameOf(profile.full_name)}.`;
}

function heroFigure(label, value, tone) {
  const item = makeElement('div', `dash-figure dash-figure--${tone}`);
  item.appendChild(makeElement('span', 'dash-figure__value', typeof value === 'number' ? formatNumber(value) : value));
  item.appendChild(makeElement('span', 'dash-figure__label', label));
  return item;
}

async function loadHero() {
  const tile = document.getElementById(dash('dash-hero'));
  const figure = document.getElementById(dash('dash-figure'));
  const note = document.getElementById(dash('dash-hero-note'));
  const figures = document.getElementById(dash('dash-hero-figures'));
  beginTile(tile);
  try {
    if (dashAdmin) {
      const stats = await readJson(DASH_STATS_URL);
      const visible = Number(stats.total_materials) || 0;
      const added = Number(stats.materials_this_week) || 0;
      const programs = Number(stats.program_count) || 0;
      const hidden = typeof stats.hidden_materials === 'number' ? stats.hidden_materials : null;
      countUp(figure, visible);
      note.textContent = 'The catalogue as it stands.';
      figures.replaceChildren(
        heroFigure('Added this week', added, 'stamp'),
        heroFigure('Programmes', programs, 'neutral'),
        heroFigure('Hidden', hidden === null ? 'Not tracked' : hidden, 'red')
      );
      endTile(tile);
      return;
    }
    const results = await Promise.all([readJson(DASH_STATS_URL), readJson(DASH_RECYCLE_URL)]);
    const stats = results[0] || {};
    const recycle = results[1] || {};
    const visible = Number(stats.total_materials) || 0;
    const hidden = typeof stats.hidden_materials === 'number' ? stats.hidden_materials : null;
    const recycled = Number(recycle.materials) || 0;
    countUp(figure, visible);
    note.textContent = 'Visible in the catalogue right now.';
    figures.replaceChildren(
      heroFigure('Visible', visible, 'stamp'),
      heroFigure('Hidden', hidden === null ? 'Not tracked' : hidden, 'neutral'),
      heroFigure('Recycled', recycled, 'red')
    );
    endTile(tile);
  } catch (error) {
    failTile(tile, 'The records figure could not be read.', error, loadHero);
  }
}

function renderQueue() {
  const track = document.getElementById(dash('dash-stack'));
  const entries = queueEntries();
  dashQueueOrder.forEach((id, depth) => {
    const card = track.querySelector(`[data-card="${id}"]`);
    const entry = entries.find((item) => item.id === id);
    if (!card || !entry) return;
    const front = depth === dashQueueOrder.length - 1;
    card.style.setProperty('--depth', String(dashQueueOrder.length - 1 - depth));
    card.style.zIndex = String(depth + 1);
    card.classList.toggle('is-front', front);
    card.querySelector('.dash-card__value').textContent = formatNumber(entry.value);
    card.querySelector('.dash-card__note').textContent = entry.note;
    card.querySelector('.dash-card__hint').textContent = front ? `Open ${entry.page}` : 'Bring forward';
    card.setAttribute(
      'aria-label',
      front
        ? `${entry.label}, ${entry.value} ${entry.note}. Opens ${entry.page}.`
        : `${entry.label}, ${entry.value} ${entry.note}. Bring to the front.`
    );
  });
}

function buildQueue() {
  const track = document.getElementById(dash('dash-stack'));
  const cards = queueEntries().map((entry) => {
    const card = makeElement('a', 'dash-card');
    card.href = entry.href;
    card.dataset.card = entry.id;
    card.appendChild(makeElement('span', 'dash-card__label', entry.label));
    card.appendChild(makeElement('span', 'dash-card__value', '0'));
    card.appendChild(makeElement('span', 'dash-card__note', entry.note));
    card.appendChild(makeElement('span', 'dash-card__hint', ''));
    card.addEventListener('click', (event) => {
      if (card.classList.contains('is-front')) {
        return;
      }
      event.preventDefault();
      dashQueueOrder = dashQueueOrder.filter((id) => id !== entry.id);
      dashQueueOrder.push(entry.id);
      renderQueue();
      card.focus();
    });
    return card;
  });
  track.replaceChildren(...cards);
  renderQueue();
}

async function loadQueue() {
  const tile = document.getElementById(dash('dash-waiting'));
  beginTile(tile);
  try {
    if (dashAdmin) {
      const users = await loadUsers();
      const stats = await readJson(DASH_STATS_URL);
      const list = Array.isArray(users) ? users : [];
      const suspended = list.filter((user) => user && user.status === 'suspended').length;
      const joined = list.filter((user) => user && user.role === 'student' && joinedRecently(user)).length;
      const added = Number(stats.materials_this_week) || 0;
      const values = { suspended: suspended, joined: joined, added: added };
      for (const entry of queueEntries()) {
        entry.value = Number(values[entry.id]) || 0;
      }
      renderQueue();
      endTile(tile);
      return;
    }
    const results = await Promise.all([
      readJson(DASH_BANS_URL),
      readJson(DASH_RESETS_URL),
      readJson(DASH_INBOX_URL)
    ]);
    const bans = Array.isArray(results[0]) ? results[0] : [];
    const resets = Array.isArray(results[1]) ? results[1] : [];
    const summary = results[2] || {};
    DASH_QUEUE[0].value = bans.length;
    DASH_QUEUE[1].value = resets.filter((request) => request.status === 'pending').length;
    DASH_QUEUE[2].value = Number(summary.new_count) || 0;
    renderQueue();
    endTile(tile);
  } catch (error) {
    failTile(tile, 'The waiting queue could not be read.', error, loadQueue);
  }
}

function measureHealth() {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const request = new XMLHttpRequest();
    request.open('GET', DASH_HEALTH_URL, true);
    request.timeout = 12000;
    request.setRequestHeader('Accept', 'application/json');
    request.onload = () => {
      const elapsed = Math.round(performance.now() - started);
      if (request.status >= 200 && request.status < 300) {
        resolve(elapsed);
        return;
      }
      reject(new Error(`the check responded ${request.status}`));
    };
    request.onerror = () => reject(new Error('the check could not reach Lumina'));
    request.ontimeout = () => reject(new Error('the check timed out'));
    request.send();
  });
}

function gaugeVerdict(elapsed) {
  if (elapsed < 400) return 'Quick';
  if (elapsed < 900) return 'Steady';
  return 'Slow';
}

function gaugeParts(host) {
  const existing = host.querySelector('.dash-gauge__arc');
  if (existing) {
    return { host, arc: existing, needle: host.querySelector('.dash-gauge__needle') };
  }

  const svg = svgNode('svg', {
    viewBox: '0 0 200 118',
    class: 'dash-gauge__svg',
    role: 'img',
    'aria-label': 'Response time gauge'
  });
  const arcPath = 'M 16 104 A 84 84 0 0 1 184 104';
  svg.appendChild(svgNode('path', { d: arcPath, class: 'dash-gauge__track', pathLength: '100' }));
  const arc = svgNode('path', {
    d: arcPath,
    class: 'dash-gauge__arc',
    pathLength: '100',
    'stroke-dasharray': '100',
    'stroke-dashoffset': '100'
  });
  const needle = svgNode('g', { class: 'dash-gauge__needle' });
  needle.appendChild(svgNode('line', { x1: '100', y1: '104', x2: '100', y2: '42' }));
  const cap = svgNode('circle', { cx: '100', cy: '104', r: '5', class: 'dash-gauge__cap' });
  svg.append(arc, needle, cap);
  host.replaceChildren(svg);
  return { host, arc, needle };
}

function paintGauge(elapsed, host) {
  const parts = gaugeParts(host);
  const ratio = Math.min(1, Math.max(0, elapsed / DASH_GAUGE_MAX_MS));
  parts.arc.setAttribute('stroke-dashoffset', String(100 - ratio * 100));
  parts.needle.style.transform = `rotate(${-90 + ratio * 180}deg)`;
}

async function loadServer() {
  const tile = document.getElementById(dash('dash-server'));
  const line = document.getElementById(dash('dash-gauge-line'));
  beginTile(tile);
  line.textContent = 'Checking now.';
  gaugeParts(tile);
  try {
    const elapsed = await measureHealth();
    paintGauge(elapsed, tile);
    line.textContent = `${gaugeVerdict(elapsed)}. The reply came back in ${elapsed} ms.`;
    endTile(tile);
  } catch (error) {
    console.error('The response time could not be measured.', error);
    tile.setAttribute('aria-busy', 'false');
    line.textContent = 'No reply came back.';
    setTileState(tile, 'The check did not come back.', loadServer);
  }
}

function niceStep(value) {
  if (!(value > 0)) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const residual = value / magnitude;
  let step = 10;
  if (residual <= 1) step = 1;
  else if (residual <= 2) step = 2;
  else if (residual <= 5) step = 5;
  return Math.max(1, Math.round(step * magnitude));
}

function seriesFor(users, range) {
  const stamps = users
    .map((user) => new Date(user.date_joined).getTime())
    .filter((stamp) => Number.isFinite(stamp))
    .sort((a, b) => a - b);
  const now = new Date();
  const points = [];

  if (range.months) {
    for (let back = range.months - 1; back >= 0; back -= 1) {
      const covered = new Date(now.getFullYear(), now.getMonth() - back, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - back + 1, 1);
      points.push({ at: covered, end, label: covered.toLocaleDateString('en-GB', { month: 'short' }) });
    }
  } else {
    for (let back = range.days - 1; back >= 0; back -= 1) {
      const covered = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back + 1);
      points.push({ at: covered, end, label: covered.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) });
    }
  }

  let cursor = 0;
  for (const point of points) {
    const limit = point.end.getTime();
    while (cursor < stamps.length && stamps[cursor] < limit) {
      cursor += 1;
    }
    point.value = cursor;
  }
  return points;
}

function chartGeometry(points) {
  const highest = points.reduce((most, point) => Math.max(most, point.value), 0);
  const step = niceStep(Math.max(1, highest) / 4);
  const top = Math.max(step * 4, highest);
  const plotWidth = CHART_WIDTH - CHART_PAD.left - CHART_PAD.right;
  const plotHeight = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;
  const xFor = (index) => CHART_PAD.left + (plotWidth * index) / Math.max(1, points.length - 1);
  const yFor = (value) => CHART_PAD.top + plotHeight - (plotHeight * value) / top;
  return { top, step, plotWidth, plotHeight, xFor, yFor };
}

function renderChart() {
  const host = document.getElementById(dash('dash-chart'));
  if (!host) return;
  if (!dashChart) return;
  const points = dashChart.points;
  const geometry = dashChart.geometry;

  if (dashChart.users.length === 0) {
    host.replaceChildren(makeElement('p', 'dash-chart__empty', 'No one has joined yet.'));
    return;
  }

  const { top, step, xFor, yFor } = geometry;
  const baseY = CHART_PAD.top + geometry.plotHeight;

  const svg = svgNode('svg', {
    viewBox: `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`,
    class: 'dash-chart__svg',
    role: 'img',
    'aria-label': `Cumulative sign ups over the last ${dashRange}`
  });

  for (let value = 0; value <= top; value += step) {
    const y = yFor(value);
    svg.appendChild(
      svgNode('line', {
        x1: String(CHART_PAD.left),
        y1: String(y),
        x2: String(CHART_WIDTH - CHART_PAD.right),
        y2: String(y),
        class: 'dash-chart__grid'
      })
    );
    const tick = svgNode('text', {
      x: String(CHART_PAD.left - 10),
      y: String(y + 4),
      class: 'dash-chart__tick',
      'text-anchor': 'end'
    });
    tick.textContent = formatNumber(value);
    svg.appendChild(tick);
  }

  const labelEvery = Math.max(1, Math.ceil(points.length / 4));
  points.forEach((point, index) => {
    if (index % labelEvery !== 0 && index !== points.length - 1) return;
    const label = svgNode('text', {
      x: String(xFor(index)),
      y: String(CHART_HEIGHT - 12),
      class: 'dash-chart__tick',
      'text-anchor': 'middle'
    });
    label.textContent = point.label;
    svg.appendChild(label);
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(point.value)}`)
    .join(' ');
  const areaPath = `${linePath} L ${xFor(points.length - 1)} ${baseY} L ${xFor(0)} ${baseY} Z`;

  const area = svgNode('path', { d: areaPath, class: 'dash-chart__area' });
  const line = svgNode('path', { d: linePath, class: 'dash-chart__line' });
  svg.append(area, line);

  const last = points.length - 1;
  svg.appendChild(
    svgNode('circle', { cx: String(xFor(last)), cy: String(yFor(points[last].value)), r: '4', class: 'dash-chart__dot' })
  );

  const crossX = svgNode('line', { y1: String(CHART_PAD.top), y2: String(baseY), class: 'dash-chart__cross' });
  const crossDot = svgNode('circle', { r: '5', class: 'dash-chart__crossdot' });
  crossX.style.opacity = '0';
  crossDot.style.opacity = '0';
  svg.append(crossX, crossDot);

  const overlay = svgNode('rect', {
    x: String(CHART_PAD.left),
    y: String(CHART_PAD.top),
    width: String(geometry.plotWidth),
    height: String(geometry.plotHeight),
    class: 'dash-chart__overlay'
  });
  svg.appendChild(overlay);

  const tooltip = makeElement('div', 'dash-chart__tip');
  tooltip.hidden = true;

  const stage = makeElement('div', 'dash-chart__stage');
  stage.append(svg, tooltip);
  host.replaceChildren(stage);
  host.tabIndex = 0;

  if (!dashReduced() && points.length > 1) {
    const length = line.getTotalLength();
    line.style.strokeDasharray = String(length);
    line.style.strokeDashoffset = String(length);
    area.classList.add('is-drawing');
    requestAnimationFrame(() => {
      line.style.transition = 'stroke-dashoffset 900ms var(--ease)';
      line.style.strokeDashoffset = '0';
      area.classList.remove('is-drawing');
    });
    line.addEventListener('transitionend', () => {
      line.style.strokeDasharray = '';
      line.style.strokeDashoffset = '';
      line.style.transition = '';
    }, { once: true });
  }

  function showAt(index) {
    const point = points[index];
    if (!point) return;
    dashChart.hover = index;
    const x = xFor(index);
    const y = yFor(point.value);
    crossX.setAttribute('x1', String(x));
    crossX.setAttribute('x2', String(x));
    crossX.style.opacity = '1';
    crossDot.setAttribute('cx', String(x));
    crossDot.setAttribute('cy', String(y));
    crossDot.style.opacity = '1';
    tooltip.hidden = false;
    tooltip.replaceChildren(
      makeElement('span', 'dash-chart__tip-value', formatNumber(point.value)),
      makeElement('span', 'dash-chart__tip-label', shortDate(point.at))
    );
    const share = Math.min(0.86, Math.max(0.14, x / CHART_WIDTH));
    tooltip.style.left = `${share * 100}%`;
    tooltip.style.top = `${(y / CHART_HEIGHT) * 100}%`;
  }

  function hide() {
    dashChart.hover = -1;
    crossX.style.opacity = '0';
    crossDot.style.opacity = '0';
    tooltip.hidden = true;
  }

  function indexFor(clientX) {
    const box = svg.getBoundingClientRect();
    const localX = ((clientX - box.left) / box.width) * CHART_WIDTH;
    const ratio = (localX - CHART_PAD.left) / geometry.plotWidth;
    return Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1))));
  }

  overlay.addEventListener('pointermove', (event) => showAt(indexFor(event.clientX)));
  overlay.addEventListener('pointerdown', (event) => showAt(indexFor(event.clientX)));
  overlay.addEventListener('pointerleave', hide);

  dashChart.showAt = showAt;
  dashChart.hide = hide;
}

function handleChartKeys(event) {
  if (!dashChart || !dashChart.points || !dashChart.showAt) return;
  const total = dashChart.points.length;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    const current = dashChart.hover === undefined || dashChart.hover < 0 ? total - 1 : dashChart.hover;
    const next = event.key === 'ArrowRight' ? Math.min(total - 1, current + 1) : Math.max(0, current - 1);
    dashChart.showAt(next);
    return;
  }
  if (event.key === 'Escape') {
    dashChart.hide();
  }
}

function renderRanges() {
  const host = document.getElementById(dash('dash-ranges'));
  if (!host) return;
  host.replaceChildren(
    ...DASH_RANGES.map((range) => {
      const button = makeElement('button', 'dash-range', range.label);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(range.id === dashRange));
      button.addEventListener('click', () => {
        if (range.id === dashRange) return;
        dashRange = range.id;
        renderRanges();
        paintChart();
      });
      return button;
    })
  );
}

function paintChart() {
  if (!dashChart || !dashChart.users) return;
  const range = DASH_RANGES.find((entry) => entry.id === dashRange);
  dashChart.points = seriesFor(dashChart.users, range);
  dashChart.geometry = chartGeometry(dashChart.points);
  dashChart.hover = -1;
  renderChart();
}

async function loadMostDownloaded() {
  const tile = document.getElementById('dash-downloaded');
  const list = document.getElementById('dash-most-downloaded');
  beginTile(tile);
  try {
    const response = await readJson(`${API}/materials/?sort=download`);
    const items = (Array.isArray(response) ? response : (response.results || [])).slice(0, 4);

    if (items.length === 0) {
      list.replaceChildren(makeElement('p', 'dash-most-downloaded__empty', 'No materials downloaded'));
    } else {
      list.replaceChildren(...items.map(buildDownloadItem));
    }

    endTile(tile);
  } catch (error) {
    failTile(tile, 'The most downloaded materials could not be read.', error, loadMostDownloaded);
  }
}

function buildDownloadItem(item) {
  const title = makeElement('div', 'dash-download-item__title', item.course_title || item.title);
  const code = makeElement('div', 'dash-download-item__code', formatCourseCode(item.course_code));
  const top = makeElement('div', 'dash-download-item__top');
  top.appendChild(title);
  top.appendChild(code);
  const type = makeElement('div', 'dash-download-item__type', item.material_type);
  const level = makeElement('div', 'dash-download-item__level', item.level);
  const downloads = makeElement('div', 'dash-download-item__downloads', String(Number(item.download_count) || 0));
  const meta = makeElement('div', 'dash-download-item__meta');
  meta.appendChild(type);
  meta.appendChild(level);
  meta.appendChild(downloads);
  const card = makeElement('div', 'dash-download-item');
  card.appendChild(top);
  card.appendChild(meta);
  return card;
}

function formatCourseCode(value) {
  return (value || '').trim().toUpperCase().replace(CODE_SPLIT, '$1 $2');
}

async function loadSignups() {
  const tile = document.getElementById(dash('dash-signups'));
  if (!tile) return;
  beginTile(tile);
  try {
    const users = await loadUsers();
    const students = (Array.isArray(users) ? users : [])
      .filter((user) => user && user.role === 'student');
    dashChart = { users: students, points: [], geometry: null, hover: -1 };
    paintChart();
    endTile(tile);
  } catch (error) {
    failTile(tile, 'The sign up chart could not be read.', error, loadSignups);
  }
}

function renderRoles(users) {
  const host = document.getElementById(dash('dash-roles-body'));
  const counts = DASH_ROLES.map((role) => ({
    ...role,
    value: users.filter((user) => user.role === role.id).length
  }));
  const total = counts.reduce((sum, role) => sum + role.value, 0);

  const track = makeElement('div', 'dash-segs');
  if (total === 0) {
    track.appendChild(makeElement('span', 'dash-seg dash-seg--empty'));
  } else {
    for (const role of counts) {
      if (role.value === 0) continue;
      const segment = makeElement('span', `dash-seg dash-seg--${role.tone}`);
      segment.style.flexGrow = String(role.value);
      segment.setAttribute('aria-hidden', 'true');
      track.appendChild(segment);
    }
  }

  const legend = makeElement('div', 'dash-legend');
  for (const role of counts) {
    const row = makeElement('div', 'dash-legend__row');
    const name = makeElement('span', 'dash-legend__name');
    name.appendChild(makeElement('span', `dash-legend__swatch dash-seg--${role.tone}`));
    name.appendChild(makeElement('span', '', role.label));
    row.appendChild(name);
    row.appendChild(makeElement('span', 'dash-legend__value', formatNumber(role.value)));
    legend.appendChild(row);
  }

  host.replaceChildren(track, legend);
  host.setAttribute('aria-label', `${formatNumber(total)} accounts in total`);
}

async function loadRoles() {
  const tile = document.getElementById(dash('dash-roles'));
  beginTile(tile);
  try {
    const users = await loadUsers();
    renderRoles(Array.isArray(users) ? users : []);
    endTile(tile);
  } catch (error) {
    failTile(tile, 'The role split could not be read.', error, loadRoles);
  }
}

function renderInbox(summary) {
  const figure = document.getElementById(dash('dash-inbox-figure'));
  const bars = document.getElementById(dash('dash-inbox-bars'));
  const counts = summary.counts_by_status || {};
  const newCount = Number(summary.new_count) || 0;
  countUp(figure, newCount);

  const highest = DASH_STATUSES.reduce((most, status) => Math.max(most, Number(counts[status.id]) || 0), 0);
  bars.replaceChildren(
    ...DASH_STATUSES.map((status) => {
      const value = Number(counts[status.id]) || 0;
      const row = makeElement('div', 'dash-mini');
      row.appendChild(makeElement('span', 'dash-mini__label', status.label));
      const track = makeElement('span', 'dash-mini__track');
      const fill = makeElement('span', 'dash-mini__fill');
      const share = highest ? Math.max(0.04, value / highest) : 0;
      fill.style.width = '100%';
      fill.style.transform = dashReduced() ? `scaleX(${share})` : 'scaleX(0)';
      if (!dashReduced()) {
        requestAnimationFrame(() => {
          fill.style.transform = `scaleX(${share})`;
        });
      }
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(makeElement('span', 'dash-mini__value', formatNumber(value)));
      return row;
    })
  );
}

async function loadInbox() {
  const tile = document.getElementById(dash('dash-inbox'));
  beginTile(tile);
  try {
    const summary = await readJson(DASH_INBOX_URL);
    renderInbox(summary || {});
    endTile(tile);
  } catch (error) {
    failTile(tile, 'The inbox figure could not be read.', error, loadInbox);
  }
}

function renderRecycle(summary) {
  const host = document.getElementById(dash('dash-recycle-body'));
  const build = (label, value) => {
    const cell = makeElement('div', 'dash-pair__cell');
    cell.appendChild(makeElement('span', 'dash-pair__value', formatNumber(Number(value) || 0)));
    cell.appendChild(makeElement('span', 'dash-pair__label', label));
    return cell;
  };
  host.replaceChildren(build('Accounts', summary.users), build('Materials', summary.materials));
}

async function loadRecycle() {
  const tile = document.getElementById(dash('dash-recycle'));
  beginTile(tile);
  try {
    const summary = await readJson(DASH_RECYCLE_URL);
    renderRecycle(summary || {});
    endTile(tile);
  } catch (error) {
    failTile(tile, 'The recycle figures could not be read.', error, loadRecycle);
  }
}

function renderLatest(users) {
  const host = document.getElementById(dash('dash-latest-list'));
  const recent = [...users]
    .filter((user) => Number.isFinite(new Date(user.date_joined).getTime()))
    .sort((a, b) => new Date(b.date_joined) - new Date(a.date_joined))
    .slice(0, DASH_LATEST_COUNT);

  if (recent.length === 0) {
    host.replaceChildren(makeElement('li', 'dash-latest__empty', 'No accounts have joined yet.'));
    return;
  }

  host.replaceChildren(
    ...recent.map((user) => {
      const item = makeElement('li', 'dash-latest__item');
      item.appendChild(makeElement('span', 'dash-latest__avatar', initialsOf(user.full_name)));
      const body = makeElement('div', 'dash-latest__body');
      body.appendChild(makeElement('span', 'dash-latest__name', user.full_name));
      const meta = [user.matric_number, user.level ? `${user.level} level` : '', timeAgo(user.date_joined)];
      body.appendChild(makeElement('span', 'dash-latest__meta', meta.filter(Boolean).join(' · ')));
      item.appendChild(body);
      const status = user.status || 'active';
      item.appendChild(makeElement('span', `dash-status dash-status--${status}`, status.charAt(0).toUpperCase() + status.slice(1)));
      return item;
    })
  );
}

async function loadLatest() {
  const tile = document.getElementById(dash('dash-latest'));
  beginTile(tile);
  try {
    const users = await loadUsers();
    const list = Array.isArray(users) ? users : [];
    renderLatest(dashAdmin ? list.filter((user) => user && user.role === 'student') : list);
    endTile(tile);
  } catch (error) {
    failTile(tile, 'The latest accounts could not be read.', error, loadLatest);
  }
}

function bootDashboard() {
  renderGreeting();
  buildQueue();
  gaugeParts(document.getElementById(dashAdmin ? 'dash-gauge-admin' : 'dash-gauge'));
  renderRanges();
  const chartHost = document.getElementById(dashAdmin ? 'dash-chart-admin' : 'dash-chart');
  document.getElementById(dashAdmin ? 'dash-check-admin' : 'dash-check').addEventListener('click', loadServer);
  chartHost.addEventListener('keydown', handleChartKeys);
  chartHost.addEventListener('blur', () => {
    if (dashChart && dashChart.hide) {
      dashChart.hide();
    }
  });
  loadHero();
  loadQueue();
  loadServer();
  loadSignups();
  if (!dashAdmin) {
    loadRoles();
    loadInbox();
    loadRecycle();
  }
  loadLatest();
  if (dashAdmin) {
    loadMostDownloaded();
  }
}

window.profileReady.then(() => {
  const profile = window.profileData;
  const dashboard = document.getElementById('owner-dash');
  const admin = document.getElementById('admin-dash');
  if (profile && profile.is_owner) {
    if (!dashboard) {
      return;
    }
    for (const selector of ['.desk', '.lp-stats', '.lp-section--deep']) {
      const section = document.querySelector(selector);
      if (section) {
        section.hidden = true;
      }
    }
    dashboard.hidden = false;
    dashAdmin = false;
    bootDashboard();
    return;
  }
  if (isSuperAdmin()) {
    return;
  }
  if (admin) {
    for (const selector of ['.desk', '.lp-stats', '.lp-section--deep']) {
      const section = document.querySelector(selector);
      if (section) {
        section.hidden = true;
      }
    }
    admin.hidden = false;
    if (dashboard) {
      dashboard.hidden = true;
    }
    dashAdmin = true;
    dashQueueOrder = ['added', 'joined', 'suspended'];
    bootDashboard();
  }
});
