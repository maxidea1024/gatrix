const axios = require('axios');

const API_TOKEN = '87860d7d071492ed401aba44a9d6dad60fbcf9d1c4cad1c9fd7c18b913e982af';
const API_URL = 'http://localhost:5001/api/v1/test';
const TOTAL_CALLS = 10; // 먼저 10번으로 테스트
const BATCH_SIZE = 100; // 동시 요청 수
const DELAY_BETWEEN_BATCHES = 100; // 배치 간 지연 (ms)

let successCount = 0;
let errorCount = 0;
let startTime = Date.now();

// API 호출 함수 - 간단한 테스트 엔드포인트 사용
async function makeApiCall(callNumber) {
  try {
    const response = await axios.get(API_URL, {
      timeout: 10000
    });
    
    if (response.status === 200) {
      successCount++;
      if (callNumber % 1000 === 0) {
        console.log(`✅ ${callNumber}번째 호출 성공 (총 성공: ${successCount})`);
      }
    } else {
      errorCount++;
      console.log(`❌ ${callNumber}번째 호출 실패: ${response.status}`);
    }
  } catch (error) {
    errorCount++;
    if (callNumber % 1000 === 0 || errorCount < 10) {
      console.log(`❌ ${callNumber}번째 호출 에러:`, error.response?.status || error.message);
    }
  }
}

// 배치 처리 함수
async function processBatch(batchNumber, startIndex) {
  const promises = [];
  const endIndex = Math.min(startIndex + BATCH_SIZE, TOTAL_CALLS);
  
  for (let i = startIndex; i < endIndex; i++) {
    promises.push(makeApiCall(i + 1));
  }
  
  await Promise.all(promises);
  
  const progress = ((endIndex / TOTAL_CALLS) * 100).toFixed(1);
  console.log(`📊 배치 ${batchNumber} 완료 - 진행률: ${progress}% (${endIndex}/${TOTAL_CALLS})`);
}

// 메인 실행 함수
async function runTest() {
  console.log(`🚀 API 토큰 사용량 테스트 시작`);
  console.log(`📋 설정:`);
  console.log(`   - 토큰: ${API_TOKEN}`);
  console.log(`   - 총 호출 수: ${TOTAL_CALLS.toLocaleString()}번`);
  console.log(`   - 배치 크기: ${BATCH_SIZE}개`);
  console.log(`   - 배치 간 지연: ${DELAY_BETWEEN_BATCHES}ms`);
  console.log(`   - API URL: ${API_URL}`);
  console.log('');
  
  const totalBatches = Math.ceil(TOTAL_CALLS / BATCH_SIZE);
  
  for (let batchNumber = 1; batchNumber <= totalBatches; batchNumber++) {
    const startIndex = (batchNumber - 1) * BATCH_SIZE;
    
    await processBatch(batchNumber, startIndex);
    
    // 마지막 배치가 아니면 지연
    if (batchNumber < totalBatches) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
  
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  const rps = (TOTAL_CALLS / duration).toFixed(2);
  
  console.log('');
  console.log(`🎯 테스트 완료!`);
  console.log(`📊 결과 요약:`);
  console.log(`   ✅ 성공: ${successCount.toLocaleString()}번`);
  console.log(`   ❌ 실패: ${errorCount.toLocaleString()}번`);
  console.log(`   📈 성공률: ${((successCount / TOTAL_CALLS) * 100).toFixed(2)}%`);
  console.log(`   ⏱️  총 소요 시간: ${duration.toFixed(2)}초`);
  console.log(`   🚀 평균 RPS: ${rps}회/초`);
  console.log('');
  console.log(`💡 이제 대시보드에서 토큰 사용량이 ${TOTAL_CALLS.toLocaleString()}개 증가했는지 확인해보세요!`);
}

// 에러 핸들링
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// 실행
runTest().catch(console.error);
