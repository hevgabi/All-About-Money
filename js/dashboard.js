// js/dashboard.js — Firebase version
import { requireAuth } from './auth-guard.js';
import {
  getWallets, getTransactions, addTransaction, todayISO
} from './data.js';
import { formatMoney, escapeHtml, todayISO as utilsToday, getThisWeekRange, getThisMonthRange, isInRange } from './utils.js';
import { showToast } from './ui.js';

let qtType = 'expense';

function setQtType(type) {
  qtType = type;
  document.getElementById('qt-expense-btn').className = type === 'expense' ? 'active-expense' : '';
  document.getElementById('qt-income-btn').className = type === 'income' ? 'active-income' : '';
}
window.setQtType = setQtType;

async function renderDashboard() {
  const [wallets, txns] = await Promise.all([getWallets(), getTransactions()]);

  const total = wallets.reduce((s, w) => s + w.balance, 0);
  document.getElementById('total-balance').innerHTML = `<span class="currency">₱</span>${total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('wallet-count').textContent = wallets.length > 0
    ? `${wallets.length} wallet${wallets.length > 1 ? 's' : ''}`
    : 'No wallets yet — add one in Wallets page';

  const week = getThisWeekRange();
  const month = getThisMonthRange();
  const today = utilsToday();

  let weekExp = 0, monthExp = 0, weekInc = 0, todayExp = 0;
  txns.forEach(t => {
    if (t.dateISO === today && t.type === 'expense') todayExp += t.amount;
    if (isInRange(t.dateISO, week.start, week.end)) {
      if (t.type === 'expense') weekExp += t.amount;
      else weekInc += t.amount;
    }
    if (isInRange(t.dateISO, month.start, month.end) && t.type === 'expense') monthExp += t.amount;
  });

  document.getElementById('stats-grid').innerHTML = `
    <div class="card card-sm">
      <div class="card-label">Today's Expenses</div>
      <div class="card-value" style="color:var(--danger)">${formatMoney(todayExp)}</div>
    </div>
    <div class="card card-sm">
      <div class="card-label">This Week Expenses</div>
      <div class="card-value" style="color:var(--danger)">${formatMoney(weekExp)}</div>
    </div>
    <div class="card card-sm">
      <div class="card-label">This Week Income</div>
      <div class="card-value" style="color:var(--accent)">${formatMoney(weekInc)}</div>
    </div>
    <div class="card card-sm">
      <div class="card-label">This Month Expenses</div>
      <div class="card-value" style="color:var(--danger)">${formatMoney(monthExp)}</div>
    </div>
  `;

  const walletsGrid = document.getElementById('dashboard-wallets');
  if (wallets.length === 0) {
    walletsGrid.innerHTML = `<div class="empty-state"><p>No wallets yet. <a href="wallets.html" style="color:var(--accent)">Add one</a>.</p></div>`;
  } else {
    walletsGrid.innerHTML = wallets.map(w => `
      <div class="wallet-card">
        <div class="wallet-name">${escapeHtml(w.name)}</div>
        <div class="wallet-balance">${formatMoney(w.balance)}</div>
        <div class="wallet-actions">
          <button class="btn btn-income btn-sm" onclick="prefillQuickTx('${w.id}','income')">+ Income</button>
          <button class="btn btn-expense btn-sm" onclick="prefillQuickTx('${w.id}','expense')">- Expense</button>
        </div>
      </div>
    `).join('');
  }

  const qtWallet = document.getElementById('qt-wallet');
  if (qtWallet) {
    qtWallet.innerHTML = wallets.map(w => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
  }

  document.getElementById('quick-tx-area').style.display = wallets.length > 0 ? '' : 'none';
}

function prefillQuickTx(walletId, type) {
  const qtWallet = document.getElementById('qt-wallet');
  if (qtWallet) qtWallet.value = walletId;
  setQtType(type);
  document.getElementById('qt-amount').focus();
  document.getElementById('quick-tx-area').scrollIntoView({ behavior: 'smooth' });
}
window.prefillQuickTx = prefillQuickTx;

requireAuth(async () => {
  await renderDashboard();

  document.getElementById('quick-tx-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const walletId = document.getElementById('qt-wallet').value;
    const amount = parseFloat(document.getElementById('qt-amount').value);
    const place = document.getElementById('qt-place').value;

    if (!walletId) { showToast('Select a wallet', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
    if (!place.trim()) { showToast('Enter a description', 'error'); return; }

    await addTransaction({ dateISO: utilsToday(), walletId, amount, place, type: qtType });
    showToast('Transaction added!', 'success');
    document.getElementById('quick-tx-form').reset();
    setQtType('expense');
    await renderDashboard();
  });
});
