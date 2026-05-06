const { db } = require('./firebase-config');

async function checkConnection() {
  try {
    console.log('--- Database Connection Check ---');
    const snapshot = await db.collection('parcels').limit(1).get();
    console.log('✓ Successfully connected to Firestore!');
    console.log(`✓ Retrieved ${snapshot.size} test document.`);
    process.exit(0);
  } catch (err) {
    console.error('✗ Database Connection Failed:', err.message);
    process.exit(1);
  }
}

checkConnection();
