// Public Firebase web-app configuration — not a service-account secret.
// Data access is enforced through Firebase Authentication and Firestore Security Rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyBouP8Rvr6gtLeU4Aig74tReZyskD2WFyg",
  authDomain: "ems-taste.firebaseapp.com",
  projectId: "ems-taste",
  storageBucket: "ems-taste.firebasestorage.app",
  messagingSenderId: "52922659081",
  appId: "1:52922659081:web:915bc37614abdb0323e3d8",
  measurementId: "G-40R7SK9T3C"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
