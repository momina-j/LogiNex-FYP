const { db } = require('../firebase-config');

async function checkUsers() {
  try {
    console.log('Fetching users from Firestore...');
    const snapshot = await db.collection('users').get();
    
    if (snapshot.empty) {
      console.log('No users found in Firestore.');
      return;
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log('--- User ---');
      console.log('UID:', doc.id);
      console.log('Email:', data.email);
      console.log('Roles:', data.roles);
      console.log('Has passwordHash:', !!data.passwordHash);
      console.log('Has plain password:', !!data.password);
      // Masking hash for safety
      if (data.passwordHash) {
        console.log('Hash starts with:', data.passwordHash.substring(0, 10) + '...');
      }
    });
  } catch (err) {
    console.error('Error fetching users:', err);
  } finally {
    process.exit();
  }
}

checkUsers();
