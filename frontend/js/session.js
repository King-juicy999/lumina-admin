const SESSION_ACCESS_KEY = 'lumina_access_token';
const SESSION_REFRESH_KEY = 'lumina_refresh_token';
const SESSION_ROLE_KEY = 'lumina_admin_role';

const SUPER_ADMIN = 'super_admin';
const DEFAULT_ROLE = 'admin';

function getRole() {
  return sessionStorage.getItem(SESSION_ROLE_KEY) || DEFAULT_ROLE;
}

function isSuperAdmin() {
  return getRole() === SUPER_ADMIN;
}

function clearSession() {
  sessionStorage.removeItem(SESSION_ACCESS_KEY);
  sessionStorage.removeItem(SESSION_REFRESH_KEY);
  sessionStorage.removeItem(SESSION_ROLE_KEY);
}

async function authorisedFetch(url, options = {}) {
  const headers = { Accept: 'application/json', ...options.headers };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  headers.Authorization = `Bearer ${sessionStorage.getItem(SESSION_ACCESS_KEY)}`;

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    clearSession();
    window.location.href = '/login.html';
  }
  return response;
}

function revealSuperAdminControls() {
  if (!isSuperAdmin()) {
    return;
  }
  for (const node of document.querySelectorAll('[data-role="super"]')) {
    node.hidden = false;
  }
}

function revealOwnerControls() {
  if (!window.profileData || !window.profileData.is_owner) {
    return;
  }
  for (const node of document.querySelectorAll('[data-role="owner"]')) {
    node.hidden = false;
  }
}

async function loadAndInitialize() {
  try {
    const response = await fetch('https://william999.pythonanywhere.com/api/accounts/admin/me/', {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem(SESSION_ACCESS_KEY)}` }
    });
    if (response.ok) {
      const data = await response.json();
      window.profileData = data;
    }
  } catch (e) {
    console.error('Profile could not be loaded.', e);
  }
  addHeaderRole();
  revealSuperAdminControls();
  revealOwnerControls();
  loadInboxBadge();
}

function addHeaderRole() {
  const nav = document.querySelector('.plate-nav .plate-links');
  if (!nav) return;
  const existing = nav.querySelector('.plate-role-label');
  if (existing) existing.remove();
  const node = document.createElement('span');
  node.className = 'plate-role-label';
  const profile = window.profileData || {};
  if (profile.is_owner) {
    node.textContent = 'Owner';
  } else if (getRole() === 'super_admin') {
    node.textContent = 'Super admin';
  } else if (getRole() === 'admin') {
    node.textContent = 'Admin';
  } else {
    node.textContent = 'Student';
  }
  node.setAttribute('aria-label', 'Your role');
  nav.insertBefore(node, nav.firstChild);
}

function toggleMenu() {
  const button = document.getElementById('menu-toggle');
  const panel = document.getElementById('menu-panel');
  if (!button || !panel) {
    return;
  }
  const expanded = button.getAttribute('aria-expanded') === 'true';
  if (expanded) {
    panel.classList.remove('menu-panel--open');
    panel.addEventListener('transitionend', () => {
      panel.hidden = true;
    }, { once: true });
    setTimeout(() => {
      panel.hidden = true;
    }, 250);
  } else {
    panel.hidden = false;
    requestAnimationFrame(() => {
      panel.classList.add('menu-panel--open');
    });
  }
  button.setAttribute('aria-expanded', String(!expanded));
}

function initMenu() {
  const button = document.getElementById('menu-toggle');
  const panel = document.getElementById('menu-panel');
  if (!button || !panel) {
    return;
  }

  button.addEventListener('click', toggleMenu);

  panel.addEventListener('click', (event) => {
    if (event.target.tagName === 'A') {
      toggleMenu();
    }
  });

  document.addEventListener('click', (event) => {
    if (!panel.hidden && !button.contains(event.target) && !panel.contains(event.target)) {
      toggleMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      toggleMenu();
      button.focus();
    }
  });

  const logoutBtn = document.getElementById('logout-btn-menu');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearSession();
      window.location.href = '/login.html';
    });
  }
}

window.profileReady = loadAndInitialize();
initMenu();

async function loadInboxBadge() {
  if (!window.profileData || !window.profileData.is_owner) return;
  const badge = document.getElementById('inbox-badge');
  const panelBadge = document.getElementById('inbox-badge-menu');
  const menuDot = document.getElementById('menu-dot');
  if (!badge && !panelBadge) return;
  try {
    const response = await fetch('https://william999.pythonanywhere.com/api/feedback/inbox/summary/', {
      headers: { Accept: 'application/json', Authorization: `Bearer ${sessionStorage.getItem(SESSION_ACCESS_KEY)}` }
    });
    if (response.ok) {
      const data = await response.json();
      const newCount = data.new_count || 0;
      if (newCount > 0) {
        if (badge) {
          badge.textContent = String(newCount);
          badge.hidden = false;
        }
        if (panelBadge) {
          panelBadge.textContent = String(newCount);
          panelBadge.hidden = false;
        }
        if (menuDot) {
          menuDot.hidden = false;
        }
      } else {
        if (badge) {
          badge.hidden = true;
        }
        if (panelBadge) {
          panelBadge.hidden = true;
        }
        if (menuDot) {
          menuDot.hidden = true;
        }
      }
    }
  } catch (e) {
    console.error('Inbox badge could not be loaded.', e);
  }
}