const axios = require('axios');

const API_TOKEN = '87860d7d071492ed401aba44a9d6dad60fbcf9d1c4cad1c9fd7c18b913e982af';
const BASE_URL = 'http://localhost:5000';

async function debugApiCall() {
  console.log('🔍 Debug API call...');
  console.log(`🔑 Token: ${API_TOKEN}`);
  console.log(`📍 URL: ${BASE_URL}/api/v1/client/templates`);

  try {
    const response = await axios.get(`${BASE_URL}/api/v1/client/templates`, {
      headers: {
        'X-API-Token': API_TOKEN,
        'X-Application-Name': 'test-app',
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Success!');
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, response.data);
    
  } catch (error) {
    console.log('❌ Error occurred:');
    console.log(`Status: ${error.response?.status}`);
    console.log(`Status Text: ${error.response?.statusText}`);
    console.log(`Response:`, error.response?.data);
    console.log(`Error Message:`, error.message);
    
    if (error.response?.status === 400) {
      console.log('\n🔍 400 Bad Request - 가능한 원인:');
      console.log('1. 잘못된 헤더 형식');
      console.log('2. 필수 파라미터 누락');
      console.log('3. 토큰 타입 불일치');
      console.log('4. 환경 설정 문제');
    }
  }
}

debugApiCall();
