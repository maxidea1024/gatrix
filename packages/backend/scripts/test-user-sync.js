const axios = require('axios');

async function testUserSync() {
  try {
    console.log('Testing user sync API...');

    const response = await axios.get('http://localhost:5001/api/v1/server/users/sync', {
      headers: {
        'X-API-Key': '8b89ad53927a29ab6dbfb0569af5020d4dc81ecef08ec1d70439cd80fda465c9',
        'X-Application-Name': 'chat-server',
      },
    });

    console.log('✅ Success!');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Error!');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data);
    console.log('Message:', error.message);
  }
}

testUserSync();
