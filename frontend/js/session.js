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

window.profileReady = loadAndInitialize();