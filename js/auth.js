// --------------------------------------------------------------------------
// Simple login gate for the Site Visit Report tool.
//
// NOTE ON SECURITY: this check runs entirely in the browser and the
// credentials below are visible to anyone who views this file's source.
// It is a soft deterrent to keep casual/unauthorized visitors off the
// form — it is NOT equivalent to real authentication (e.g. Supabase Auth
// with per-user accounts) and a technical user could bypass it. Treat it
// as a lightweight "gate," not a security boundary.
// --------------------------------------------------------------------------

const AUTH_CREDENTIALS = {
  "username": "Studio Infinite",
  "password": "SILLP-001"
};

const AUTH_SESSION_KEY = 'sillp_authenticated';

// --------------------------------------------------------------------------
// Login form handling (only present on login.html)
// --------------------------------------------------------------------------
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const enteredUsername = document.getElementById('loginUsername').value.trim();
    const enteredPassword = document.getElementById('loginPassword').value;
    const errorBox = document.getElementById('loginError');

    if (enteredUsername === AUTH_CREDENTIALS.username && enteredPassword === AUTH_CREDENTIALS.password) {
      // Mark this browser tab/session as authenticated, then go to the form.
      sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
      if (errorBox) errorBox.classList.remove('show');
      window.location.href = 'index.html';
    } else {
      if (errorBox) errorBox.classList.add('show');
    }
  });
}

// --------------------------------------------------------------------------
// Guard used by index.html — redirects back to the login page if the
// authenticated flag isn't present. Called at the very top of index.html,
// before the page renders, so an unauthenticated visitor never sees the
// form even briefly.
//
// The flag is "one-time use": landing here right after a successful login
// consumes (removes) it immediately, so a normal refresh of index.html
// afterwards finds no flag and is sent back to login.html. This means the
// login screen reappears on every refresh — access is only carried across
// the single navigation from login.html to index.html, not persisted.
// --------------------------------------------------------------------------
function requireAuth() {
  if (sessionStorage.getItem(AUTH_SESSION_KEY) === 'true') {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  } else {
    window.location.href = 'login.html';
  }
}

window.requireAuth = requireAuth;