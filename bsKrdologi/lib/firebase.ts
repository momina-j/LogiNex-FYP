import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDqGlseGb42Zd-XFtPntif3KMaalb0Uufo",
  authDomain: "loginex-749ec.firebaseapp.com",
  databaseURL: "https://loginex-749ec-default-rtdb.firebaseio.com",
  projectId: "loginex-749ec",
  storageBucket: "loginex-749ec.firebasestorage.app",
  messagingSenderId: "199704616304",
  appId: "1:199704616304:web:0eb7f72dd0c7b0b64e03b5",
  measurementId: "G-96ZKK01KCW"
};

// Initialize Firebase (SSR friendly)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Initialize Analytics (Client-side only)
let analytics: any;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { app, auth, db, storage, analytics };
