const { db } = require('../firebase-config');

async function checkUsers() {
  try {
    const snapshot = await db.collection('users').get();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log('--- User ---');
      console.log('Email:', data.email);
      if (data.passwordHash) {
        console.log('passwordHash (type):', typeof data.passwordHash);
      }
      if (data.password) {
        console.log('password (type):', typeof data.password);
        console.log('password (length):', String(data.password).length);
      }
    });
  } catch (err) {
    console.error('Error fetching users:', err);
  } finally {
    process.exit();
  }
}

checkUsers();
