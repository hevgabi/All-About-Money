// js/auth-guard.js — Protects all pages, attaches logout button

import { auth, onAuthChanged, logout } from './firebase.js';

export function requireAuth(onReady) {
  onAuthChanged(async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    // Inject user info + logout into sidebar if present
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      const existing = document.getElementById('user-panel');
      if (!existing) {
        const panel = document.createElement('div');
        panel.id = 'user-panel';
        panel.style.cssText = 'padding:16px;border-top:1px solid var(--border);margin-top:auto;display:flex;align-items:center;gap:10px;';
        panel.innerHTML = `
          <img src="${user.photoURL || ''}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;background:#333;" onerror="this.style.display='none'">
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.8rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${user.displayName || user.email}</div>
          </div>
          <button id="logout-btn" title="Sign out" style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:4px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        `;
        sidebar.appendChild(panel);
        document.getElementById('logout-btn').addEventListener('click', async () => {
          await logout();
          window.location.href = 'login.html';
        });
      }
    }

    if (onReady) onReady(user);
  });
}
