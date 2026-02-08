const axios = require('axios');

async function testApiResponse() {
  try {
    console.log('Testing API response structure...');

    const response = await axios.get(
      'http://localhost:5001/api/v1/admin/api-tokens?page=1&limit=5',
      {
        headers: {
          Authorization: 'Bearer test-token', // This might fail but we can see the structure
        },
      }
    );

    console.log('✅ Response received');
    console.log('Status:', response.status);
    console.log('Response structure:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.log('❌ API Error');
      console.log('Status:', error.response.status);
      console.log('Response structure:');
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('❌ Network Error:', error.message);
    }
  }
}

testApiResponse();
