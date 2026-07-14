import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseApp = initializeApp({
  apiKey: "AIzaSyAkC3Ra_v7SwyaCgMsKotqYilwLo-55ih4",
  authDomain: "monster-arena-web-app.firebaseapp.com",
  projectId: "monster-arena-web-app",
  storageBucket: "monster-arena-web-app.firebasestorage.app",
  messagingSenderId: "36423258503",
  appId: "1:36423258503:web:61049c5b6c745cd1368322"
});

const db = getFirestore(firebaseApp);

// If there's an emulator running and we need to clear it, uncomment next line:
// connectFirestoreEmulator(db, '127.0.0.1', 8080);

const collectionsToClear = [
  'users',
  'monsters',
  'user_inventory',
  'guilds',
  'world_boss',
  'messages',
  'battles'
];

async function clearCollections() {
  for (const collName of collectionsToClear) {
    console.log(`Clearing collection: ${collName}`);
    const querySnapshot = await getDocs(collection(db, collName));
    let count = 0;
    const deletePromises = [];
    querySnapshot.forEach((docSnap) => {
      deletePromises.push(deleteDoc(docSnap.ref));
      count++;
    });
    await Promise.all(deletePromises);
    console.log(`Deleted ${count} documents from ${collName}`);
  }
  console.log("Database cleared successfully!");
  process.exit(0);
}

clearCollections().catch(console.error);
