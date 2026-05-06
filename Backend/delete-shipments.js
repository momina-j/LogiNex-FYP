const { db } = require('./firebase-config');

async function deleteCollection(collectionPath, batchSize) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(query, resolve) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    // When there are no documents left, we are done
    resolve();
    return;
  }

  // Delete documents in a batch
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  console.log(`Deleted batch of ${batchSize} documents from shipments.`);
  
  // Recurse on the next process tick, to avoid
  // exploding the stack.
  process.nextTick(() => {
    deleteQueryBatch(query, resolve);
  });
}

async function run() {
  console.log("Starting deletion of 'shipments' collection...");
  try {
    await deleteCollection('shipments', 500);
    console.log("Successfully cleared the 'shipments' collection.");
    process.exit(0);
  } catch (err) {
    console.error("Error deleting collection:", err);
    process.exit(1);
  }
}

run();
