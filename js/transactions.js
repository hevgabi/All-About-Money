// js/transactions.js
let txType      = 'expense';
let editTxType  = 'expense';
let currentFilter = 'today';
let customDate  = null;
let _cachedTxns = [];

// ── Type toggle helpers ────────────────────────────────────────
function setTxType(type) {
  txType = type;
  document.getElementById('tx-expense-btn').className = type === 'expense' ? 'active-expense' : '';
  document.getElementById('tx-income-btn').className  = type === 'income'  ? 'active-income'  : '';
}

function setEditTxType(type) {
  editTxType = type;
  document.getElementById('edit-expense-btn').className = type === 'expense' ? 'active-expense' : '';
  document.getElementById('edit-income-btn').className  = type === 'income'  ? 'active-income'  : '';
}

// ── Filter helpers ─────────────────────────────────────────────
function setFilter(f) {
  currentFilter = f;
  customDate    = null;
  document.getElementById('filter-date').value = '';
  ['today','week','month','all'].forEach(id => {
    document.getElementById('filter-' + id).classList.toggle('active', f === id);
  });
  renderTxList();
}

// ── Wallet dropdown populate ───────────────────────────────────
async function populateWalletDropdown(selectId, selectedId) {
  const wallets = await getWallets();
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = wallets.length
    ? wallets.map(w => `<option value="${w.id}" ${w.id === selectedId ? 'selected' : ''}>${escapeHtml(w.name)}</option>`).join('')
    : '<option value="">No wallets</option>';
}

// ── Render transaction list ────────────────────────────────────
async function renderTxList() {
  const [allTxns, wallets] = await Promise.all([getTransactions(), getWallets()]);
  _cachedTxns = allTxns;
  const walletMap = Object.fromEntries(wallets.map(w => [w.id, w.name]));

  let txns = allTxns;
  if (customDate)                     txns = txns.filter(t => t.dateISO === customDate);
  else if (currentFilter === 'today') txns = txns.filter(t => t.dateISO === todayISO());
  else if (currentFilter === 'week')  { const r = getThisWeekRange();  txns = txns.filter(t => isInRange(t.dateISO, r.start, r.end)); }
  else if (currentFilter === 'month') { const r = getThisMonthRange(); txns = txns.filter(t => isInRange(t.dateISO, r.start, r.end)); }
  txns = txns.sort((a, b) => b.dateISO.localeCompare(a.dateISO));

  // Summary: transfers excluded (internal moves)
  let totalExp = 0, totalInc = 0;
  txns.forEach(t => {
    if (t.type === 'expense') totalExp += t.amount;
    else if (t.type === 'income') totalInc += t.amount;
  });

  document.getElementById('tx-summary').innerHTML = `
    <div class="card card-sm" style="flex:1;min-width:140px"><div class="card-label">Income</div><div class="card-value" style="color:var(--accent);font-size:1.1rem">${formatMoney(totalInc)}</div></div>
    <div class="card card-sm" style="flex:1;min-width:140px"><div class="card-label">Expenses</div><div class="card-value" style="color:var(--danger);font-size:1.1rem">${formatMoney(totalExp)}</div></div>
    <div class="card card-sm" style="flex:1;min-width:140px"><div class="card-label">Net</div><div class="card-value" style="color:${totalInc-totalExp>=0?'var(--accent)':'var(--danger)'};font-size:1.1rem">${formatMoney(totalInc-totalExp)}</div></div>
  `;

  const iconEdit = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const iconDel  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;

  if (txns.length === 0) {
    document.getElementById('tx-tbody').innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text3)">No transactions found</td></tr>`;
    document.getElementById('tx-cards').innerHTML = `<div class="empty-state"><p>No transactions found for this period.</p></div>`;
    return;
  }

  function walletDisplay(t) {
    if (t.type === 'transfer') {
      const from = escapeHtml(walletMap[t.walletId] || 'Unknown');
      const to   = escapeHtml(walletMap[t.toWalletId] || 'Unknown');
      return `<span style="font-size:0.78rem">${from} <span style="color:var(--transfer,#a78bfa)">→</span> ${to}</span>`;
    }
    return escapeHtml(walletMap[t.walletId] || 'Unknown');
  }

  function amountDisplay(t) {
    if (t.type === 'transfer') return `<span class="td-transfer">↔ ${formatMoney(t.amount)}</span>`;
    return `<span class="${t.type}">${t.type==='expense'?'-':'+'}${formatMoney(t.amount)}</span>`;
  }

  document.getElementById('tx-tbody').innerHTML = txns.map(t => `
    <tr>
      <td>${formatDate(t.dateISO)}</td>
      <td>${walletDisplay(t)}</td>
      <td><span class="badge badge-${t.type}">${t.type}</span></td>
      <td class="td-amount">${amountDisplay(t)}</td>
      <td>${escapeHtml(t.place)}</td>
      <td><div style="display:flex;gap:6px">
        <button class="btn btn-icon btn-sm edit-tx-btn" data-id="${t.id}" title="Edit">${iconEdit}</button>
        <button class="btn btn-icon btn-sm delete-tx-btn" data-id="${t.id}" data-place="${escapeHtml(t.place)}" title="Delete" style="color:var(--danger)">${iconDel}</button>
      </div></td>
    </tr>
  `).join('');

  // Separate transfers from income/expense for mobile cards
  const incomExpTxns = txns.filter(t => t.type !== 'transfer');
  const transferTxns = txns.filter(t => t.type === 'transfer');

  function buildCard(t) {
    return `
    <div class="tx-card">
      <div class="tx-card-header">
        <div class="tx-card-place">${escapeHtml(t.place)}</div>
        <div class="tx-card-amount">${amountDisplay(t)}</div>
      </div>
      <div class="tx-card-meta">
        <span class="badge badge-${t.type}">${t.type}</span>
        <span style="color:var(--text2);font-size:0.8rem">${walletDisplay(t)}</span>
        <span style="color:var(--text3);font-size:0.8rem">${formatDate(t.dateISO)}</span>
      </div>
      <div class="tx-card-actions">
        <button class="btn btn-secondary btn-sm edit-tx-btn" data-id="${t.id}">${iconEdit} Edit</button>
        <button class="btn btn-danger btn-sm delete-tx-btn" data-id="${t.id}" data-place="${escapeHtml(t.place)}">${iconDel} Delete</button>
      </div>
    </div>`;
  }

  let cardsHtml = incomExpTxns.map(buildCard).join('');

  if (transferTxns.length > 0) {
    cardsHtml += `
      <div style="margin-top:20px;margin-bottom:8px;font-size:0.78rem;font-weight:700;color:var(--transfer,#a78bfa);letter-spacing:0.08em;text-transform:uppercase;">
        — Transfers —
      </div>
      ${transferTxns.map(buildCard).join('')}
    `;
  }

  document.getElementById('tx-cards').innerHTML = cardsHtml;
}

// ── Wire up form listeners on DOM ready ────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('tx-date').value = todayISO();
  setupModalClose('edit-tx-modal');

  document.getElementById('filter-date').addEventListener('change', e => {
    if (!e.target.value) return;
    customDate = e.target.value;
    ['today','week','month','all'].forEach(id => document.getElementById('filter-' + id).classList.remove('active'));
    renderTxList();
  });

  // ── Add transaction form ──
  document.getElementById('add-tx-form').addEventListener('submit', async e => {
    e.preventDefault();
    const date   = document.getElementById('tx-date').value;
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const place  = document.getElementById('tx-place').value;

    if (!date)               { showToast('Select a date', 'error'); return; }
    if (!amount || amount<=0){ showToast('Enter a valid amount', 'error'); return; }

    const walletId = document.getElementById('tx-wallet').value;
    if (!walletId)         { showToast('Select a wallet', 'error'); return; }
    if (!place.trim())     { showToast('Enter a description', 'error'); return; }
    await addTransaction({ dateISO: date, walletId, amount, place, type: txType });
    showToast('Transaction added!', 'success');

    document.getElementById('tx-amount').value = '';
    document.getElementById('tx-place').value  = '';
    await renderTxList();
  });

  // ── Edit / Delete delegation ──
  async function handleTxAction(e) {
    const editBtn = e.target.closest('.edit-tx-btn');
    const delBtn  = e.target.closest('.delete-tx-btn');

    if (editBtn) {
      const tx = _cachedTxns.find(t => t.id === editBtn.dataset.id);
      if (!tx) return;
      document.getElementById('edit-tx-id').value     = tx.id;
      document.getElementById('edit-tx-date').value   = tx.dateISO;
      document.getElementById('edit-tx-amount').value = tx.amount;
      document.getElementById('edit-tx-place').value  = tx.place;
      await populateWalletDropdown('edit-tx-wallet', tx.walletId);
      setEditTxType(tx.type);
      openModal('edit-tx-modal');
    }

    if (delBtn) {
      const ok = await showConfirm(`Delete "${delBtn.dataset.place}"?`, 'Delete Transaction');
      if (!ok) return;
      await deleteTransaction(delBtn.dataset.id);
      showToast('Transaction deleted', 'success');
      await renderTxList();
    }
  }

  document.getElementById('tx-tbody').addEventListener('click', handleTxAction);
  document.getElementById('tx-cards').addEventListener('click', handleTxAction);

  // ── Edit transaction form ──
  document.getElementById('edit-tx-form').addEventListener('submit', async e => {
    e.preventDefault();
    const id       = document.getElementById('edit-tx-id').value;
    const dateISO  = document.getElementById('edit-tx-date').value;
    const walletId = document.getElementById('edit-tx-wallet').value;
    const amount   = parseFloat(document.getElementById('edit-tx-amount').value);
    const place    = document.getElementById('edit-tx-place').value;

    if (!amount || amount<=0){ showToast('Enter a valid amount', 'error'); return; }
    if (!place.trim())       { showToast('Enter a description', 'error'); return; }

    await updateTransaction(id, { dateISO, walletId, amount, place, type: editTxType });

    showToast('Transaction updated!', 'success');
    closeModal('edit-tx-modal');
    await renderTxList();
  });
});

// ── Render only after auth is confirmed ───────────────────────
window.onAuthReady = async function () {
  await populateWalletDropdown('tx-wallet', null);
  await renderTxList();
};