// js/budget.js — Firebase version
import { requireAuth } from './auth-guard.js';
import { getBudgets, saveWeeklyBudget, saveMonthlyBudget } from './data.js';
import { formatMoney, escapeHtml } from './utils.js';
import { showToast } from './ui.js';

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function switchBudgetTab(tab) {
  document.getElementById('tab-weekly').classList.toggle('active', tab === 'weekly');
  document.getElementById('tab-monthly').classList.toggle('active', tab === 'monthly');
  document.getElementById('weekly-budget').style.display = tab === 'weekly' ? '' : 'none';
  document.getElementById('monthly-budget').style.display = tab === 'monthly' ? '' : 'none';
}
window.switchBudgetTab = switchBudgetTab;

function renderExpensesList(expenses, containerId, type) {
  const container = document.getElementById(containerId);
  if (expenses.length === 0) {
    container.innerHTML = `<div style="color:var(--text3);font-size:0.875rem;text-align:center;padding:16px;">No fixed expenses added yet.</div>`;
    return;
  }
  const iconDel = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>`;
  container.innerHTML = expenses.map(ex => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-top:1px solid var(--border)">
      <span>${escapeHtml(ex.name)}</span>
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-family:'Syne',sans-serif;font-weight:700;color:var(--danger)">${formatMoney(ex.amount)}</span>
        <button class="btn btn-icon btn-sm delete-budget-exp" data-id="${ex.id}" data-type="${type}" style="color:var(--danger)">${iconDel}</button>
      </div>
    </div>
  `).join('');
}

async function renderWeeklySummary() {
  const budgets = await getBudgets();
  const allowance = budgets.weekly.allowanceAmount || 0;
  const exps = budgets.weekly.fixedExpenses || [];
  const totalFixed = exps.reduce((s, e) => s + e.amount, 0);
  const remaining = allowance - totalFixed;

  document.getElementById('weekly-allowance').value = allowance || '';
  document.getElementById('weekly-summary').innerHTML = `
    <div class="budget-sum-item">
      <div class="budget-sum-label">Allowance</div>
      <div class="budget-sum-value" style="color:var(--accent)">${formatMoney(allowance)}</div>
    </div>
    <div class="budget-sum-item">
      <div class="budget-sum-label">Fixed Expenses</div>
      <div class="budget-sum-value" style="color:var(--danger)">${formatMoney(totalFixed)}</div>
    </div>
    <div class="budget-sum-item">
      <div class="budget-sum-label">Savings / Extra</div>
      <div class="budget-sum-value" style="color:${remaining >= 0 ? 'var(--accent)' : 'var(--danger)'}">${formatMoney(remaining)}</div>
    </div>
  `;
  renderExpensesList(exps, 'weekly-expenses-list', 'weekly');
}

async function renderMonthlySummary() {
  const budgets = await getBudgets();
  const exps = budgets.monthly.fixedExpenses || [];
  const totalFixed = exps.reduce((s, e) => s + e.amount, 0);

  document.getElementById('monthly-summary').innerHTML = `
    <div class="budget-sum-item">
      <div class="budget-sum-label">Monthly Fixed</div>
      <div class="budget-sum-value" style="color:var(--danger)">${formatMoney(totalFixed)}</div>
    </div>
    <div class="budget-sum-item">
      <div class="budget-sum-label">Items</div>
      <div class="budget-sum-value">${exps.length}</div>
    </div>
    <div class="budget-sum-item">
      <div class="budget-sum-label">Avg / Week</div>
      <div class="budget-sum-value" style="color:var(--text2)">${formatMoney(totalFixed / 4)}</div>
    </div>
  `;
  renderExpensesList(exps, 'monthly-expenses-list', 'monthly');
}

async function saveWeeklyAllowance() {
  const val = parseFloat(document.getElementById('weekly-allowance').value) || 0;
  const budgets = await getBudgets();
  await saveWeeklyBudget(val, budgets.weekly.fixedExpenses || []);
  showToast('Allowance saved!', 'success');
  await renderWeeklySummary();
}
window.saveWeeklyAllowance = saveWeeklyAllowance;

requireAuth(async () => {
  await renderWeeklySummary();
  await renderMonthlySummary();

  async function handleBudgetDelete(e) {
    const btn = e.target.closest('.delete-budget-exp');
    if (!btn) return;
    const type = btn.dataset.type;
    const id = btn.dataset.id;
    const budgets = await getBudgets();

    if (type === 'weekly') {
      const exps = (budgets.weekly.fixedExpenses || []).filter(ex => ex.id !== id);
      await saveWeeklyBudget(budgets.weekly.allowanceAmount, exps);
      showToast('Expense removed', 'success');
      await renderWeeklySummary();
    } else {
      const exps = (budgets.monthly.fixedExpenses || []).filter(ex => ex.id !== id);
      await saveMonthlyBudget(exps);
      showToast('Expense removed', 'success');
      await renderMonthlySummary();
    }
  }

  document.getElementById('weekly-expenses-list').addEventListener('click', handleBudgetDelete);
  document.getElementById('monthly-expenses-list').addEventListener('click', handleBudgetDelete);

  document.getElementById('add-weekly-expense-form').addEventListener('submit', async e => {
    e.preventDefault();
    const nameEl = document.getElementById('weekly-exp-name');
    const amtEl = document.getElementById('weekly-exp-amount');
    if (!nameEl.value.trim()) { nameEl.classList.add('error'); nameEl.addEventListener('input', () => nameEl.classList.remove('error'), {once:true}); return; }
    const amount = parseFloat(amtEl.value) || 0;
    const budgets = await getBudgets();
    const exps = [...(budgets.weekly.fixedExpenses || []), { id: uid(), name: nameEl.value.trim(), amount }];
    await saveWeeklyBudget(budgets.weekly.allowanceAmount, exps);
    showToast('Expense added!', 'success');
    e.target.reset();
    await renderWeeklySummary();
  });

  document.getElementById('add-monthly-expense-form').addEventListener('submit', async e => {
    e.preventDefault();
    const nameEl = document.getElementById('monthly-exp-name');
    const amtEl = document.getElementById('monthly-exp-amount');
    if (!nameEl.value.trim()) { nameEl.classList.add('error'); nameEl.addEventListener('input', () => nameEl.classList.remove('error'), {once:true}); return; }
    const amount = parseFloat(amtEl.value) || 0;
    const budgets = await getBudgets();
    const exps = [...(budgets.monthly.fixedExpenses || []), { id: uid(), name: nameEl.value.trim(), amount }];
    await saveMonthlyBudget(exps);
    showToast('Expense added!', 'success');
    e.target.reset();
    await renderMonthlySummary();
  });
});
