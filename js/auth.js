// js/auth.js — Auth guard + user panel (loaded on every app page)
// Must be loaded AFTER firebase.js

(function () {
  const PUBLIC_PAGES = ['login.html', 'login'];

  function currentPage() {
    return location.pathname.split('/').pop() || 'index.html';
  }

  function isPublicPage() {
    const p = currentPage();
    return PUBLIC_PAGES.some(pp => p === pp || p === pp + '.html');
  }

  // Wait until firebase.js has registered fbOnAuthChanged
  function waitForFb(cb, tries = 0) {
    if (window.fbOnAuthChanged) { cb(); return; }
    if (tries > 100) { // ✅ 5 seconds max wait
      console.error('[auth.js] firebase.js not loaded in time');
      return;
    }
    setTimeout(() => waitForFb(cb, tries + 1), 50);
  }

  waitForFb(() => {
    window.fbOnAuthChanged(user => {
      if (!user && !isPublicPage()) {
        window.location.href = 'login.html';
        return;
      }
      if (user && isPublicPage()) {
        window.location.href = 'index.html';
        return;
      }

      if (user) {
        // ✅ Store user ID globally so firebase.js path helpers can reliably use it
        window._currentUserId = user.uid;
        console.log('[auth.js] User authenticated:', user.uid);

        injectUserPanel(user);

        // Signal to page JS that auth + user ID are ready
        if (typeof window.onAuthReady === 'function') {
          window.onAuthReady(user);
        }
      }
    });
  });

  function injectUserPanel(user) {
    const sidebar = document.querySelector('.sidebar-nav');
    if (sidebar && !document.getElementById('user-panel-sidebar')) {
      const panel = document.createElement('div');
      panel.id = 'user-panel-sidebar';
      panel.style.cssText = 'padding:12px;border-top:1px solid var(--border);margin-top:16px;display:flex;flex-direction:column;gap:6px;';
      panel.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;margin-bottom:4px;">
          <img src="${user.photoURL || ''}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;background:#333" onerror="this.style.display='none'">
          <span style="font-size:0.78rem;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${user.displayName || user.email}</span>
        </div>
        <button onclick="handleLogout()" class="btn" style="width:100%;justify-content:center;gap:8px;font-size:0.82rem;background:#ff4d6d18;color:var(--danger);border:1px solid #ff4d6d30;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign Out
        </button>
      `;
      sidebar.appendChild(panel);
    }

    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav && !document.getElementById('fab-logout')) {
      const fab = document.createElement('button');
      fab.id = 'fab-logout';
      fab.onclick = handleLogout;
      fab.title = 'Sign Out';
      fab.style.cssText = 'position:fixed;bottom:80px;right:16px;width:44px;height:44px;background:#ff4d6d18;border:1px solid #ff4d6d30;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--danger);box-shadow:var(--shadow);z-index:99;cursor:pointer;';
      fab.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
      document.body.appendChild(fab);
    }
  }

  window.handleLogout = function () {
    window._currentUserId = null;
    if (!window.showConfirm) { window.fbLogout().then(() => location.href = 'login.html'); return; }
    showConfirm('Sign out ng iyong account?', 'Sign Out', 'Yes, Sign Out').then(ok => {
      if (!ok) return;
      window.fbLogout().then(() => { location.href = 'login.html'; });
    });
  };
})();