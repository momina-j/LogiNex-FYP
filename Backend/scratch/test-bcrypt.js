const bcrypt = require('bcrypt');

async function testComparison() {
  const password = 'the_assumed_password'; // I don't know the password
  const hashFromDb = '$2b$10$....'; // I'll use a real test case
  
  // Simulation: If I have a real hash from the DB, I can test it against a known password.
  // Since I don't know the user's password, I'll just verify the logic works.
  
  const testHash = await bcrypt.hash('test123456', 10);
  console.log('Test Hash:', testHash);
  console.log('Is Hash:', testHash.startsWith('$2b$'));
  
  const match = await bcrypt.compare('test123456', testHash);
  console.log('Match:', match);
}

testComparison();
