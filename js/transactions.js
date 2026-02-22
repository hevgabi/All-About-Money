// js/transactions.js
let txType = 'expense';
let editTxType = 'expense';
let currentFilter = 'today';
let customDate = null;

function setTxType(type) {
  txType = type;
  document.getElementById('tx-expense-btn').className = type === 'expense' ? 'active-expense' : '';
  document.getElementById('tx-income-btn').className = type === 'income' ? 'active-income' : '';
}
function setEditTxType(type) {
  editTxType = type;
  document.getElementById('edit-expense-btn').className = type === 'expense' ? 'active-expense' : '';
  document.getElementById('edit-income-btn').className = type === 'income' ? 'active-income' : '';
}

function setFilter(f) {
  currentFilter = f;
  customDate = null;
  document.getElementById('filter-date').value = '';
  ['today','week','month','all'].forEach(id => {
    document.getElementById('filter-' + id).classList.toggle('active', f === id);
  });
  renderTxList();
}

function getFilteredTxns() {
  const txns = getTransactions();
  if (customDate) return txns.filter(t => t.dateISO === customDate);
  if (currentFilter === 'today') return txns.filter(t => t.dateISO === todayISO());
  if (currentFilter === 'week') { const r = getThisWeekRange(); return txns.filter(t => isInRange(t.dateISO, r.start, r.end)); }
  if (currentFilter === 'month') { const r = getThisMonthRange(); return txns.filter(t => isInRange(t.dateISO, r.start, r.end)); }
  return txns;
}

function populateWalletDropdown(selectId, selectedId) {
  const wallets = getWallets();
  const sel = document.getElementById(selectId);
  sel.innerHTML = wallets.length
    ? wallets.map(w => `<option value="${w.id}" ${w.id === selectedId ? 'selected' : ''}>${escapeHtml(w.name)}</option>`).join('')
    : '<option value="">No wallets</option>';
}

function renderTxList() {
  const txns = getFilteredTxns().sort((a, b) => b.dateISO.localeCompare(a.dateISO));
  const wallets = getWallets();
  const walletMap = Object.fromEntries(wallets.map(w => [w.id, w.name]));

  let totalExp = 0, totalInc = 0;
  txns.forEach(t => { if (t.type === 'expense') totalExp += t.amount; else totalInc += t.amount; });

  document.getElementById('tx-summary').innerHTML = `
    <div class="card card-sm" style="flex:1;min-width:140px">
      <div class="card-label">Income</div>
      <div class="card-value" style="color:var(--accent);font-size:1.1rem">${formatMoney(totalInc)}</div>
    </div>
    <div class="card card-sm" style="flex:1;min-width:140px">
      <div class="card-label">Expenses</div>
      <div class="card-value" style="color:var(--danger);font-size:1.1rem">${formatMoney(totalExp)}</div>
    </div>
    <div class="card card-sm" style="flex:1;min-width:140px">
      <div class="card-label">Net</div>
      <div class="card-value" style="color:${totalInc - totalExp >= 0 ? 'var(--accent)' : 'var(--danger)'};font-size:1.1rem">${formatMoney(totalInc - totalExp)}</div>
    </div>
  `;

  const iconEdit = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const iconDel = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;

  if (txns.length === 0) {
    document.getElementById('tx-tbody').innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text3)">No transactions found</td></tr>`;
    document.getElementById('tx-cards').innerHTML = `<div class="empty-state"><p>No transactions found for this period.</p></div>`;
    return;
  }

  // Table
  document.getElementById('tx-tbody').innerHTML = txns.map(t => `
    <tr>
      <td>${formatDate(t.dateISO)}</td>
      <td>${escapeHtml(walletMap[t.walletId] || 'Unknown')}</td>
      <td><span class="badge badge-${t.type}">${t.type}</span></td>
      <td class="td-amount ${t.type}">${t.type === 'expense' ? '-' : '+'}${formatMoney(t.amount)}</td>
      <td>${escapeHtml(t.place)}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-icon btn-sm edit-tx-btn" data-id="${t.id}" title="Edit">${iconEdit}</button>
          <button class="btn btn-icon btn-sm delete-tx-btn" data-id="${t.id}" data-place="${escapeHtml(t.place)}" title="Delete" style="color:var(--danger)">${iconDel}</button>
        </div>
      </td>
    </tr>
  `).join('');

  // Mobile cards
  document.getElementById('tx-cards').innerHTML = txns.map(t => `
    <div class="tx-card">
      <div class="tx-card-header">
        <div class="tx-card-place">${escapeHtml(t.place)}</div>
        <div class="tx-card-amount ${t.type}">${t.type === 'expense' ? '-' : '+'}${formatMoney(t.amount)}</div>
      </div>
      <div class="tx-card-meta">
        <span class="badge badge-${t.type}">${t.type}</span>
        <span style="color:var(--text2);font-size:0.8rem">${escapeHtml(walletMap[t.walletId] || 'Unknown')}</span>
        <span style="color:var(--text3);font-size:0.8rem">${formatDate(t.dateISO)}</span>
      </div>
      <div class="tx-card-actions">
        <button class="btn btn-secondary btn-sm edit-tx-btn" data-id="${t.id}">${iconEdit} Edit</button>
        <button class="btn btn-danger btn-sm delete-tx-btn" data-id="${t.id}" data-place="${escapeHtml(t.place)}">${iconDel} Delete</button>
      </div>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  // Set defaults
  document.getElementById('tx-date').value = todayISO();
  populateWalletDropdown('tx-wallet', null);
  renderTxList();
  setupModalClose('edit-tx-modal');

  // Filter by date picker
  document.getElementById('filter-date').addEventListener('change', e => {
    if (!e.target.value) return;
    customDate = e.target.value;
    ['today','week','month','all'].forEach(id => document.getElementById('filter-' + id).classList.remove('active'));
    renderTxList();
  });

  // Add transaction
  document.getElementById('add-tx-form').addEventListener('submit', e => {
    e.preventDefault();
    const date = document.getElementById('tx-date').value;
    const walletId = document.getElementById('tx-wallet').value;
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const place = document.getElementById('tx-place').value;

    if (!date) { showToast('Select a date', 'error'); return; }
    if (!walletId) { showToast('Select a wallet', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
    if (!place.trim()) { showToast('Enter a description', 'error'); return; }

    addTransaction({ dateISO: date, walletId, amount, place, type: txType });
    showToast('Transaction added!', 'success');
    document.getElementById('tx-amount').value = '';
    document.getElementById('tx-place').value = '';
    renderTxList();
  });

  // Event delegation for table/cards
  function handleTxAction(e) {
    const editBtn = e.target.closest('.edit-tx-btn');
    const delBtn = e.target.closest('.delete-tx-btn');

    if (editBtn) {
      const tx = getTransactions().find(t => t.id === editBtn.dataset.id);
      if (!tx) return;
      document.getElementById('edit-tx-id').value = tx.id;
      document.getElementById('edit-tx-date').value = tx.dateISO;
      document.getElementById('edit-tx-amount').value = tx.amount;
      document.getElementById('edit-tx-place').value = tx.place;
      populateWalletDropdown('edit-tx-wallet', tx.walletId);
      setEditTxType(tx.type);
      openModal('edit-tx-modal');
    }

    if (delBtn) {
      showConfirm(`Delete "${delBtn.dataset.place}"?`, 'Delete Transaction').then(ok => {
        if (!ok) return;
        deleteTransaction(delBtn.dataset.id);
        showToast('Transaction deleted', 'success');
        renderTxList();
      });
    }
  }

  document.getElementById('tx-tbody').addEventListener('click', handleTxAction);
  document.getElementById('tx-cards').addEventListener('click', handleTxAction);

  // Edit submit
  document.getElementById('edit-tx-form').addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('edit-tx-id').value;
    const dateISO = document.getElementById('edit-tx-date').value;
    const walletId = document.getElementById('edit-tx-wallet').value;
    const amount = parseFloat(document.getElementById('edit-tx-amount').value);
    const place = document.getElementById('edit-tx-place').value;

    if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
    if (!place.trim()) { showToast('Enter a description', 'error'); return; }

    updateTransaction(id, { dateISO, walletId, amount, place, type: editTxType });
    showToast('Transaction updated!', 'success');
    closeModal('edit-tx-modal');
    renderTxList();
  });
});
