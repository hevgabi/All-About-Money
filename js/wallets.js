// js/wallets.js
async function renderWallets() {
  const wallets   = await getWallets();
  const container = document.getElementById('wallets-list');
  if (wallets.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="15" rx="3"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg><p>No wallets yet. Add your first one above!</p></div>`;
    return;
  }
  container.innerHTML = wallets.map(w => `
    <div class="wallet-card" data-id="${w.id}">
      <div class="wallet-name">${escapeHtml(w.name)}</div>
      <div class="wallet-balance">${formatMoney(w.balance)}</div>
      <div class="wallet-actions">
        <button class="btn btn-secondary btn-sm edit-btn" data-id="${w.id}" data-name="${escapeHtml(w.name)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>
        <button class="btn btn-danger btn-sm delete-btn" data-id="${w.id}" data-name="${escapeHtml(w.name)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          Delete
        </button>
      </div>
    </div>
  `).join('');
}

// ✅ Wire up form listeners on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setupModalClose('edit-wallet-modal');

  document.getElementById('add-wallet-form').addEventListener('submit', async e => {
    e.preventDefault();
    const nameEl = document.getElementById('wallet-name');
    const balEl  = document.getElementById('wallet-balance');
    if (!nameEl.value.trim()) {
      nameEl.classList.add('error');
      nameEl.addEventListener('input', () => nameEl.classList.remove('error'), { once: true });
      return;
    }
    await addWallet({ name: nameEl.value, balance: parseFloat(balEl.value) || 0 });
    showToast('Wallet added!', 'success');
    e.target.reset();
    await renderWallets();
  });

  document.getElementById('wallets-list').addEventListener('click', async e => {
    const editBtn   = e.target.closest('.edit-btn');
    const deleteBtn = e.target.closest('.delete-btn');

    if (editBtn) {
      document.getElementById('edit-wallet-id').value   = editBtn.dataset.id;
      document.getElementById('edit-wallet-name').value = editBtn.dataset.name;
      openModal('edit-wallet-modal');
    }

    if (deleteBtn) {
      const ok = await showConfirm(`Delete "${deleteBtn.dataset.name}"? All related transactions will be removed.`, 'Delete Wallet');
      if (!ok) return;
      await deleteWallet(deleteBtn.dataset.id);
      showToast('Wallet deleted', 'success');
      await renderWallets();
    }
  });

  document.getElementById('edit-wallet-form').addEventListener('submit', async e => {
    e.preventDefault();
    const id     = document.getElementById('edit-wallet-id').value;
    const nameEl = document.getElementById('edit-wallet-name');
    if (!nameEl.value.trim()) { nameEl.classList.add('error'); return; }
    await updateWallet(id, { name: nameEl.value });
    showToast('Wallet updated!', 'success');
    closeModal('edit-wallet-modal');
    await renderWallets();
  });
});

// ✅ Render only after auth is confirmed
window.onAuthReady = async function () {
  await renderWallets();
};