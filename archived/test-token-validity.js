const axios = require('axios');

const API_TOKEN = 'd39d981f2d5cb4b6653cf1713fdf038cfc441228d11d69402a9938dee5829d67';
const BASE_URL = 'http://localhost:5001';

async function testTokenValidity() {
  console.log('🔍 Testing API token validity...');
  console.log(`Token: ${API_TOKEN.substring(0, 16)}...`);

  // 다양한 엔드포인트 테스트
  const endpoints = [
    '/api/v1/remote-config/client/templates',
    '/api/v1/remote-config/client/evaluate',
    '/api/v1/remote-config/server/templates',
  ];

  for (const endpoint of endpoints) {
    console.log(`\n📍 Testing: ${BASE_URL}${endpoint}`);

    try {
      const response = await axios.get(`${BASE_URL}${endpoint}`, {
        headers: {
          'X-API-Key': API_TOKEN,
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Success: ${response.status} - ${response.statusText}`);
      console.log(`📄 Response: ${JSON.stringify(response.data).substring(0, 200)}...`);
    } catch (error) {
      console.log(`❌ Error: ${error.response?.status} - ${error.response?.statusText}`);
      if (error.response?.data) {
        console.log(`📄 Error details: ${JSON.stringify(error.response.data)}`);
      }
    }
  }

  // Authorization 헤더로도 테스트
  console.log(`\n🔄 Testing with Authorization header...`);
  try {
    const response = await axios.get(`${BASE_URL}/api/v1/remote-config/client/templates`, {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`✅ Success with Bearer: ${response.status}`);
  } catch (error) {
    console.log(`❌ Error with Bearer: ${error.response?.status} - ${error.response?.statusText}`);
    if (error.response?.data) {
      console.log(`📄 Error details: ${JSON.stringify(error.response.data)}`);
    }
  }
}

testTokenValidity().catch(console.error);
