const { getDb } = require('../firebase-config');

async function test() {
    console.log("Testing Firestore connection...");
    try {
        const db = getDb();
        console.log("Firestore instance obtained. Attempting a read...");
        const snapshot = await db.collection('users').limit(1).get();
        console.log("Read successful. Documents found:", snapshot.size);
        process.exit(0);
    } catch (err) {
        console.error("TEST FAILED:");
        console.error(err);
        process.exit(1);
    }
}

test();
