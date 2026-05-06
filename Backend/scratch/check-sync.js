const { db, auth } = require('../firebase-config');

async function checkSync() {
  try {
    console.log('Synchronizing user data...');
    const snapshot = await db.collection('users').get();
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const uid = doc.id;
      const email = data.email || 'N/A';
      
      console.log(`--- Checking ${email} (UID: ${uid}) ---`);
      
      try {
        const authUser = await auth.getUser(uid);
        console.log(`[AUTH] User exists. Email in Auth: ${authUser.email}`);
      } catch (authErr) {
        console.warn(`[AUTH] User NOT FOUND for UID ${uid}: ${authErr.message}`);
        
        // Try looking up by email to see if UID changed
        if (data.email) {
          try {
            const authByEmail = await auth.getUserByEmail(data.email);
            console.log(`[AUTH] Found by email instead! Different UID: ${authByEmail.uid}`);
          } catch (e) {
            console.error(`[AUTH] Completely missing from Auth.`);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}

checkSync();
