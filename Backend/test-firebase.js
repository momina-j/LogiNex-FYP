const { db } = require('./firebase-config');

async function test() {
  try {
    console.log("Attempting to access Firestore...");
    const snapshot = await db.collection('users').limit(1).get();
    console.log("Firestore access successful. Found users:", snapshot.size);
  } catch (error) {
    console.error("Firestore access failed!");
    console.error("Error Name:", error.name);
    console.error("Error Message:", error.message);
    console.error("Stack Trace:", error.stack);
  }
}

test();
