const { db } = require('../firebase-config'); // Fixed path

async function testFirebase() {
  console.log("Testing Firebase connection...");
  try {
    // This will trigger ensureInitialized() and the admin.firestore() test
    const snapshot = await db.collection('users').get();
    console.log("Firebase connection successful! Found", snapshot.size, "users.");
    process.exit(0);
  } catch (error) {
    console.error("Firebase Test Failed:", error);
    process.exit(1);
  }
}

testFirebase();
