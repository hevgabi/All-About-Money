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
  if (el) el.classList.add('open');
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

// (nav init moved to bottom DOMContentLoaded block)
// ── Hamburger Drawer (mobile) ────────────────────────────────
function injectHamburger() {
  // Only inject on pages that have a sidebar
  if (!document.querySelector('.sidebar')) return;
  // Don't inject on login page
  if (location.pathname.includes('login')) return;
  // Avoid double-inject
  if (document.getElementById('hamburger-btn')) return;

  const NAV_HTML = document.querySelector('.sidebar-nav')?.innerHTML || '';

  // Hamburger button
  const btn = document.createElement('button');
  btn.id = 'hamburger-btn';
  btn.className = 'hamburger-btn';
  btn.setAttribute('aria-label', 'Open menu');
  btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
  document.body.appendChild(btn);

  // Overlay
  const overlay = document.createElement('div');
  overlay.id = 'drawer-overlay';
  overlay.className = 'drawer-overlay';
  document.body.appendChild(overlay);

  // Drawer
  const drawer = document.createElement('div');
  drawer.id = 'drawer-sidebar';
  drawer.className = 'drawer-sidebar';
  drawer.innerHTML = `
    <div class="drawer-header">
      <div>
        <div class="drawer-logo-text">₱ PesoTracker</div>
        <div class="drawer-logo-sub">Personal Finance</div>
      </div>
      <button class="drawer-close-btn" id="drawer-close" aria-label="Close menu">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <nav class="drawer-nav" id="drawer-nav">
      <a href="index.html" class="nav-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg><span>Dashboard</span></a>
      <a href="wallets.html" class="nav-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="3"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg><span>Wallets</span></a>
      <a href="transactions.html" class="nav-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg><span>Transactions</span></a>
      <a href="reports.html" class="nav-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg><span>Reports</span></a>
      <a href="wants.html" class="nav-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg><span>Wants</span></a>
      <a href="budget.html" class="nav-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg><span>Budget</span></a>
      <a href="goals.html" class="nav-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg><span>Goals (Ipon)</span></a>
    </nav>
    <div class="drawer-footer" id="drawer-footer"></div>
  `;
  document.body.appendChild(drawer);

  // Mark active link in drawer
  const page = location.pathname.split('/').pop() || 'index.html';
  drawer.querySelectorAll('.nav-item').forEach(item => {
    const target = (item.getAttribute('href') || '').split('/').pop();
    if (target === page || (page === '' && target === 'index.html')) {
      item.classList.add('active');
    }
  });

  function openDrawer() {
    drawer.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  btn.addEventListener('click', openDrawer);
  overlay.addEventListener('click', closeDrawer);
  document.getElementById('drawer-close').addEventListener('click', closeDrawer);

  // If auth.js injects user panel into sidebar, mirror it into drawer footer
  // We observe sidebar-nav for the user panel being added
  const obs = new MutationObserver(() => {
    const panel = document.getElementById('user-panel-sidebar');
    const footer = document.getElementById('drawer-footer');
    if (panel && footer && !footer.children.length) {
      footer.innerHTML = panel.innerHTML;
    }
  });
  const sidebarNav = document.querySelector('.sidebar-nav');
  if (sidebarNav) obs.observe(sidebarNav, { childList: true, subtree: true });
}

// Auto-inject on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
  injectHamburger();
});