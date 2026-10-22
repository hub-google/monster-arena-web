import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// NEVER ship an unverified API key fallback. Vite replaces VITE_* variables
// at BUILD time, so GitHub Actions must provide the production web-app config.
const usingEmulator = import.meta.env.DEV &&
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
const configuredKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim();

export const firebaseConfigured = usingEmulator || Boolean(configuredKey);

const firebaseConfig = {
  apiKey: configuredKey || (usingEmulator ? 'emulator-test-api-key' : 'MISSING_FIREBASE_API_KEY'),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'monster-arena-web-app.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'monster-arena-web-app',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'monster-arena-web-app.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '36423258503',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:36423258503:web:61049c5b6c745cd1368322'
};

export const app = firebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

if (usingEmulator && auth && db) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
