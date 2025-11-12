// 게스트모드 필터 테스트 스크립트
const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api/client-versions';

async function testGuestModeFilter() {
  console.log('🧪 게스트모드 필터 테스트 시작...\n');

  try {
    // 1. 모든 클라이언트 버전 조회
    console.log('1. 모든 클라이언트 버전 조회');
    const allVersions = await axios.get(`${BASE_URL}?page=1&limit=10`);
    console.log(`   총 ${allVersions.data.data.total}개의 클라이언트 버전 발견`);
    
    // 2. 게스트모드 허용된 버전만 조회
    console.log('\n2. 게스트모드 허용된 버전만 조회');
    const guestAllowedVersions = await axios.get(`${BASE_URL}?page=1&limit=10&guestModeAllowed=true`);
    console.log(`   게스트모드 허용: ${guestAllowedVersions.data.data.total}개`);
    
    // 3. 게스트모드 비허용된 버전만 조회
    console.log('\n3. 게스트모드 비허용된 버전만 조회');
    const guestNotAllowedVersions = await axios.get(`${BASE_URL}?page=1&limit=10&guestModeAllowed=false`);
    console.log(`   게스트모드 비허용: ${guestNotAllowedVersions.data.data.total}개`);
    
    // 4. 결과 검증
    console.log('\n📊 결과 요약:');
    console.log(`   전체: ${allVersions.data.data.total}`);
    console.log(`   게스트모드 허용: ${guestAllowedVersions.data.data.total}`);
    console.log(`   게스트모드 비허용: ${guestNotAllowedVersions.data.data.total}`);
    
    const sum = guestAllowedVersions.data.data.total + guestNotAllowedVersions.data.data.total;
    if (sum <= allVersions.data.data.total) {
      console.log('✅ 필터가 올바르게 작동하고 있습니다!');
    } else {
      console.log('❌ 필터에 문제가 있을 수 있습니다.');
    }
    
    // 5. 실제 데이터 확인
    if (guestAllowedVersions.data.data.clientVersions.length > 0) {
      console.log('\n🔍 게스트모드 허용된 버전 샘플:');
      guestAllowedVersions.data.data.clientVersions.slice(0, 3).forEach(version => {
        console.log(`   - ${version.platform} v${version.clientVersion} (게스트모드: ${version.guestModeAllowed})`);
      });
    }
    
    if (guestNotAllowedVersions.data.data.clientVersions.length > 0) {
      console.log('\n🔍 게스트모드 비허용된 버전 샘플:');
      guestNotAllowedVersions.data.data.clientVersions.slice(0, 3).forEach(version => {
        console.log(`   - ${version.platform} v${version.clientVersion} (게스트모드: ${version.guestModeAllowed})`);
      });
    }
    
  } catch (error) {
    console.error('❌ 테스트 실행 중 오류 발생:', error.message);
    if (error.response) {
      console.error('   응답 상태:', error.response.status);
      console.error('   응답 데이터:', error.response.data);
    }
  }
}

// 테스트 실행
testGuestModeFilter();
