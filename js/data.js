// js/data.js — Firestore backend (replaces localStorage version)

import { db, auth } from './firebase.js';
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, writeBatch, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// ── Helpers ───────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function now() { return new Date().toISOString(); }
export function todayISO() { return new Date().toISOString().slice(0, 10); }

function userCol(colName) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not logged in');
  return collection(db, 'users', uid, colName);
}

function userDoc(colName, id) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not logged in');
  return doc(db, 'users', uid, colName, id);
}

function budgetDoc() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not logged in');
  return doc(db, 'users', uid, 'meta', 'budgets');
}

async function colToArray(colName) {
  const snap = await getDocs(userCol(colName));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Wallets ───────────────────────────────────────────────────
export async function getWallets() {
  return colToArray('wallets');
}

export async function getWallet(id) {
  const snap = await getDoc(userDoc('wallets', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function addWallet({ name, balance }) {
  const id = uid();
  const wallet = { name: name.trim(), balance: Number(balance) || 0, createdAt: now() };
  await setDoc(userDoc('wallets', id), wallet);
  return { id, ...wallet };
}

export async function updateWallet(id, { name }) {
  const ref = userDoc('wallets', id);
  await updateDoc(ref, { name: name.trim() });
  return { id, name };
}

export async function deleteWallet(id) {
  const batch = writeBatch(db);

  // Delete wallet
  batch.delete(userDoc('wallets', id));

  // Delete related transactions
  const txns = await colToArray('transactions');
  txns.filter(t => t.walletId === id)
    .forEach(t => batch.delete(userDoc('transactions', t.id)));

  // Nullify goals using this wallet
  const goals = await colToArray('goals');
  goals.filter(g => g.fundingWalletId === id)
    .forEach(g => batch.update(userDoc('goals', g.id), { fundingWalletId: null }));

  await batch.commit();
}

export async function adjustWalletBalance(id, delta) {
  const wallet = await getWallet(id);
  if (!wallet) return;
  await updateDoc(userDoc('wallets', id), { balance: wallet.balance + delta });
}

// ── Transactions ──────────────────────────────────────────────
export async function getTransactions() {
  return colToArray('transactions');
}

export async function addTransaction({ dateISO, walletId, amount, place, type }) {
  const id = uid();
  amount = Number(amount);
  const tx = { dateISO, walletId, amount, place: place.trim(), type, createdAt: now() };

  const batch = writeBatch(db);
  batch.set(userDoc('transactions', id), tx);

  // Update wallet balance
  const wallet = await getWallet(walletId);
  if (wallet) {
    const newBal = wallet.balance + (type === 'income' ? amount : -amount);
    batch.update(userDoc('wallets', walletId), { balance: newBal });
  }

  await batch.commit();
  return { id, ...tx };
}

export async function updateTransaction(id, updates) {
  const old = { id, ...(await getDoc(userDoc('transactions', id))).data() };
  const batch = writeBatch(db);

  // Revert old effect on wallet
  const oldWallet = await getWallet(old.walletId);
  if (oldWallet) {
    const reverted = oldWallet.balance - (old.type === 'income' ? old.amount : -old.amount);
    batch.update(userDoc('wallets', old.walletId), { balance: reverted });
  }

  // Apply new
  const updated = { ...old, ...updates, amount: Number(updates.amount ?? old.amount) };
  delete updated.id;
  batch.update(userDoc('transactions', id), updated);

  // Apply new effect on wallet
  const newWallet = await getWallet(updated.walletId);
  if (newWallet) {
    const newBal = newWallet.balance + (updated.type === 'income' ? updated.amount : -updated.amount);
    batch.update(userDoc('wallets', updated.walletId), { balance: newBal });
  }

  await batch.commit();
  return { id, ...updated };
}

export async function deleteTransaction(id) {
  const snap = await getDoc(userDoc('transactions', id));
  if (!snap.exists()) return;
  const tx = snap.data();

  const batch = writeBatch(db);
  batch.delete(userDoc('transactions', id));

  const wallet = await getWallet(tx.walletId);
  if (wallet) {
    const newBal = wallet.balance - (tx.type === 'income' ? tx.amount : -tx.amount);
    batch.update(userDoc('wallets', tx.walletId), { balance: newBal });
  }

  await batch.commit();
}

// ── Wants ─────────────────────────────────────────────────────
export async function getWants() {
  return colToArray('wants');
}

export async function addWant({ name, price, priority, notes }) {
  const id = uid();
  const want = { name: name.trim(), price: Number(price), priority: Number(priority), notes: (notes || '').trim(), createdAt: now() };
  await setDoc(userDoc('wants', id), want);
  return { id, ...want };
}

export async function updateWant(id, updates) {
  const ref = userDoc('wants', id);
  const cleaned = {
    ...updates,
    price: Number(updates.price),
    priority: Number(updates.priority)
  };
  await updateDoc(ref, cleaned);
  return { id, ...cleaned };
}

export async function deleteWant(id) {
  await deleteDoc(userDoc('wants', id));
}

// ── Budgets ───────────────────────────────────────────────────
const DEFAULT_BUDGETS = {
  weekly: { allowanceAmount: 0, fixedExpenses: [], createdAt: now() },
  monthly: { fixedExpenses: [], createdAt: now() }
};

export async function getBudgets() {
  const snap = await getDoc(budgetDoc());
  return snap.exists() ? snap.data() : DEFAULT_BUDGETS;
}

export async function saveWeeklyBudget(allowanceAmount, fixedExpenses) {
  const budgets = await getBudgets();
  await setDoc(budgetDoc(), {
    ...budgets,
    weekly: { allowanceAmount: Number(allowanceAmount), fixedExpenses, createdAt: budgets.weekly?.createdAt || now() }
  });
}

export async function saveMonthlyBudget(fixedExpenses) {
  const budgets = await getBudgets();
  await setDoc(budgetDoc(), {
    ...budgets,
    monthly: { fixedExpenses, createdAt: budgets.monthly?.createdAt || now() }
  });
}

// ── Goals ─────────────────────────────────────────────────────
export async function getGoals() {
  return colToArray('goals');
}

export async function addGoal({ name, targetAmount, fundingWalletId }) {
  const id = uid();
  const goal = { name: name.trim(), targetAmount: Number(targetAmount), fundingWalletId, savedAmount: 0, createdAt: now() };
  await setDoc(userDoc('goals', id), goal);
  return { id, ...goal };
}

export async function contributeToGoal(goalId, amount) {
  const goalSnap = await getDoc(userDoc('goals', goalId));
  if (!goalSnap.exists()) return { error: 'Goal not found' };
  const goal = { id: goalId, ...goalSnap.data() };

  const wallet = await getWallet(goal.fundingWalletId);
  if (!wallet) return { error: 'Funding wallet not found or deleted' };

  amount = Number(amount);
  if (amount <= 0) return { error: 'Amount must be positive' };
  if (amount > wallet.balance) return { error: 'Insufficient wallet balance' };

  const remaining = goal.targetAmount - goal.savedAmount;
  if (amount > remaining) amount = remaining;

  const batch = writeBatch(db);
  batch.update(userDoc('goals', goalId), { savedAmount: goal.savedAmount + amount });
  batch.update(userDoc('wallets', wallet.id), { balance: wallet.balance - amount });

  // Log as transaction
  const txId = uid();
  batch.set(userDoc('transactions', txId), {
    dateISO: todayISO(), walletId: wallet.id, amount,
    place: `Goal: ${goal.name}`, type: 'expense', createdAt: now()
  });

  await batch.commit();
  return { goal, amount };
}

export async function deleteGoal(id) {
  await deleteDoc(userDoc('goals', id));
}

export async function updateGoal(id, updates) {
  await updateDoc(userDoc('goals', id), updates);
  return { id, ...updates };
}
