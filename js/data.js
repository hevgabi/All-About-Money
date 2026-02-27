// js/data.js — Firestore backend (replaces localStorage)
// All functions are now async. Callers must await them.

// ── Helpers ───────────────────────────────────────────────────
function uid()      { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function now()      { return new Date().toISOString(); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

function _getApi() { return window._fb; }   // set by firebase.js
function _col(name)   { return _getApi().userCol(name); }
function _doc(name, id) { return _getApi().userDoc(name, id); }

async function _getAll(colName) {
  return _getApi().colToArray(colName);
}

// ── Wallets ───────────────────────────────────────────────────
async function getWallets() {
  return _getAll('wallets');
}

async function getWallet(id) {
  const snap = await _getApi().getDoc(_doc('wallets', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function addWallet({ name, balance }) {
  const id = uid();
  const wallet = { name: name.trim(), balance: Number(balance) || 0, createdAt: now() };
  await _getApi().setDoc(_doc('wallets', id), wallet);
  return { id, ...wallet };
}

async function updateWallet(id, { name, balance }) {
  const snap = await _getApi().getDoc(_doc('wallets', id));
  if (!snap.exists()) throw new Error('Wallet not found: ' + id);
  const current = snap.data();
  const parsed = parseFloat(balance);
  const merged = {
    ...current,
    name: name.trim(),
    balance: isNaN(parsed) ? current.balance : parsed
  };
  await _getApi().setDoc(_doc('wallets', id), merged);
}

async function deleteWallet(id) {
  const batch = _getApi().writeBatch(_getApi().db);
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
  await _getApi().updateDoc(_doc('wallets', id), { balance: w.balance + delta });
}

// ── Transactions ──────────────────────────────────────────────
async function getTransactions() {
  return _getAll('transactions');
}

async function addTransaction({ dateISO, walletId, amount, place, type }) {
  amount = Number(amount);
  const id = uid();
  const tx = { dateISO, walletId, amount, place: place.trim(), type, createdAt: now() };

  const batch = _getApi().writeBatch(_getApi().db);
  batch.set(_doc('transactions', id), tx);

  const w = await getWallet(walletId);
  if (w) batch.update(_doc('wallets', walletId), { balance: w.balance + (type === 'income' ? amount : -amount) });

  await batch.commit();
  return { id, ...tx };
}

async function updateTransaction(id, updates) {
  const snap = await _getApi().getDoc(_doc('transactions', id));
  if (!snap.exists()) return null;
  const old = { id, ...snap.data() };

  const batch = _getApi().writeBatch(_getApi().db);

  // Revert old wallet effect
  if (old.type === 'transfer') {
    const oldSrc = await getWallet(old.walletId);
    if (oldSrc) batch.update(_doc('wallets', old.walletId), { balance: oldSrc.balance + old.amount });
    const oldDst = await getWallet(old.toWalletId);
    if (oldDst) batch.update(_doc('wallets', old.toWalletId), { balance: oldDst.balance - old.amount });
  } else {
    const oldW = await getWallet(old.walletId);
    if (oldW) batch.update(_doc('wallets', old.walletId), {
      balance: oldW.balance - (old.type === 'income' ? old.amount : -old.amount)
    });
  }

  const updated = { ...old, ...updates, amount: Number(updates.amount ?? old.amount) };
  delete updated.id;
  batch.update(_doc('transactions', id), updated);

  // Apply new wallet effect
  if (updated.type === 'transfer') {
    const newSrc = await getWallet(updated.walletId);
    if (newSrc) batch.update(_doc('wallets', updated.walletId), { balance: newSrc.balance - updated.amount });
    const newDst = await getWallet(updated.toWalletId);
    if (newDst) batch.update(_doc('wallets', updated.toWalletId), { balance: newDst.balance + updated.amount });
  } else {
    const newW = await getWallet(updated.walletId);
    if (newW) batch.update(_doc('wallets', updated.walletId), {
      balance: newW.balance + (updated.type === 'income' ? updated.amount : -updated.amount)
    });
  }

  await batch.commit();
  return { id, ...updated };
}

async function deleteTransaction(id) {
  const snap = await _getApi().getDoc(_doc('transactions', id));
  if (!snap.exists()) return;
  const tx = snap.data();

  const batch = _getApi().writeBatch(_getApi().db);
  batch.delete(_doc('transactions', id));

  if (tx.type === 'transfer') {
    // Reverse: add back to source, deduct from destination
    const srcW = await getWallet(tx.walletId);
    if (srcW) batch.update(_doc('wallets', tx.walletId), { balance: srcW.balance + tx.amount });
    const dstW = await getWallet(tx.toWalletId);
    if (dstW) batch.update(_doc('wallets', tx.toWalletId), { balance: dstW.balance - tx.amount });
  } else {
    const w = await getWallet(tx.walletId);
    if (w) batch.update(_doc('wallets', tx.walletId), {
      balance: w.balance - (tx.type === 'income' ? tx.amount : -tx.amount)
    });
  }

  await batch.commit();
}

// ── Transfer Between Wallets ──────────────────────────────────
/**
 * addTransferTransaction({ dateISO, fromWalletId, toWalletId, amount, note })
 * - Validates: amount > 0, wallets differ, source has enough balance
 * - Atomically deducts from source, adds to destination
 * - Saves a single transaction record with type='transfer', walletId=fromWalletId, toWalletId
 */
async function addTransferTransaction({ dateISO, fromWalletId, toWalletId, amount, note }) {
  amount = Number(amount);

  if (!fromWalletId || !toWalletId)      return { error: 'Please select both wallets.' };
  if (fromWalletId === toWalletId)       return { error: 'Source and destination wallets must be different.' };
  if (!amount || amount <= 0)            return { error: 'Amount must be greater than 0.' };

  const [srcW, dstW] = await Promise.all([getWallet(fromWalletId), getWallet(toWalletId)]);
  if (!srcW) return { error: 'Source wallet not found.' };
  if (!dstW) return { error: 'Destination wallet not found.' };
  if (srcW.balance < amount)             return { error: `Insufficient balance. ${srcW.name} only has ${srcW.balance.toFixed(2)}.` };

  const id = uid();
  const tx = {
    dateISO,
    walletId: fromWalletId,     // "from" wallet (primary reference)
    toWalletId,                  // "to" wallet
    amount,
    place: note ? note.trim() : `Transfer → ${dstW.name}`,
    type: 'transfer',
    createdAt: now()
  };

  const batch = _getApi().writeBatch(_getApi().db);
  batch.set(_doc('transactions', id), tx);
  batch.update(_doc('wallets', fromWalletId), { balance: srcW.balance - amount });
  batch.update(_doc('wallets', toWalletId),   { balance: dstW.balance + amount });

  await batch.commit();
  return { id, ...tx };
}

// ── Wants ─────────────────────────────────────────────────────
async function getWants() {
  return _getAll('wants');
}

async function addWant({ name, price, priority, notes }) {
  const id = uid();
  const want = { name: name.trim(), price: Number(price), priority: Number(priority), notes: (notes || '').trim(), createdAt: now() };
  await _getApi().setDoc(_doc('wants', id), want);
  return { id, ...want };
}

async function updateWant(id, updates) {
  const snap = await _getApi().getDoc(_doc('wants', id));
  if (!snap.exists()) return null;
  const old = snap.data();
  const merged = {
    ...old, ...updates,
    price:    Number(updates.price    ?? old.price),
    priority: Number(updates.priority ?? old.priority)
  };
  await _getApi().setDoc(_doc('wants', id), merged);
  return { id, ...merged };
}

async function deleteWant(id) {
  await _getApi().deleteDoc(_doc('wants', id));
}

// ── Budgets ───────────────────────────────────────────────────
const DEFAULT_BUDGETS = {
  weekly:  { allowanceAmount: 0, fixedExpenses: [], createdAt: now() },
  monthly: { fixedExpenses: [], createdAt: now() }
};

async function getBudgets() {
  const snap = await _getApi().getDoc(_getApi().budgetDocRef());
  return snap.exists() ? snap.data() : { ...DEFAULT_BUDGETS };
}

async function saveWeeklyBudget(allowanceAmount, fixedExpenses) {
  const budgets = await getBudgets();
  await _getApi().setDoc(_getApi().budgetDocRef(), {
    ...budgets,
    weekly: { allowanceAmount: Number(allowanceAmount), fixedExpenses, createdAt: budgets.weekly?.createdAt || now() }
  });
}

async function saveMonthlyBudget(fixedExpenses) {
  const budgets = await getBudgets();
  await _getApi().setDoc(_getApi().budgetDocRef(), {
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
  await _getApi().setDoc(_doc('goals', id), goal);
  return { id, ...goal };
}

async function contributeToGoal(goalId, amount) {
  const gSnap = await _getApi().getDoc(_doc('goals', goalId));
  if (!gSnap.exists()) return { error: 'Goal not found' };
  const goal = { id: goalId, ...gSnap.data() };

  const wallet = await getWallet(goal.fundingWalletId);
  if (!wallet) return { error: 'Funding wallet not found or deleted' };

  amount = Number(amount);
  if (amount <= 0) return { error: 'Amount must be positive' };
  if (amount > wallet.balance) return { error: 'Insufficient wallet balance' };

  const remaining = goal.targetAmount - goal.savedAmount;
  if (amount > remaining) amount = remaining;

  const batch = _getApi().writeBatch(_getApi().db);
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
  await _getApi().deleteDoc(_doc('goals', id));
}

async function updateGoal(id, updates) {
  const snap = await _getApi().getDoc(_doc('goals', id));
  if (!snap.exists()) return null;
  const merged = { ...snap.data(), ...updates };
  await _getApi().setDoc(_doc('goals', id), merged);
  return { id, ...merged };
}

// ── PayLater / Installments ───────────────────────────────────
async function getInstallments() {
  return _getAll('installments');
}

// PATCH: accepts optional wantId. If no wantId provided, auto-creates a Want entry and links it.
async function addInstallment({ name, monthlyAmount, months, wantId, weeklyStartDate }) {
  const id = uid();
  monthlyAmount = Number(monthlyAmount);
  months = Number(months);
  const total = monthlyAmount * months;
  const weeklySuggested = +(monthlyAmount / 4).toFixed(2);

  // Auto-create a Want if none was linked
  let resolvedWantId = wantId || null;
  if (!resolvedWantId) {
    // Check if a matching Want already exists (by name, not bought yet)
    const existing = await _getAll('wants');
    const match = existing.find(w => !w.boughtAt && w.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (match) {
      resolvedWantId = match.id;
    } else {
      const newWant = await addWant({ name, price: total, priority: 3, notes: 'Auto-created from PayLater' });
      resolvedWantId = newWant.id;
    }
  }

  const item = {
    name: name.trim(), monthlyAmount, months, total, weeklySuggested,
    paidAmount: 0, createdAt: now(),
    wantId: resolvedWantId,   // ← link to Want
    weeklyStartDate: weeklyStartDate || null  // FEATURE: weekly start date
  };
  await _getApi().setDoc(_doc('installments', id), item);
  return { id, ...item };
}

// PATCH: payInstallment — wallet deduction + transaction record already exist in original.
// Keeping as-is; original data.js already does both correctly.
async function payInstallment(instId, amount, walletId) {
  const iSnap = await _getApi().getDoc(_doc('installments', instId));
  if (!iSnap.exists()) return { error: 'Installment not found' };
  const inst = { id: instId, ...iSnap.data() };

  if (inst.paidAmount >= inst.total) return { error: 'Already fully paid' };

  const wallet = await getWallet(walletId);
  if (!wallet) return { error: 'Wallet not found' };

  amount = Number(amount);
  if (amount <= 0) return { error: 'Amount must be positive' };
  if (amount > wallet.balance) return { error: 'Insufficient wallet balance' };

  // Cap to remaining
  const remaining = inst.total - inst.paidAmount;
  if (amount > remaining) amount = remaining;

  const newPaid = inst.paidAmount + amount;
  const completed = newPaid >= inst.total;

  const batch = _getApi().writeBatch(_getApi().db);
  batch.update(_doc('installments', instId), { paidAmount: newPaid });
  // CRITICAL: deduct from wallet
  batch.update(_doc('wallets', walletId), { balance: wallet.balance - amount });

  // CRITICAL: create expense transaction record
  const txId = uid();
  batch.set(_doc('transactions', txId), {
    dateISO: todayISO(), walletId, amount,
    place: `Installment: ${inst.name}`, type: 'expense', createdAt: now()
  });

  await batch.commit();
  return { inst, amount, completed };
}


async function updateInstallmentStartDate(instId, weeklyStartDate) {
  await _getApi().updateDoc(_doc('installments', instId), { weeklyStartDate: weeklyStartDate || null });
}

async function deleteInstallment(id) {
  await _getApi().deleteDoc(_doc('installments', id));
}