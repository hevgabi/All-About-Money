// js/ui.js — Toast, Modal, Nav, Confirm

// ── Toast ────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = {
    success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20,6 9,17 4,12"/></svg>`,
    error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
  };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${icons[type] || ''}${escapeHtml(message)}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hide');
    toast.addEventListener('animationend', () => toast.remove());
  }, 3000);
}

// ── Confirm dialog ───────────────────────────────────────────
function showConfirm(message, title = 'Confirm', okText = 'Delete') {
  return new Promise(resolve => {
    let overlay = document.getElementById('confirm-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.id = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-box">
          <div class="confirm-title" id="confirm-title"></div>
          <div class="confirm-msg" id="confirm-msg"></div>
          <div class="confirm-actions">
            <button class="btn btn-secondary" id="confirm-cancel">Cancel</button>
            <button class="btn btn-danger" id="confirm-ok"></button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
    }
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-msg').textContent = message;
    document.getElementById('confirm-ok').textContent = okText;
    overlay.classList.add('open');

    const ok = document.getElementById('confirm-ok');
    const cancel = document.getElementById('confirm-cancel');
    const close = () => { overlay.classList.remove('open'); };

    const onOk = () => { close(); ok.removeEventListener('click', onOk); cancel.removeEventListener('click', onCancel); resolve(true); };
    const onCancel = () => { close(); ok.removeEventListener('click', onOk); cancel.removeEventListener('click', onCancel); resolve(false); };
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
  });
}

// ── Modal ────────────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('open'); }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}
function setupModalClose(modalId) {
  const overlay = document.getElementById(modalId);
  if (!overlay) return;
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(modalId);
  });
  overlay.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => closeModal(modalId));
  });
}

// ── Navigation active state ──────────────────────────────────
function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item, .bnav-item').forEach(item => {
    const href = item.getAttribute('href') || '';
    const target = href.split('/').pop();
    if (target === page || (page === '' && target === 'index.html')) {
      item.classList.add('active');
    }
  });
}

// ── Form validation helper ───────────────────────────────────
function validateField(el) {
  if (!el.value.trim()) {
    el.classList.add('error');
    el.addEventListener('input', () => el.classList.remove('error'), { once: true });
    return false;
  }
  return true;
}

// ── Export ───────────────────────────────────────────────────
function exportData() {
  const data = loadData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `pesotracker-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data exported! I-save mo yung file.', 'success');
}

// ── Logout ───────────────────────────────────────────────────
function logout() {
  showConfirm(
    'Ibibigay muna ang iyong data bilang JSON file bago mag-switch ng account. Sigurado ka ba?',
    'Switch Account / Logout',
    'Yes, Logout'
  ).then(ok => {
    if (!ok) return;

    // 1. Auto-export first
    const data = loadData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `pesotracker-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // 2. Clear all storage
    setTimeout(() => {
      localStorage.removeItem('moneyTrackerData');
      sessionStorage.removeItem('pesotracker_session');

      // 3. Redirect to start
      showToast('Naka-logout na! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = 'start.html';
      }, 800);
    }, 500);
  });
}

// ── Inject sidebar/mobile UI ─────────────────────────────────
function injectExportUI() {
  const iconExport = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
  const iconLogout = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;

  // ── Sidebar (desktop) ──
  const sidebar = document.querySelector('.sidebar-nav');
  if (sidebar) {
    const sidebarActions = document.createElement('div');
    sidebarActions.style.cssText = 'padding:12px;border-top:1px solid var(--border);margin-top:16px;display:flex;flex-direction:column;gap:6px;';
    sidebarActions.innerHTML = `
      <button onclick="exportData()" class="btn btn-secondary" style="width:100%;justify-content:center;gap:8px;font-size:0.82rem;">
        ${iconExport} Export Data
      </button>
      <button onclick="logout()" class="btn" style="width:100%;justify-content:center;gap:8px;font-size:0.82rem;background:#ff4d6d18;color:var(--danger);border:1px solid #ff4d6d30;">
        ${iconLogout} Switch Account
      </button>
    `;
    sidebar.appendChild(sidebarActions);
  }

  // ── Mobile FAB menu ──
  const bottomNav = document.querySelector('.bottom-nav');
  if (bottomNav) {
    // Export FAB
    const fabExport = document.createElement('button');
    fabExport.onclick = exportData;
    fabExport.title = 'Export Data';
    fabExport.style.cssText = `
      position:fixed;bottom:80px;right:16px;
      width:44px;height:44px;
      background:var(--card2);
      border:1px solid var(--border2);
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      color:var(--accent);
      box-shadow:var(--shadow);
      z-index:99;
      transition:all 0.2s;
    `;
    fabExport.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
    fabExport.onmouseover = () => fabExport.style.transform = 'scale(1.1)';
    fabExport.onmouseout = () => fabExport.style.transform = 'scale(1)';

    // Logout FAB
    const fabLogout = document.createElement('button');
    fabLogout.onclick = logout;
    fabLogout.title = 'Switch Account';
    fabLogout.style.cssText = `
      position:fixed;bottom:132px;right:16px;
      width:44px;height:44px;
      background:#ff4d6d18;
      border:1px solid #ff4d6d30;
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      color:var(--danger);
      box-shadow:var(--shadow);
      z-index:99;
      transition:all 0.2s;
    `;
    fabLogout.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
    fabLogout.onmouseover = () => fabLogout.style.transform = 'scale(1.1)';
    fabLogout.onmouseout = () => fabLogout.style.transform = 'scale(1)';

    document.body.appendChild(fabExport);
    document.body.appendChild(fabLogout);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
  injectExportUI();
});