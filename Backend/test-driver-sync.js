const { db, admin } = require('./firebase-config');

async function verifySync() {
  const testDriverId = 'test_driver_001';
  console.log(`Starting verification for driver: ${testDriverId}`);

  // 1. Initial State
  const docRef = db.collection('drivers').doc(testDriverId);
  await docRef.set({ name: 'Verification Driver', status: 'available' }, { merge: true });
  console.log("Initial driver profile set.");

  // 2. Simulate GPS Update (Manual)
  console.log("Simulating GPS update...");
  await docRef.set({
    currentLocation: { lat: 31.5204, lng: 74.3587 },
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  // 3. Simulate Delivery Performance (Atomic Increment)
  console.log("Simulating 2 completed deliveries and 1 delay...");
  await docRef.set({ completedDeliveries: admin.firestore.FieldValue.increment(2) }, { merge: true });
  await docRef.set({ delayedDeliveries: admin.firestore.FieldValue.increment(1) }, { merge: true });

  // 4. Final Pulse Check
  const finalSnap = await docRef.get();
  const data = finalSnap.data();

  console.log("\nVerification Results:");
  console.log("---------------------");
  console.log(`GPS: Lat ${data.currentLocation?.lat}, Lng ${data.currentLocation?.lng}`);
  console.log(`Completed Deliveries: ${data.completedDeliveries}`);
  console.log(`Delayed Deliveries: ${data.delayedDeliveries}`);
  console.log(`Last Updated: ${data.lastUpdated?.toDate()}`);

  if (data.completedDeliveries === 2 && data.delayedDeliveries === 1) {
    console.log("\n✅ SUCCESS: Counters and GPS logic verified.");
  } else {
    console.error("\n❌ FAILURE: Data mismatch detected.");
  }
  
  process.exit(0);
}

verifySync().catch(err => {
  console.error("Verification script failed:", err);
  process.exit(1);
});
