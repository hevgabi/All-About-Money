// js/firebase.js — Firebase init + Auth + Firestore setup

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch }
  from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDDQ5PtlG8ndo57xzxeNjYMejy-YhQAEJ0",
  authDomain: "all-about-money-5c23c.firebaseapp.com",
  projectId: "all-about-money-5c23c",
  storageBucket: "all-about-money-5c23c.firebasestorage.app",
  messagingSenderId: "317472857929",
  appId: "1:317472857929:web:a7d0b1e86a3a567dab0498",
  measurementId: "G-59DKQHNZNW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ── Auth helpers ─────────────────────────────────────────────
window.fbLoginWithGoogle = () => signInWithPopup(auth, googleProvider);
window.fbLogout          = () => signOut(auth);
window.fbOnAuthChanged   = (cb) => onAuthStateChanged(auth, cb);

// ── Firestore path helpers (per-user) ────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ✅ Use window._currentUserId (set by auth.js) as primary, auth.currentUser as fallback
function getCurrentUserId() {
  const userId = window._currentUserId || auth.currentUser?.uid;
  if (!userId) throw new Error('Not logged in — no user ID available');
  return userId;
}

function userCol(colName) {
  return collection(db, 'users', getCurrentUserId(), colName);
}
function userDoc(colName, id) {
  return doc(db, 'users', getCurrentUserId(), colName, id);
}
function budgetDocRef() {
  return doc(db, 'users', getCurrentUserId(), 'meta', 'budgets');
}
async function colToArray(colName) {
  const snap = await getDocs(userCol(colName));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Expose Firestore ops globally so data.js can call them ───
window._fb = {
  uid, userCol, userDoc, budgetDocRef, colToArray,
  getDoc, setDoc, updateDoc, deleteDoc, writeBatch, db,
  auth
};

console.log('[firebase.js] loaded ✅');