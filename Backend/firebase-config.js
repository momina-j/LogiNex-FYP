// firebase-config.js
require('dotenv').config();
const admin = require("firebase-admin");
const dns = require('dns');

// Fix for Node 18+ DNS resolution issues on some Windows systems
dns.setDefaultResultOrder('ipv4first');

// IMPORTANT: Download your Service Account Key from Firebase Console
// (Project Settings > Service accounts > Generate new private key)
// save it as 'serviceAccountKey.json' in this folder.

let serviceAccount;
try {
  serviceAccount = require("./serviceAccountKey.json");
} catch (e) {
  // Silent fallback for startup
}

let isInitialized = false;

function ensureInitialized() {
  if (isInitialized) return;

  try {
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || "loginex-749ec",
        databaseURL: process.env.FIREBASE_DATABASE_URL || "https://loginex-749ec-default-rtdb.firebaseio.com"
      });
      console.log("Firebase Admin SDK initialized successfully with service account.");
    } else {
      console.error("\n[!] CRITICAL ERROR: serviceAccountKey.json not found!");
      console.warn("Attempting initialization with project ID only. This may cause Firestore to fail.");
      
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || "loginex-749ec"
      });
    }
    
    // Explicitly test Firestore to catch "Service not available" early
    const testDb = admin.firestore();
    if (!testDb) throw new Error("Firestore service instance could not be created.");
    
    isInitialized = true;
  } catch (err) {
    if (err.code === 'app/duplicate-app' || err.message.includes('already exists')) {
      isInitialized = true;
    } else {
      console.error("Firebase Initialization Error:", err);
      // Don't crash the server, but ensure we know initialization failed
      isInitialized = false; 
      throw err;
    }
  }
}

// Function-based getters to allow lazy initialization with proper error handling
const getDb = () => {
  ensureInitialized();
  return admin.firestore();
};

const getAuth = () => {
  ensureInitialized();
  return admin.auth();
};

const getRtdb = () => {
  ensureInitialized();
  return admin.database();
};

// Export objects that proxy to the getters
const db = {
  collection: (...args) => getDb().collection(...args),
  doc: (...args) => getDb().doc(...args),
  batch: () => getDb().batch(),
  runTransaction: (...args) => getDb().runTransaction(...args),
  settings: (...args) => getDb().settings(...args),
};

const auth = {
  createUser: (...args) => getAuth().createUser(...args),
  verifyIdToken: (...args) => getAuth().verifyIdToken(...args),
  getUser: (...args) => getAuth().getUser(...args),
  getUserByEmail: (...args) => getAuth().getUserByEmail(...args),
  updateUser: (...args) => getAuth().updateUser(...args),
  deleteUser: (...args) => getAuth().deleteUser(...args),
  setCustomUserClaims: (...args) => getAuth().setCustomUserClaims(...args),
};

const rtdb = {
  ref: (...args) => getRtdb().ref(...args),
};

module.exports = { db, auth, rtdb, admin, getDb, getAuth, getRtdb };

