// js/reports.js
function switchTab(tab) {
  document.getElementById('tab-weekly').classList.toggle('active', tab === 'weekly');
  document.getElementById('tab-monthly').classList.toggle('active', tab === 'monthly');
  document.getElementById('weekly-report').style.display  = tab === 'weekly'  ? '' : 'none';
  document.getElementById('monthly-report').style.display = tab === 'monthly' ? '' : 'none';
}

async function renderWeeklyReport() {
  const refDate = document.getElementById('week-ref-date').value || todayISO();
  const range   = getWeekRange(refDate);
  const [allTxns, wallets] = await Promise.all([getTransactions(), getWallets()]);
  const txns     = allTxns.filter(t => isInRange(t.dateISO, range.start, range.end));
  const walletMap= Object.fromEntries(wallets.map(w => [w.id, w.name]));

  document.getElementById('weekly-range-label').textContent = `Week: ${formatDate(range.start)} – ${formatDate(range.end)}`;

  let totalExp = 0, totalInc = 0;
  const byWallet = {};
  txns.forEach(t => {
    if (t.type === 'transfer') return; // transfers never affect income/expense totals
    if (t.type === 'expense') totalExp += t.amount; else totalInc += t.amount;
    if (!byWallet[t.walletId]) byWallet[t.walletId] = { exp: 0, inc: 0 };
    if (t.type === 'expense') byWallet[t.walletId].exp += t.amount; else byWallet[t.walletId].inc += t.amount;
  });
  const net = totalInc - totalExp;

  document.getElementById('weekly-stats').innerHTML = `
    <div class="report-card"><div class="card-label">Total Expenses</div><div class="report-card-val negative">${formatMoney(totalExp)}</div></div>
    <div class="report-card"><div class="card-label">Total Income</div><div class="report-card-val positive">${formatMoney(totalInc)}</div></div>
    <div class="report-card"><div class="card-label">Net</div><div class="report-card-val ${net>=0?'positive':'negative'}">${formatMoney(net)}</div></div>
    <div class="report-card"><div class="card-label">Transactions</div><div class="report-card-val">${txns.filter(t => t.type !== 'transfer').length}</div></div>
  `;

  const breakdownHtml = Object.entries(byWallet).map(([wid, d]) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-top:1px solid var(--border)">
      <span style="font-weight:600">${escapeHtml(walletMap[wid] || 'Unknown')}</span>
      <span>
        <span style="color:var(--accent);margin-right:12px">+${formatMoney(d.inc)}</span>
        <span style="color:var(--danger)">-${formatMoney(d.exp)}</span>
      </span>
    </div>
  `).join('');

  document.getElementById('weekly-breakdown').innerHTML = Object.keys(byWallet).length ? `
    <div class="card" style="margin-top:16px"><div class="section-title">By Wallet</div>${breakdownHtml}</div>
  ` : '';
}

async function renderMonthlyReport() {
  const month = parseInt(document.getElementById('month-select').value);
  const year  = parseInt(document.getElementById('year-select').value);
  const range = getMonthRange(year, month);
  const allTxns = await getTransactions();
  const txns  = allTxns.filter(t => isInRange(t.dateISO, range.start, range.end));

  let totalExp = 0, totalInc = 0;
  const byDay = {};
  txns.forEach(t => {
    if (t.type === 'transfer') return; // transfers never affect income/expense totals
    if (t.type === 'expense') totalExp += t.amount; else totalInc += t.amount;
    if (!byDay[t.dateISO]) byDay[t.dateISO] = { exp: 0, inc: 0 };
    if (t.type === 'expense') byDay[t.dateISO].exp += t.amount; else byDay[t.dateISO].inc += t.amount;
  });
  const net = totalInc - totalExp;

  document.getElementById('monthly-stats').innerHTML = `
    <div class="report-card"><div class="card-label">Total Expenses</div><div class="report-card-val negative">${formatMoney(totalExp)}</div></div>
    <div class="report-card"><div class="card-label">Total Income</div><div class="report-card-val positive">${formatMoney(totalInc)}</div></div>
    <div class="report-card"><div class="card-label">Net</div><div class="report-card-val ${net>=0?'positive':'negative'}">${formatMoney(net)}</div></div>
    <div class="report-card"><div class="card-label">Transactions</div><div class="report-card-val">${txns.filter(t => t.type !== 'transfer').length}</div></div>
  `;

  const sortedDays = Object.keys(byDay).sort().reverse();
  const dailyHtml  = sortedDays.map(day => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-top:1px solid var(--border)">
      <span style="color:var(--text2);font-size:0.875rem">${formatDate(day)}</span>
      <span>
        ${byDay[day].inc > 0 ? `<span style="color:var(--accent);margin-right:12px">+${formatMoney(byDay[day].inc)}</span>` : ''}
        ${byDay[day].exp > 0 ? `<span style="color:var(--danger)">-${formatMoney(byDay[day].exp)}</span>` : ''}
      </span>
    </div>
  `).join('');

  document.getElementById('monthly-breakdown').innerHTML = sortedDays.length
    ? `<div class="card" style="margin-top:16px"><div class="section-title">Daily Breakdown</div>${dailyHtml}</div>`
    : `<div class="empty-state"><p>No transactions for this month.</p></div>`;
}

// ✅ Wire up form listeners on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  document.getElementById('week-ref-date').value = todayISO();
  document.getElementById('year-select').value   = now.getFullYear();

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('month-select').innerHTML = months.map((m, i) =>
    `<option value="${i+1}" ${i+1 === now.getMonth()+1 ? 'selected' : ''}>${m}</option>`
  ).join('');
});

// ✅ Render only after auth is confirmed
window.onAuthReady = async function () {
  await renderWeeklyReport();
  await renderMonthlyReport();
};