(function () {
  function check() {
    if (!sessionStorage.getItem('lumina_access_token')) {
      document.documentElement.style.visibility = 'hidden';
      window.location.replace('/login.html');
    }
  }
  check();
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      check();
    }
  });
})();
