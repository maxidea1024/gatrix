const axios = require('axios');

const API_TOKEN = '9a4be10bc72a2fc2f671cf8c6bc1df9e66baa64663c4352a0dda19cd251210f7';
const BASE_URL = 'http://localhost:5001';
const TOTAL_CALLS = 5;

// API 호출 함수 - Client SDK 엔드포인트 사용 (API 토큰 인증)
async function makeApiCall(callNumber) {
  try {
    const response = await axios.get(`${BASE_URL}/api/v1/client/templates`, {
      headers: {
        'X-API-Key': API_TOKEN,
        'X-Application-Name': 'test-app',
        'Content-Type': 'application/json',
      },
    });

    console.log(`Call ${callNumber}: Success - Status: ${response.status}`);
    return { success: true, status: response.status, callNumber };
  } catch (error) {
    console.log(`Call ${callNumber}: Error - ${error.response?.status || error.message}`);
    return { success: false, error: error.response?.status || error.message, callNumber };
  }
}

// 100번 API 호출 실행
async function runApiTest() {
  console.log(`🚀 Starting ${TOTAL_CALLS} API calls with Client SDK token...`);
  console.log(`📍 Target URL: ${BASE_URL}/api/v1/remote-config/client/templates`);
  console.log(`🔑 API Token: ${API_TOKEN.substring(0, 16)}...`);
  console.log('=' * 60);

  const startTime = Date.now();
  const results = [];

  // 순차적으로 호출 (너무 빠르면 서버에 부하)
  for (let i = 1; i <= TOTAL_CALLS; i++) {
    const result = await makeApiCall(i);
    results.push(result);

    // 10번마다 진행상황 출력
    if (i % 10 === 0) {
      const successCount = results.filter((r) => r.success).length;
      console.log(`📊 Progress: ${i}/${TOTAL_CALLS} (${successCount} successful)`);
    }

    // 서버 부하 방지를 위한 짧은 대기
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;

  // 결과 요약
  const successCount = results.filter((r) => r.success).length;
  const errorCount = results.filter((r) => !r.success).length;

  console.log('=' * 60);
  console.log('📈 Test Results Summary:');
  console.log(`✅ Successful calls: ${successCount}/${TOTAL_CALLS}`);
  console.log(`❌ Failed calls: ${errorCount}/${TOTAL_CALLS}`);
  console.log(`⏱️  Total duration: ${duration.toFixed(2)} seconds`);
  console.log(`🔄 Average time per call: ${((duration / TOTAL_CALLS) * 1000).toFixed(2)}ms`);

  if (errorCount > 0) {
    console.log('\n❌ Error breakdown:');
    const errorTypes = {};
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        errorTypes[r.error] = (errorTypes[r.error] || 0) + 1;
      });
    Object.entries(errorTypes).forEach(([error, count]) => {
      console.log(`   ${error}: ${count} times`);
    });
  }

  console.log('\n💡 Check the backend logs for token usage tracking information!');
  console.log('💡 Usage count should be updated in the database after 1 minute.');
}

// 실행
runApiTest().catch(console.error);
