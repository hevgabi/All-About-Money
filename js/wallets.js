// js/wallets.js
async function renderWallets() {
  const container = document.getElementById('wallets-list');
  try {
    const wallets = await getWallets();
    if (wallets.length === 0) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="15" rx="3"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg><p>No wallets yet. Add your first one above!</p></div>`;
      return;
    }
    container.innerHTML = wallets.map(w => `
      <div class="wallet-card" data-id="${w.id}">
        <div class="wallet-name">${escapeHtml(w.name)}</div>
        <div class="wallet-balance">${formatMoney(w.balance)}</div>
        <div class="wallet-actions">
          <button class="btn btn-secondary btn-sm edit-btn" data-id="${w.id}" data-name="${escapeHtml(w.name)}" data-balance="${w.balance}">
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

    // Populate transfer dropdowns using the same wallets — no extra fetch needed
    const opts = wallets.map(w => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
    const fromEl = document.getElementById('transfer-from');
    const toEl   = document.getElementById('transfer-to');
    if (fromEl) fromEl.innerHTML = opts;
    if (toEl)   toEl.innerHTML   = opts;
  } catch (err) {
    console.error('[wallets] renderWallets error:', err);
    // ✅ Show the actual error so we can debug
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;color:var(--danger)">
      <p>⚠️ Error loading wallets: ${escapeHtml(err.message)}</p>
      <p style="font-size:0.8rem;margin-top:8px;color:var(--text3)">Check browser console (F12) for details. Likely a Firestore Security Rules issue.</p>
    </div>`;
    showToast('Error loading wallets: ' + err.message, 'error');
  }
}

// ✅ Wire up form listeners on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setupModalClose('edit-wallet-modal');

  // ── Transfer Between Wallets ──
  document.getElementById('transfer-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fromId  = document.getElementById('transfer-from').value;
    const toId    = document.getElementById('transfer-to').value;
    const amount  = parseFloat(document.getElementById('transfer-amount').value);
    const note    = document.getElementById('transfer-note').value;

    if (!fromId || !toId)       { showToast('Select both wallets', 'error'); return; }
    if (fromId === toId)         { showToast('Source and destination must be different', 'error'); return; }
    if (!amount || amount <= 0)  { showToast('Enter a valid amount', 'error'); return; }

    const result = await addTransferTransaction({
      dateISO: todayISO(),
      fromWalletId: fromId,
      toWalletId: toId,
      amount,
      note
    });

    if (result.error) { showToast(result.error, 'error'); return; }

    showToast('Transfer completed!', 'success');
    document.getElementById('transfer-amount').value = '';
    document.getElementById('transfer-note').value   = '';
    await renderWallets();
  });

  document.getElementById('add-wallet-form').addEventListener('submit', async e => {
    e.preventDefault();
    const nameEl = document.getElementById('wallet-name');
    const balEl  = document.getElementById('wallet-balance');
    if (!nameEl.value.trim()) {
      nameEl.classList.add('error');
      nameEl.addEventListener('input', () => nameEl.classList.remove('error'), { once: true });
      return;
    }
    try {
      await addWallet({ name: nameEl.value, balance: parseFloat(balEl.value) || 0 });
      showToast('Wallet added!', 'success');
      e.target.reset();
      await renderWallets();
    } catch (err) {
      console.error('[wallets] addWallet error:', err);
      showToast('Error adding wallet: ' + err.message, 'error');
    }
  });

  document.getElementById('wallets-list').addEventListener('click', async e => {
    const editBtn   = e.target.closest('.edit-btn');
    const deleteBtn = e.target.closest('.delete-btn');

    if (editBtn) {
      document.getElementById('edit-wallet-id').value      = editBtn.dataset.id;
      document.getElementById('edit-wallet-name').value    = editBtn.dataset.name;
      document.getElementById('edit-wallet-balance').value = editBtn.dataset.balance;
      openModal('edit-wallet-modal');
    }

    if (deleteBtn) {
      const ok = await showConfirm(`Delete "${deleteBtn.dataset.name}"? All related transactions will be removed.`, 'Delete Wallet');
      if (!ok) return;
      try {
        await deleteWallet(deleteBtn.dataset.id);
        showToast('Wallet deleted', 'success');
        await renderWallets();
      } catch (err) {
        showToast('Error deleting wallet: ' + err.message, 'error');
      }
    }
  });

  document.getElementById('edit-wallet-form').addEventListener('submit', async e => {
    e.preventDefault();
    const id         = document.getElementById('edit-wallet-id').value;
    const nameEl     = document.getElementById('edit-wallet-name');
    const balEl      = document.getElementById('edit-wallet-balance');
    if (!nameEl.value.trim()) { nameEl.classList.add('error'); return; }
    const newBalance = parseFloat(balEl.value);
    if (isNaN(newBalance)) { showToast('Enter a valid balance', 'error'); return; }
    try {
      await updateWallet(id, { name: nameEl.value, balance: newBalance });
      showToast('Wallet updated!', 'success');
      closeModal('edit-wallet-modal');

      // Directly patch the DOM card so UI reflects change immediately
      // regardless of Firestore cache — no need to re-fetch
      const card = document.querySelector(`.wallet-card[data-id="${id}"]`);
      if (card) {
        card.querySelector('.wallet-name').textContent    = nameEl.value.trim();
        card.querySelector('.wallet-balance').textContent = formatMoney(newBalance);
        const editBtn = card.querySelector('.edit-btn');
        editBtn.dataset.name    = nameEl.value.trim();
        editBtn.dataset.balance = newBalance;
      }

      // Also do a full re-render in background to sync any other stale state
      renderWallets();
    } catch (err) {
      console.error('[wallets] updateWallet error:', err);
      showToast('Error updating wallet: ' + err.message, 'error');
    }
  });
});

// ✅ Render only after auth is confirmed
window.onAuthReady = async function (user) {
  console.log('[wallets] onAuthReady called, uid:', user.uid);
  await renderWallets();
};