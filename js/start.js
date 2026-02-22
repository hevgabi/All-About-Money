// js/start.js — Redirect to login (Firebase handles auth)
// start.html is no longer used as the entry point.
// Keeping this file so start.html doesn't 404 on the script tag,
// but it immediately sends the user to login.html.

(function () {
  window.location.replace('login.html');
})();