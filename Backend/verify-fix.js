const axios = require('axios');
const dns = require('dns');

// Apply the fix
dns.setDefaultResultOrder('ipv4first');

(async () => {
  try {
    console.log("Testing connectivity to identitytoolkit.googleapis.com with IPv4 preference...");
    const res = await axios.get('https://identitytoolkit.googleapis.com');
    console.log('Success! Result status:', res.status);
  } catch (err) {
    if (err.response) {
        console.log('Connected but got response error (expected for root URL):', err.response.status);
    } else {
        console.error('Connection failed with code:', err.code);
        console.error('Error message:', err.message);
    }
  }
})();
