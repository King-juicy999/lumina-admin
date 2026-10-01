const API = 'http://localhost:8000/api';
const LOGIN_URL = `${API}/accounts/login/`;
const USERS_URL = `${API}/accounts/users/`;

const ACCESS_TOKEN_KEY = 'lumina_access_token';
const REFRESH_TOKEN_KEY = 'lumina_refresh_token';

const elements = {
  form: document.getElementById('login-form'),
  matric: document.getElementById('matric-number'),
  password: document.getElementById('password'),
  error: document.getElementById('login-error'),
  submit: document.getElementById('login-submit')
};

function clearTokens() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

function showError(message) {
  elements.error.textContent = message;
}

function setBusy(busy) {
  elements.submit.disabled = busy;
  elements.submit.textContent = busy ? 'Checking...' : 'Sign in';
}

function unreachableMessage() {
  return 'The server could not be reached. Open this console from localhost on port 5500 and check that the backend is running.';
}

function describeLoginFailure(status) {
  if (status === 429) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (status === 400 || status === 401) {
    return 'That matric number and password are not right.';
  }
  return 'Sign in is not working right now. Try again in a moment.';
}

async function requestToken(matricNumber, password) {
  const response = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ matric_number: matricNumber, password })
  });

  if (!response.ok) {
    console.error('Lumina refused the sign in request.', response.status);
    throw new Error(describeLoginFailure(response.status));
  }
  return response.json();
}

async function confirmAdminAccess(access) {
  const response = await fetch(USERS_URL, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${access}` }
  });

  if (response.status === 403) {
    return 'This account does not have admin access.';
  }
  if (!response.ok) {
    console.error('The admin users endpoint rejected this token.', response.status);
    return 'Sign in is not working right now. Try again in a moment.';
  }
  return null;
}

async function handleSubmit(event) {
  event.preventDefault();
  showError('');

  const matricNumber = elements.matric.value.trim();
  const password = elements.password.value;

  if (!matricNumber || !password) {
    showError('Enter your matric number and password to sign in.');
    return;
  }

  setBusy(true);

  let data;
  try {
    data = await requestToken(matricNumber, password);
  } catch (error) {
    console.error('The sign in request did not complete.', error);
    showError(error instanceof TypeError ? unreachableMessage() : error.message);
    setBusy(false);
    return;
  }

  let refusal;
  try {
    refusal = await confirmAdminAccess(data.access);
  } catch (error) {
    console.error('The admin access check did not complete.', error);
    showError(unreachableMessage());
    setBusy(false);
    return;
  }

  if (refusal) {
    showError(refusal);
    setBusy(false);
    return;
  }

  sessionStorage.setItem(ACCESS_TOKEN_KEY, data.access);
  sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);
  window.location.href = 'index.html';
}

elements.form.addEventListener('submit', handleSubmit);
clearTokens();