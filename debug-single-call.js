const axios = require('axios');

const API_TOKEN = 'f183e6b8ba6e724cc2093910342857e6aa720f82d4f6154aaaedd669c8d0741a';
const BASE_URL = 'http://localhost:5000';

async function debugSingleCall() {
  console.log('🔍 Debug single API call...');
  console.log(`🔑 Token: ${API_TOKEN}`);
  console.log(`📍 URL: ${BASE_URL}/api/v1/remote-config/client/templates`);
  
  try {
    const response = await axios.get(`${BASE_URL}/api/v1/remote-config/client/templates`, {
      headers: {
        'X-API-Key': API_TOKEN,
        'X-Application-Name': 'test-app',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Success!');
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, response.data);
    
  } catch (error) {
    console.log('❌ Error details:');
    console.log(`Status: ${error.response?.status}`);
    console.log(`Status Text: ${error.response?.statusText}`);
    console.log(`Headers:`, error.response?.headers);
    console.log(`Response Data:`, error.response?.data);
    
    // 다른 헤더 방식도 시도
    console.log('\n🔄 Trying with Authorization Bearer header...');
    try {
      const response2 = await axios.get(`${BASE_URL}/api/v1/remote-config/client/templates`, {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'X-Application-Name': 'test-app',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Success with Bearer!');
      console.log(`Status: ${response2.status}`);
      
    } catch (error2) {
      console.log('❌ Bearer also failed:');
      console.log(`Status: ${error2.response?.status}`);
      console.log(`Response Data:`, error2.response?.data);
    }
  }
}

debugSingleCall().catch(console.error);
