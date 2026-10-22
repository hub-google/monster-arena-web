import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAkC3Ra_v7SwyaCgMsKotqYilwLo-55ih4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "monster-arena-web-app.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "monster-arena-web-app",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "monster-arena-web-app.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "36423258503",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:36423258503:web:61049c5b6c745cd1368322"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Use emulator only when in local dev AND not intentionally targeting production
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
