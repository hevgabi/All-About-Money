// js/data.js — Single source of truth via localStorage

const STORAGE_KEY = 'moneyTrackerData';

const DEFAULT_DATA = {
  wallets: [],
  transactions: [],
  wants: [],
  budgets: {
    weekly: { allowanceAmount: 0, fixedExpenses: [], createdAt: new Date().toISOString() },
    monthly: { fixedExpenses: [], createdAt: new Date().toISOString() }
  },
  goals: []
};

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_DATA);
    const parsed = JSON.parse(raw);
    // Merge defaults for missing keys
    return {
      wallets: parsed.wallets || [],
      transactions: parsed.transactions || [],
      wants: parsed.wants || [],
      budgets: {
        weekly: parsed.budgets?.weekly || structuredClone(DEFAULT_DATA.budgets.weekly),
        monthly: parsed.budgets?.monthly || structuredClone(DEFAULT_DATA.budgets.monthly)
      },
      goals: parsed.goals || []
    };
  } catch { return structuredClone(DEFAULT_DATA); }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Wallets ──────────────────────────────────────────────────
function getWallets() { return loadData().wallets; }
function getWallet(id) { return getWallets().find(w => w.id === id) || null; }

function addWallet({ name, balance }) {
  const data = loadData();
  const wallet = { id: uid(), name: name.trim(), balance: Number(balance) || 0, createdAt: now() };
  data.wallets.push(wallet);
  saveData(data);
  return wallet;
}

function updateWallet(id, { name }) {
  const data = loadData();
  const w = data.wallets.find(w => w.id === id);
  if (!w) return null;
  if (name !== undefined) w.name = name.trim();
  saveData(data);
  return w;
}

function deleteWallet(id) {
  const data = loadData();
  data.wallets = data.wallets.filter(w => w.id !== id);
  // Orphan cleanup - remove related transactions
  data.transactions = data.transactions.filter(t => t.walletId !== id);
  // Nullify goals using this wallet
  data.goals = data.goals.map(g => g.fundingWalletId === id ? { ...g, fundingWalletId: null } : g);
  saveData(data);
}

function adjustWalletBalance(id, delta) {
  const data = loadData();
  const w = data.wallets.find(w => w.id === id);
  if (!w) return;
  w.balance += delta;
  saveData(data);
}

// ── Transactions ─────────────────────────────────────────────
function getTransactions() { return loadData().transactions; }

function addTransaction({ dateISO, walletId, amount, place, type }) {
  const data = loadData();
  const tx = { id: uid(), dateISO, walletId, amount: Number(amount), place: place.trim(), type, createdAt: now() };
  data.transactions.push(tx);
  // Update wallet balance
  const w = data.wallets.find(w => w.id === walletId);
  if (w) w.balance += type === 'income' ? tx.amount : -tx.amount;
  saveData(data);
  return tx;
}

function updateTransaction(id, updates) {
  const data = loadData();
  const idx = data.transactions.findIndex(t => t.id === id);
  if (idx === -1) return null;
  const old = data.transactions[idx];

  // Revert old effect
  const oldWallet = data.wallets.find(w => w.id === old.walletId);
  if (oldWallet) oldWallet.balance -= old.type === 'income' ? old.amount : -old.amount;

  // Apply new
  const updated = { ...old, ...updates, amount: Number(updates.amount ?? old.amount), id };
  data.transactions[idx] = updated;
  const newWallet = data.wallets.find(w => w.id === updated.walletId);
  if (newWallet) newWallet.balance += updated.type === 'income' ? updated.amount : -updated.amount;

  saveData(data);
  return updated;
}

function deleteTransaction(id) {
  const data = loadData();
  const tx = data.transactions.find(t => t.id === id);
  if (!tx) return;
  // Revert wallet
  const w = data.wallets.find(w => w.id === tx.walletId);
  if (w) w.balance -= tx.type === 'income' ? tx.amount : -tx.amount;
  data.transactions = data.transactions.filter(t => t.id !== id);
  saveData(data);
}

// ── Wants ────────────────────────────────────────────────────
function getWants() { return loadData().wants; }

function addWant({ name, price, priority, notes }) {
  const data = loadData();
  const want = { id: uid(), name: name.trim(), price: Number(price), priority: Number(priority), notes: (notes || '').trim(), createdAt: now() };
  data.wants.push(want);
  saveData(data);
  return want;
}

function updateWant(id, updates) {
  const data = loadData();
  const idx = data.wants.findIndex(w => w.id === id);
  if (idx === -1) return null;
  data.wants[idx] = { ...data.wants[idx], ...updates, price: Number(updates.price ?? data.wants[idx].price), priority: Number(updates.priority ?? data.wants[idx].priority) };
  saveData(data);
  return data.wants[idx];
}

function deleteWant(id) {
  const data = loadData();
  data.wants = data.wants.filter(w => w.id !== id);
  saveData(data);
}

// ── Budgets ──────────────────────────────────────────────────
function getBudgets() { return loadData().budgets; }

function saveWeeklyBudget(allowanceAmount, fixedExpenses) {
  const data = loadData();
  data.budgets.weekly = { allowanceAmount: Number(allowanceAmount), fixedExpenses, createdAt: data.budgets.weekly.createdAt };
  saveData(data);
}

function saveMonthlyBudget(fixedExpenses) {
  const data = loadData();
  data.budgets.monthly = { fixedExpenses, createdAt: data.budgets.monthly.createdAt };
  saveData(data);
}

// ── Goals ────────────────────────────────────────────────────
function getGoals() { return loadData().goals; }

function addGoal({ name, targetAmount, fundingWalletId }) {
  const data = loadData();
  const goal = { id: uid(), name: name.trim(), targetAmount: Number(targetAmount), fundingWalletId, savedAmount: 0, createdAt: now() };
  data.goals.push(goal);
  saveData(data);
  return goal;
}

function contributeToGoal(goalId, amount) {
  const data = loadData();
  const goal = data.goals.find(g => g.id === goalId);
  if (!goal) return { error: 'Goal not found' };

  const wallet = data.wallets.find(w => w.id === goal.fundingWalletId);
  if (!wallet) return { error: 'Funding wallet not found or deleted' };

  amount = Number(amount);
  if (amount <= 0) return { error: 'Amount must be positive' };
  if (amount > wallet.balance) return { error: 'Insufficient wallet balance' };

  const remaining = goal.targetAmount - goal.savedAmount;
  if (amount > remaining) amount = remaining; // cap to remaining

  goal.savedAmount += amount;
  wallet.balance -= amount;

  // Log as transaction
  const tx = { id: uid(), dateISO: todayISO(), walletId: wallet.id, amount, place: `Goal: ${goal.name}`, type: 'expense', createdAt: now() };
  data.transactions.push(tx);

  saveData(data);
  return { goal, amount };
}

function deleteGoal(id) {
  const data = loadData();
  data.goals = data.goals.filter(g => g.id !== id);
  saveData(data);
}

function updateGoal(id, updates) {
  const data = loadData();
  const idx = data.goals.findIndex(g => g.id === id);
  if (idx === -1) return null;
  data.goals[idx] = { ...data.goals[idx], ...updates };
  saveData(data);
  return data.goals[idx];
}

// ── Helpers ──────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function now() { return new Date().toISOString(); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
