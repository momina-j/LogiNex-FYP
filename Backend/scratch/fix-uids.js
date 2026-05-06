const { db, auth } = require('../firebase-config');

async function fixUidMismatch() {
  try {
    const snapshot = await db.collection('users').get();
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const oldUid = doc.id;
      const email = data.email;
      
      if (!email) continue;
      
      try {
        const authUser = await auth.getUserByEmail(email);
        const newUid = authUser.uid;
        
        if (oldUid !== newUid) {
          console.log(`Mismatch for ${email}. Moving ${oldUid} -> ${newUid}`);
          
          // Copy to new doc
          await db.collection('users').doc(newUid).set({
            ...data,
            id: newUid,
            updatedAt: new Date().toISOString()
          });
          
          // Delete old doc
          await db.collection('users').doc(oldUid).delete();
          console.log(`Successfully migrated ${email}`);
        }
      } catch (e) {
        console.warn(`Could not find ${email} in Auth to verify UID: ${e.message}`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}

fixUidMismatch();
