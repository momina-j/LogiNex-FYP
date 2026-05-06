const axios = require('axios');

async function testPayment() {
  const url = 'http://localhost:5001/api/payments/process';
  const payload = {
    userId: 'test_user_123',
    amount: 1500,
    description: 'Test Payment Integration',
    cardNumber: '4242 4242 4242 4242',
    cvv: '123',
    expiry: '12/26',
    pin: '1234',
    cardHolderName: 'TEST RUNNER',
    trackingId: 'LNX-TEST-001'
  };

  try {
    console.log('Testing payment endpoint...');
    const response = await axios.post(url, payload);
    console.log('Success:', response.data);
    
    if (response.data.status === 'success') {
      console.log('✅ Payment logic verified.');
    } else {
      console.error('❌ Unexpected response:', response.data);
    }
  } catch (error) {
    console.error('❌ Payment test failed:', error.response?.data || error.message);
  }
}

testPayment();
