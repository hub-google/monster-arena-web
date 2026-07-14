import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseApp = initializeApp({
  apiKey: "AIzaSyAkC3Ra_v7SwyaCgMsKotqYilwLo-55ih4",
  authDomain: "monster-arena-web-app.firebaseapp.com",
  projectId: "monster-arena-web-app",
  storageBucket: "monster-arena-web-app.firebasestorage.app",
  messagingSenderId: "36423258503",
  appId: "1:36423258503:web:61049c5b6c745cd1368322"
});

const db = getFirestore(firebaseApp);

async function readDb() {
  console.log("Checking DB users...");
  const usersSnap = await getDocs(collection(db, 'users'));
  console.log("Users:", usersSnap.docs.map(d => ({id: d.id, ...d.data()})));
  
  console.log("Checking DB monsters...");
  const monstersSnap = await getDocs(collection(db, 'monsters'));
  console.log("Monsters:", monstersSnap.docs.map(d => ({id: d.id, ...d.data()})));

  process.exit(0);
}

readDb().catch(console.error);
