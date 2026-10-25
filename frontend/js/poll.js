const POLL_INTERVAL_MS = 20000;

function hasOpenActionModal() {
  return Boolean(document.querySelector('dialog.action-modal[open]'));
}

function startPolling(load, intervalMs) {
  const interval = intervalMs || POLL_INTERVAL_MS;
  let inFlight = false;

  function tick() {
    if (inFlight || document.hidden || hasOpenActionModal()) {
      return;
    }
    inFlight = true;
    Promise.resolve(load())
      .catch(() => {})
      .then(() => {
        inFlight = false;
      });
  }

  window.setInterval(tick, interval);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      tick();
    }
  });
}
