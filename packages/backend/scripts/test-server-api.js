const axios = require('axios');

async function testServerAPI() {
  const baseURL = 'http://localhost:5000';
  const token = '8b89ad53927a29ab6dbfb0569af5020d4dc81ecef08ec1d70439cd80fda465c9';

  const headers = {
    'X-API-Token': token,
    'X-Application-Name': 'chat-server',
    'Content-Type': 'application/json'
  };

  console.log('🧪 Testing Server API endpoints...\n');

  try {
    // Test 1: Server test endpoint
    console.log('1. Testing /api/v1/server/test');
    const testResponse = await axios.get(`${baseURL}/api/v1/server/test`, { headers });
    console.log('✅ Success:', testResponse.data);
    console.log('');

    // Test 2: Token verification
    console.log('2. Testing /api/v1/server/auth/verify-token');
    const verifyResponse = await axios.post(`${baseURL}/api/v1/server/auth/verify-token`, {
      token: 'dummy-jwt-token'
    }, { headers });
    console.log('✅ Success:', verifyResponse.data);
    console.log('');

  } catch (error) {
    if (error.response) {
      console.log('❌ Error:', error.response.status, error.response.data);
    } else {
      console.log('❌ Network Error:', error.message);
    }
  }
}

testServerAPI();
