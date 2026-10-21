const WAKE_NOTICE_TEXT = 'The server is waking up. This can take about a minute.';

async function wakeBackend() {
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
  }, 3000);

  try {
    await fetch(`${API}/health/`, { cache: 'no-store' });
  } catch {
  }

  finish();
}

wakeBackend();
