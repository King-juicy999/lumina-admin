const WAKE_NOTICE_DELAY_MS = 4000;
const WAKE_RETRY_MS = 3000;
const WAKE_MAX_WAIT_MS = 90000;
const WAKE_FRESH_MS = 240000;
const WAKE_READY_KEY = 'lumina_admin_backend_ready';
const WAKE_NOTICE_TEXT = 'The server is taking a bit longer than usual. Please wait a moment.';

const nativeFetch = window.fetch.bind(window);

let backendReady = null;

async function wakeBackend() {
  let lastReady = 0;
  try {
    lastReady = Number(sessionStorage.getItem(WAKE_READY_KEY));
  } catch {
    lastReady = 0;
  }
  if (Number.isFinite(lastReady) && Date.now() - lastReady < WAKE_FRESH_MS) {
    return;
  }

  let timer = null;
  let notice = null;

  const finish = () => {
    clearTimeout(timer);
    if (notice) {
      notice.remove();
      notice = null;
    }
  };

  timer = setTimeout(() => {
    notice = document.createElement('div');
    notice.className = 'wake-notice';
    notice.setAttribute('role', 'status');
    notice.textContent = WAKE_NOTICE_TEXT;
    document.body.appendChild(notice);
  }, WAKE_NOTICE_DELAY_MS);

  const startedAt = Date.now();

  try {
    while (Date.now() - startedAt < WAKE_MAX_WAIT_MS) {
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), 10000);
      let ready = false;
      try {
        const response = await nativeFetch(`${API}/health/`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        ready = response.ok;
      } catch {
        ready = false;
      } finally {
        clearTimeout(abortTimer);
      }

      if (ready) {
        try {
          sessionStorage.setItem(WAKE_READY_KEY, String(Date.now()));
        } catch {
        }
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, WAKE_RETRY_MS));
    }
  } finally {
    finish();
  }
}

function waitForBackend() {
  if (!backendReady) {
    backendReady = wakeBackend()
      .catch(() => {})
      .finally(() => {
        backendReady = null;
      });
  }
  return backendReady;
}

window.fetch = async function (input, init) {
  const url = typeof input === 'string' ? input : input.url;
  if (url && url.startsWith(API)) {
    await waitForBackend();
  }
  return nativeFetch(input, init);
};

waitForBackend();
