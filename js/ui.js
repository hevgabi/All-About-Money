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

// Auto-run nav on load
document.addEventListener('DOMContentLoaded', () => setActiveNav());