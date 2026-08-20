let mode = new URLSearchParams(location.search).get('mode') === 'signin' ? 'signin' : 'signup';
const tabs = [...document.querySelectorAll('[data-auth-tab]')];
const form = document.getElementById('authForm');
const password = document.getElementById('authPassword');
const termsRow = document.getElementById('termsRow');
const termsCheck = document.getElementById('termsCheck');
const error = document.getElementById('authError');

function setMode(next) {
  mode = next === 'signin' ? 'signin' : 'signup';
  tabs.forEach(tab => {
    const active = tab.dataset.authTab === mode;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  document.getElementById('authKicker').textContent = mode === 'signup' ? 'New workspace' : 'Welcome back';
  document.getElementById('authTitle').textContent = mode === 'signup' ? 'START FREE.' : 'SIGN BACK IN.';
  document.getElementById('authButtonText').textContent = mode === 'signup' ? 'Enter planning workspace' : 'Open planning workspace';
  password.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  termsRow.hidden = mode === 'signin';
  error.textContent = '';
}

tabs.forEach(tab => tab.addEventListener('click', () => setMode(tab.dataset.authTab)));
form.addEventListener('submit', event => {
  event.preventDefault();
  error.textContent = '';
  const email = document.getElementById('authEmail');
  if (!email.validity.valid) { error.textContent = 'Enter a valid email format for the prototype.'; email.focus(); return; }
  if (password.value.length < 8) { error.textContent = 'Use at least 8 characters in the prototype password field.'; password.focus(); return; }
  if (mode === 'signup' && !termsCheck.checked) { error.textContent = 'Confirm that you understand this is a front-end prototype.'; return; }
  try {
    sessionStorage.setItem('collegetab.prototypeSession', 'true');
    sessionStorage.removeItem('futureledger.prototypeSession');
  } catch { /* The front-end shell can still open without session storage. */ }
  location.href = mode === 'signup' ? 'app.html#onboarding' : 'app.html#overview';
});

window.addEventListener('pointermove', event => {
  document.documentElement.style.setProperty('--mx', `${(event.clientX / innerWidth) * 100}%`);
  document.documentElement.style.setProperty('--my', `${(event.clientY / innerHeight) * 100}%`);
});
setMode(mode);
