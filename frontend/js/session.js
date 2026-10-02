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

revealSuperAdminControls();