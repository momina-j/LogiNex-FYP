const axios = require('axios');
require('dotenv').config();

async function testApiKey() {
    const API_KEY = process.env.FIREBASE_API_KEY;
    console.log(`Testing API Key: ${API_KEY ? API_KEY.substring(0, 5) + '...' : 'undefined'}`);
    
    try {
        const response = await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
            { email: 'test@example.com', password: 'password', returnSecureToken: true }
        );
        console.log("Response:", response.data);
    } catch (error) {
        console.error("Error:", error.response?.data?.error?.message || error.message);
    }
}

testApiKey();
