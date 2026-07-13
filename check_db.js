import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, getDocs } from 'firebase/firestore';

const firebaseApp = initializeApp({ projectId: "monster-arena-local" });
const db = getFirestore(firebaseApp);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

async function checkDb() {
  console.log("Checking DB users...");
  const usersSnap = await getDocs(collection(db, 'users'));
  console.log("Users:", usersSnap.docs.map(d => d.data()));
  
  console.log("Checking DB monsters...");
  const monstersSnap = await getDocs(collection(db, 'monsters'));
  console.log("Monsters:", monstersSnap.docs.map(d => d.data()));

  console.log("Checking DB user_inventory...");
  const invSnap = await getDocs(collection(db, 'user_inventory'));
  console.log("Inventory:", invSnap.docs.map(d => d.data()));
  
  process.exit(0);
}

checkDb().catch(console.error);
