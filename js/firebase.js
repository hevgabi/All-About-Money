// js/firebase.js — Firebase initialization

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

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
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export function loginWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function logout() {
  return signOut(auth);
}

export function onAuthChanged(callback) {
  return onAuthStateChanged(auth, callback);
}
