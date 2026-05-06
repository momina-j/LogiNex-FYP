const { db, auth } = require('../firebase-config');
const bcrypt = require('bcrypt');

async function repair() {
  try {
    console.log('--- Starting Auth & Data Repair ---');
    const snapshot = await db.collection('users').get();
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const uid = doc.id;
      const email = data.email;
      
      if (!email && uid === 'PBgQfKur8067LA16UlKg') {
         console.log(`Skipping null-email user (UID: ${uid})`);
         continue;
      }

      console.log(`\nProcessing ${email}...`);

      let currentHash = data.passwordHash || '';
      let plainPassword = data.password || '';

      // 1. Data Normalization: Ensure we have a valid hash
      if (!currentHash && plainPassword) {
        if (plainPassword.startsWith('$2')) {
          // It's actually a hash in the wrong field
          currentHash = plainPassword;
          console.log('-> Moved hash from "password" to "passwordHash"');
        } else {
          // It's plain text, hash it
          currentHash = await bcrypt.hash(plainPassword, 10);
          console.log('-> Hashed plain password into "passwordHash"');
        }
      }

      // Special case for admin@loginex.com if totally missing
      if (email === 'admin@loginex.com' && !currentHash) {
          currentHash = await bcrypt.hash('Admin123!', 10);
          console.log('-> Set admin password to "Admin123!"');
      }

      // 2. Auth Sync: Ensure user exists in Firebase Auth
      let authUserExists = false;
      try {
        await auth.getUser(uid);
        authUserExists = true;
      } catch (err) {
        // Try by email
        try {
          await auth.getUserByEmail(email);
          authUserExists = true;
          console.log('-> User exists in Auth by Email (UID check failed)');
        } catch (e) {
          authUserExists = false;
        }
      }

      if (!authUserExists && email) {
        console.log(`-> Creating user ${email} in Firebase Auth...`);
        const tempPass = email === 'admin@loginex.com' ? 'Admin123!' : 'User123!';
        await auth.createUser({
          uid: uid.length > 20 ? uid : undefined, // Auth UIDs must be long or auto-gen
          email: email,
          password: tempPass
        });
        console.log(`-> Created in Auth with Temp Pass: ${tempPass}`);
      }

      // 3. Save standardized data back to Firestore
      await db.collection('users').doc(uid).update({
        passwordHash: currentHash,
        password: admin.firestore.FieldValue.delete(), // Clean up legacy field
        updatedAt: new Date().toISOString()
      });
      console.log('-> Firestore record standardized.');
    }

    console.log('\n--- Repair Complete ---');
  } catch (err) {
    console.error('CRITICAL ERROR DURING REPAIR:', err);
  } finally {
    process.exit();
  }
}

// Access standard admin for FieldValue.delete()
const admin = require('firebase-admin');
repair();
