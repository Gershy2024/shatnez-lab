import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDD_v25TpimV3I29uen7QPZ_1MkuWgTkE",
  authDomain: "shatnez-lab.firebaseapp.com",
  projectId: "shatnez-lab",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app);
} catch (e) {
  console.error("Firebase init failed:", e);
}

const isConfigured = !!db;

export { db, isConfigured };
