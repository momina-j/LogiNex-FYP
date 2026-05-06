const axios = require('axios');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

(async () => {
  const identifier = `test_${Date.now()}@example.com`;
  const password = 'testpassword123';
  
  try {
    console.log(`Step 1: Registering test user: ${identifier}`);
    const regRes = await axios.post('http://localhost:5001/api/register', {
      fullName: 'Test User',
      email: identifier,
      phone: '+923001234567',
      password: password,
      roles: ['shipper']
    });
    console.log('Registration Success:', regRes.data.message);

    console.log(`Step 2: Attempting Login with same credentials...`);
    const loginRes = await axios.post('http://localhost:5001/api/login', {
      identifier: identifier,
      password: password
    });
    console.log('Login Success:', loginRes.data.message);
    
  } catch (err) {
    console.error('FAILED!');
    if (err.response) {
      console.log('Response Status:', err.response.status);
      console.log('Response Data:', JSON.stringify(err.response.data));
    } else {
      console.log('Error Message:', err.message);
    }
  }
})();
