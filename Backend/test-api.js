const axios = require('axios');

async function testLogin() {
  try {
    console.log("Testing Backend Login endpoint directly...");
    const response = await axios.post('http://127.0.0.1:5001/api/login', {
      identifier: 'test@example.com',
      password: 'password123'
    });
    console.log("Status:", response.status);
    console.log("Data:", response.data);
  } catch (error) {
    console.log("Error Status:", error.response?.status);
    console.log("Error Data:", error.response?.data);
    console.log("Error Message:", error.message);
    if (typeof error.response?.data === 'string') {
        console.log("Error Body (String):", error.response.data);
    }
  }
}

testLogin();
