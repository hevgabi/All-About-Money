// js/goals.js — Firebase version
import { requireAuth } from './auth-guard.js';
import { getGoals, getWallets, getWallet, addGoal, contributeToGoal, deleteGoal } from './data.js';
import { formatMoney, escapeHtml } from './utils.js';
import { showToast, showConfirm, openModal, closeModal, setupModalClose } from './ui.js';

let cachedGoals = [];

async function renderGoals() {
  const [goals, wallets] = await Promise.all([getGoals(), getWallets()]);
  cachedGoals = goals;
  const walletMap = Object.fromEntries(wallets.map(w => [w.id, w]));
  const container = document.getElementById('goals-list');

  const walletSel = document.getElementById('goal-wallet');
  walletSel.innerHTML = wallets.length
    ? wallets.map(w => `<option value="${w.id}">${escapeHtml(w.name)} (${formatMoney(w.balance)})</option>`).join('')
    : '<option value="">No wallets available</option>';

  if (goals.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg><p>No goals yet. Create your first savings goal!</p></div>`;
    return;
  }

  const iconDel = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>`;

  container.innerHTML = goals.map(g => {
    const pct = g.targetAmount > 0 ? Math.min(100, (g.savedAmount / g.targetAmount) * 100) : 0;
    const remaining = Math.max(0, g.targetAmount - g.savedAmount);
    const wallet = walletMap[g.fundingWalletId];
    const done = pct >= 100;

    return `
      <div class="goal-card">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:4px">
          <div class="goal-name">${escapeHtml(g.name)}</div>
          <span class="goal-pct">${pct.toFixed(0)}%</span>
        </div>
        <div style="font-size:0.8rem;color:var(--text2);margin-bottom:12px">
          ${wallet ? `Wallet: ${escapeHtml(wallet.name)}` : '<span style="color:var(--danger)">Wallet not found</span>'}
        </div>
        <div class="progress-wrap">
          <div class="progress-bar" style="width:${pct}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin:10px 0 16px;font-size:0.8rem">
          <span style="color:var(--accent)">Saved: ${formatMoney(g.savedAmount)}</span>
          <span style="color:var(--text2)">Target: ${formatMoney(g.targetAmount)}</span>
        </div>
        ${done
          ? `<div style="text-align:center;color:var(--accent);font-weight:700;padding:8px;background:#00F5C415;border-radius:8px;margin-bottom:12px;">🎉 Goal Reached!</div>`
          : `<div style="font-size:0.8rem;color:var(--text3);margin-bottom:12px">Remaining: <span style="color:var(--text);font-weight:600">${formatMoney(remaining)}</span></div>`
        }
        <div style="display:flex;gap:8px">
          ${!done && wallet ? `<button class="btn btn-primary btn-sm contribute-btn" data-id="${g.id}" style="flex:1">+ Add Savings</button>` : ''}
          <button class="btn btn-icon btn-sm delete-goal-btn" data-id="${g.id}" data-name="${escapeHtml(g.name)}" style="color:var(--danger)">${iconDel}</button>
        </div>
      </div>
    `;
  }).join('');
}

requireAuth(async () => {
  await renderGoals();
  setupModalClose('contribute-modal');

  document.getElementById('add-goal-form').addEventListener('submit', async e => {
    e.preventDefault();
    const nameEl = document.getElementById('goal-name');
    const targetEl = document.getElementById('goal-target');
    const walletId = document.getElementById('goal-wallet').value;

    let valid = true;
    if (!nameEl.value.trim()) { nameEl.classList.add('error'); nameEl.addEventListener('input', () => nameEl.classList.remove('error'), {once:true}); valid = false; }
    if (!targetEl.value || parseFloat(targetEl.value) <= 0) { targetEl.classList.add('error'); targetEl.addEventListener('input', () => targetEl.classList.remove('error'), {once:true}); valid = false; }
    if (!walletId) { showToast('Select a funding wallet', 'error'); valid = false; }
    if (!valid) return;

    await addGoal({ name: nameEl.value, targetAmount: parseFloat(targetEl.value), fundingWalletId: walletId });
    showToast('Goal created!', 'success');
    e.target.reset();
    await renderGoals();
  });

  document.getElementById('goals-list').addEventListener('click', async e => {
    const contBtn = e.target.closest('.contribute-btn');
    const delBtn = e.target.closest('.delete-goal-btn');

    if (contBtn) {
      const goal = cachedGoals.find(g => g.id === contBtn.dataset.id);
      if (!goal) return;
      const wallet = await getWallet(goal.fundingWalletId);
      document.getElementById('contribute-goal-id').value = goal.id;
      document.getElementById('contribute-amount').value = '';
      document.getElementById('contribute-goal-info').innerHTML = `
        <div style="font-weight:700;margin-bottom:6px">${escapeHtml(goal.name)}</div>
        <div style="font-size:0.8rem;color:var(--text2)">Target: ${formatMoney(goal.targetAmount)} &bull; Saved: ${formatMoney(goal.savedAmount)} &bull; Remaining: ${formatMoney(goal.targetAmount - goal.savedAmount)}</div>
      `;
      document.getElementById('contribute-wallet-info').textContent = wallet
        ? `Wallet balance: ${formatMoney(wallet.balance)}`
        : 'Wallet not found';
      openModal('contribute-modal');
      setTimeout(() => document.getElementById('contribute-amount').focus(), 100);
    }

    if (delBtn) {
      const ok = await showConfirm(`Delete goal "${delBtn.dataset.name}"? Saved amounts are NOT refunded to the wallet.`, 'Delete Goal');
      if (!ok) return;
      await deleteGoal(delBtn.dataset.id);
      showToast('Goal deleted', 'success');
      await renderGoals();
    }
  });

  document.getElementById('contribute-form').addEventListener('submit', async e => {
    e.preventDefault();
    const goalId = document.getElementById('contribute-goal-id').value;
    const amount = parseFloat(document.getElementById('contribute-amount').value);
    if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }

    const result = await contributeToGoal(goalId, amount);
    if (result.error) { showToast(result.error, 'error'); return; }

    const capped = result.amount < amount;
    showToast(capped ? `Saved ${formatMoney(result.amount)} (capped to remaining target)` : `Saved ${formatMoney(result.amount)}!`, 'success');
    closeModal('contribute-modal');
    await renderGoals();
  });
});
