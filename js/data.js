// js/data.js — Firestore backend (replaces localStorage)
// All functions are now async. Callers must await them.

// ── Helpers ───────────────────────────────────────────────────
function uid()      { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function now()      { return new Date().toISOString(); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

function _fb()  { return window._fb; }   // set by firebase.js
function _col(name)   { return _fb().userCol(name); }
function _doc(name, id) { return _fb().userDoc(name, id); }

async function _getAll(colName) {
  return _fb().colToArray(colName);
}

// ── Wallets ───────────────────────────────────────────────────
async function getWallets() {
  return _getAll('wallets');
}

async function getWallet(id) {
  const snap = await _fb().getDoc(_doc('wallets', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function addWallet({ name, balance }) {
  const id = uid();
  const wallet = { name: name.trim(), balance: Number(balance) || 0, createdAt: now() };
  await _fb().setDoc(_doc('wallets', id), wallet);
  return { id, ...wallet };
}

async function updateWallet(id, { name }) {
  await _fb().updateDoc(_doc('wallets', id), { name: name.trim() });
}

async function deleteWallet(id) {
  const batch = _fb().writeBatch(_fb().db);
  batch.delete(_doc('wallets', id));

  // Remove related transactions
  const txns = await _getAll('transactions');
  txns.filter(t => t.walletId === id)
      .forEach(t => batch.delete(_doc('transactions', t.id)));

  // Nullify goals using this wallet
  const goals = await _getAll('goals');
  goals.filter(g => g.fundingWalletId === id)
       .forEach(g => batch.update(_doc('goals', g.id), { fundingWalletId: null }));

  await batch.commit();
}

async function adjustWalletBalance(id, delta) {
  const w = await getWallet(id);
  if (!w) return;
  await _fb().updateDoc(_doc('wallets', id), { balance: w.balance + delta });
}

// ── Transactions ──────────────────────────────────────────────
async function getTransactions() {
  return _getAll('transactions');
}

async function addTransaction({ dateISO, walletId, amount, place, type }) {
  amount = Number(amount);
  const id = uid();
  const tx = { dateISO, walletId, amount, place: place.trim(), type, createdAt: now() };

  const batch = _fb().writeBatch(_fb().db);
  batch.set(_doc('transactions', id), tx);

  const w = await getWallet(walletId);
  if (w) batch.update(_doc('wallets', walletId), { balance: w.balance + (type === 'income' ? amount : -amount) });

  await batch.commit();
  return { id, ...tx };
}

async function updateTransaction(id, updates) {
  const snap = await _fb().getDoc(_doc('transactions', id));
  if (!snap.exists()) return null;
  const old = { id, ...snap.data() };

  const batch = _fb().writeBatch(_fb().db);

  // Revert old wallet effect
  const oldW = await getWallet(old.walletId);
  if (oldW) batch.update(_doc('wallets', old.walletId), {
    balance: oldW.balance - (old.type === 'income' ? old.amount : -old.amount)
  });

  const updated = { ...old, ...updates, amount: Number(updates.amount ?? old.amount) };
  delete updated.id;
  batch.update(_doc('transactions', id), updated);

  // Apply new wallet effect
  const newW = await getWallet(updated.walletId);
  if (newW) batch.update(_doc('wallets', updated.walletId), {
    balance: newW.balance + (updated.type === 'income' ? updated.amount : -updated.amount)
  });

  await batch.commit();
  return { id, ...updated };
}

async function deleteTransaction(id) {
  const snap = await _fb().getDoc(_doc('transactions', id));
  if (!snap.exists()) return;
  const tx = snap.data();

  const batch = _fb().writeBatch(_fb().db);
  batch.delete(_doc('transactions', id));

  const w = await getWallet(tx.walletId);
  if (w) batch.update(_doc('wallets', tx.walletId), {
    balance: w.balance - (tx.type === 'income' ? tx.amount : -tx.amount)
  });

  await batch.commit();
}

// ── Wants ─────────────────────────────────────────────────────
async function getWants() {
  return _getAll('wants');
}

async function addWant({ name, price, priority, notes }) {
  const id = uid();
  const want = { name: name.trim(), price: Number(price), priority: Number(priority), notes: (notes || '').trim(), createdAt: now() };
  await _fb().setDoc(_doc('wants', id), want);
  return { id, ...want };
}

async function updateWant(id, updates) {
  const snap = await _fb().getDoc(_doc('wants', id));
  if (!snap.exists()) return null;
  const old = snap.data();
  const merged = {
    ...old, ...updates,
    price:    Number(updates.price    ?? old.price),
    priority: Number(updates.priority ?? old.priority)
  };
  await _fb().setDoc(_doc('wants', id), merged);
  return { id, ...merged };
}

async function deleteWant(id) {
  await _fb().deleteDoc(_doc('wants', id));
}

// ── Budgets ───────────────────────────────────────────────────
const DEFAULT_BUDGETS = {
  weekly:  { allowanceAmount: 0, fixedExpenses: [], createdAt: now() },
  monthly: { fixedExpenses: [], createdAt: now() }
};

async function getBudgets() {
  const snap = await _fb().getDoc(_fb().budgetDocRef());
  return snap.exists() ? snap.data() : { ...DEFAULT_BUDGETS };
}

async function saveWeeklyBudget(allowanceAmount, fixedExpenses) {
  const budgets = await getBudgets();
  await _fb().setDoc(_fb().budgetDocRef(), {
    ...budgets,
    weekly: { allowanceAmount: Number(allowanceAmount), fixedExpenses, createdAt: budgets.weekly?.createdAt || now() }
  });
}

async function saveMonthlyBudget(fixedExpenses) {
  const budgets = await getBudgets();
  await _fb().setDoc(_fb().budgetDocRef(), {
    ...budgets,
    monthly: { fixedExpenses, createdAt: budgets.monthly?.createdAt || now() }
  });
}

// ── Goals ─────────────────────────────────────────────────────
async function getGoals() {
  return _getAll('goals');
}

async function addGoal({ name, targetAmount, fundingWalletId }) {
  const id = uid();
  const goal = { name: name.trim(), targetAmount: Number(targetAmount), fundingWalletId, savedAmount: 0, createdAt: now() };
  await _fb().setDoc(_doc('goals', id), goal);
  return { id, ...goal };
}

async function contributeToGoal(goalId, amount) {
  const gSnap = await _fb().getDoc(_doc('goals', goalId));
  if (!gSnap.exists()) return { error: 'Goal not found' };
  const goal = { id: goalId, ...gSnap.data() };

  const wallet = await getWallet(goal.fundingWalletId);
  if (!wallet) return { error: 'Funding wallet not found or deleted' };

  amount = Number(amount);
  if (amount <= 0) return { error: 'Amount must be positive' };
  if (amount > wallet.balance) return { error: 'Insufficient wallet balance' };

  const remaining = goal.targetAmount - goal.savedAmount;
  if (amount > remaining) amount = remaining;

  const batch = _fb().writeBatch(_fb().db);
  batch.update(_doc('goals', goalId), { savedAmount: goal.savedAmount + amount });
  batch.update(_doc('wallets', wallet.id), { balance: wallet.balance - amount });

  const txId = uid();
  batch.set(_doc('transactions', txId), {
    dateISO: todayISO(), walletId: wallet.id, amount,
    place: `Goal: ${goal.name}`, type: 'expense', createdAt: now()
  });

  await batch.commit();
  return { goal, amount };
}

async function deleteGoal(id) {
  await _fb().deleteDoc(_doc('goals', id));
}

async function updateGoal(id, updates) {
  const snap = await _fb().getDoc(_doc('goals', id));
  if (!snap.exists()) return null;
  const merged = { ...snap.data(), ...updates };
  await _fb().setDoc(_doc('goals', id), merged);
  return { id, ...merged };
}