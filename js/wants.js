// js/wants.js
let _cachedWants = [];

async function renderWants() {
  const allWants = await getWants();
  _cachedWants   = allWants;
  const active = allWants.filter(w => !w.boughtAt).sort((a, b) => a.priority - b.priority || b.createdAt.localeCompare(a.createdAt));
  const bought = allWants.filter(w =>  w.boughtAt).sort((a, b) => b.boughtAt.localeCompare(a.boughtAt));

  document.getElementById('wants-count').textContent = active.length ? `(${active.length})` : '';
  renderActiveWants(active);
  renderBoughtWants(bought);
}

function renderActiveWants(wants) {
  const container = document.getElementById('wants-list');
  if (wants.length === 0) {
    container.innerHTML = `<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg><p>Wala pang wants. Magdagdag ng gusto mong bilhin!</p></div>`;
    return;
  }
  const iconEdit  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const iconDel   = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>`;
  const iconCheck = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20,6 9,17 4,12"/></svg>`;

  container.innerHTML = wants.map(w => `
    <div class="want-item" data-id="${w.id}">
      <div class="want-priority p${w.priority}">${w.priority}</div>
      <div class="want-info">
        <div class="want-name">${escapeHtml(w.name)}</div>
        ${w.notes ? `<div style="font-size:0.8rem;color:var(--text3);margin-top:2px">${escapeHtml(w.notes)}</div>` : ''}
      </div>
      <div class="want-price">${formatMoney(w.price)}</div>
      <div class="want-actions">
        <button class="btn btn-sm buy-btn" data-id="${w.id}" title="Nabili na!" style="background:#00F5C422;color:var(--accent);border:1px solid #00F5C433;gap:5px">${iconCheck} Nabili</button>
        <button class="btn btn-icon btn-sm edit-want-btn" data-id="${w.id}" title="Edit">${iconEdit}</button>
        <button class="btn btn-icon btn-sm delete-want-btn" data-id="${w.id}" data-name="${escapeHtml(w.name)}" title="Delete" style="color:var(--danger)">${iconDel}</button>
      </div>
    </div>
  `).join('');
}

function renderBoughtWants(bought) {
  const section   = document.getElementById('bought-section');
  const container = document.getElementById('bought-list');
  const countEl   = document.getElementById('bought-count');

  if (bought.length === 0) { section.style.display = 'none'; return; }
  section.style.display = '';
  countEl.textContent   = `(${bought.length})`;

  const iconDel = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>`;
  container.innerHTML = bought.map(w => `
    <div class="want-item" data-id="${w.id}" style="opacity:0.7;">
      <div class="want-priority" style="width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:#00F5C422;color:var(--accent);flex-shrink:0;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20,6 9,17 4,12"/></svg>
      </div>
      <div class="want-info">
        <div class="want-name" style="text-decoration:line-through;color:var(--text2)">${escapeHtml(w.name)}</div>
        <div style="font-size:0.78rem;color:var(--text3);margin-top:2px">
          Nabili: ${formatDate(w.boughtAt.slice(0,10))}
          ${w.actualPrice !== undefined ? ` &bull; Gastos: ${formatMoney(w.actualPrice)}` : ''}
          ${w.boughtFromWallet ? ` &bull; ${escapeHtml(w.boughtFromWallet)}` : ''}
        </div>
      </div>
      <div class="want-price" style="color:var(--text3);text-decoration:line-through">${formatMoney(w.price)}</div>
      <div class="want-actions">
        <button class="btn btn-icon btn-sm delete-want-btn" data-id="${w.id}" data-name="${escapeHtml(w.name)}" title="Remove from history" style="color:var(--danger)">${iconDel}</button>
      </div>
    </div>
  `).join('');
}

async function openBuyModal(wantId) {
  const want    = _cachedWants.find(w => w.id === wantId);
  if (!want) return;
  const wallets = await getWallets();

  document.getElementById('buy-want-id').value  = wantId;
  document.getElementById('buy-amount').value   = want.price || '';
  document.getElementById('buy-modal-info').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-weight:700;font-size:1rem">${escapeHtml(want.name)}</div>
        <div style="font-size:0.8rem;color:var(--text2);margin-top:2px">Listed price: ${formatMoney(want.price)}</div>
      </div>
      <div class="want-priority p${want.priority}">${want.priority}</div>
    </div>
  `;

  const walletSel = document.getElementById('buy-wallet');
  walletSel.innerHTML = wallets.length
    ? wallets.map(w => `<option value="${w.id}">${escapeHtml(w.name)} — ${formatMoney(w.balance)}</option>`).join('')
    : '<option value="">No wallets available</option>';

  await updateBuyWalletInfo();
  walletSel.onchange = updateBuyWalletInfo;
  openModal('buy-modal');
  setTimeout(() => document.getElementById('buy-amount').focus(), 120);
}

async function updateBuyWalletInfo() {
  const walletId = document.getElementById('buy-wallet').value;
  const wallet   = await getWallet(walletId);
  document.getElementById('buy-wallet-balance').textContent = wallet
    ? `Available balance: ${formatMoney(wallet.balance)}` : '';
}

// ✅ Wire up form listeners on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setupModalClose('edit-want-modal');
  setupModalClose('buy-modal');

  document.getElementById('add-want-form').addEventListener('submit', async e => {
    e.preventDefault();
    const nameEl = document.getElementById('want-name');
    if (!nameEl.value.trim()) { nameEl.classList.add('error'); nameEl.addEventListener('input', () => nameEl.classList.remove('error'), { once: true }); return; }
    await addWant({
      name:     nameEl.value,
      price:    parseFloat(document.getElementById('want-price').value) || 0,
      priority: document.getElementById('want-priority').value,
      notes:    document.getElementById('want-notes').value
    });
    showToast('Want added!', 'success');
    e.target.reset();
    document.getElementById('want-priority').value = '3';
    await renderWants();
  });

  document.getElementById('wants-list').addEventListener('click', async e => {
    const buyBtn  = e.target.closest('.buy-btn');
    const editBtn = e.target.closest('.edit-want-btn');
    const delBtn  = e.target.closest('.delete-want-btn');

    if (buyBtn)  await openBuyModal(buyBtn.dataset.id);

    if (editBtn) {
      const want = _cachedWants.find(w => w.id === editBtn.dataset.id);
      if (!want) return;
      document.getElementById('edit-want-id').value       = want.id;
      document.getElementById('edit-want-name').value     = want.name;
      document.getElementById('edit-want-price').value    = want.price;
      document.getElementById('edit-want-priority').value = want.priority;
      document.getElementById('edit-want-notes').value    = want.notes || '';
      openModal('edit-want-modal');
    }

    if (delBtn) {
      const ok = await showConfirm(`Remove "${delBtn.dataset.name}" from your wants?`, 'Remove Want');
      if (!ok) return;
      await deleteWant(delBtn.dataset.id);
      showToast('Want removed', 'success');
      await renderWants();
    }
  });

  document.getElementById('bought-list').addEventListener('click', async e => {
    const delBtn = e.target.closest('.delete-want-btn');
    if (!delBtn) return;
    const ok = await showConfirm(`Remove "${delBtn.dataset.name}" from history?`, 'Remove');
    if (!ok) return;
    await deleteWant(delBtn.dataset.id);
    showToast('Removed from history', 'success');
    await renderWants();
  });

  document.getElementById('buy-form').addEventListener('submit', async e => {
    e.preventDefault();
    const wantId   = document.getElementById('buy-want-id').value;
    const walletId = document.getElementById('buy-wallet').value;
    const amount   = parseFloat(document.getElementById('buy-amount').value);
    const want     = _cachedWants.find(w => w.id === wantId);

    if (!walletId)            { showToast('Select a wallet', 'error'); return; }
    if (!amount || amount<=0) { showToast('Enter a valid amount', 'error'); return; }
    if (!want)                { showToast('Want not found', 'error'); return; }

    const wallet = await getWallet(walletId);
    if (!wallet)              { showToast('Wallet not found', 'error'); return; }
    if (amount > wallet.balance) { showToast(`Kulang ang balance! Available: ${formatMoney(wallet.balance)}`, 'error'); return; }

    await addTransaction({ dateISO: todayISO(), walletId, amount, place: `Bought: ${want.name}`, type: 'expense' });
    await updateWant(wantId, { boughtAt: new Date().toISOString(), actualPrice: amount, boughtFromWallet: wallet.name });

    showToast(`Nabili na! "${want.name}" — ${formatMoney(amount)} deducted from ${wallet.name} 🛍️`, 'success');
    closeModal('buy-modal');
    await renderWants();
  });

  document.getElementById('edit-want-form').addEventListener('submit', async e => {
    e.preventDefault();
    const nameEl = document.getElementById('edit-want-name');
    if (!nameEl.value.trim()) { nameEl.classList.add('error'); return; }
    await updateWant(document.getElementById('edit-want-id').value, {
      name:     nameEl.value,
      price:    parseFloat(document.getElementById('edit-want-price').value) || 0,
      priority: parseInt(document.getElementById('edit-want-priority').value),
      notes:    document.getElementById('edit-want-notes').value
    });
    showToast('Want updated!', 'success');
    closeModal('edit-want-modal');
    await renderWants();
  });
});

// ✅ Render only after auth is confirmed
window.onAuthReady = async function () {
  await renderWants();
};