const { databaseManager } = require('../dist/config/database');
const { redisManager } = require('../dist/config/redis');

async function resetChatData() {
  console.log('🔄 채팅 데이터 초기화 시작...');

  try {
    // 1. Redis 데이터 초기화
    console.log('📦 Redis 데이터 초기화 중...');
    await redisManager.initialize();
    const redisClient = redisManager.getClient();

    // 모든 Redis 키 삭제
    await redisClient.flushall();
    console.log('✅ Redis 데이터 초기화 완료');

    // 2. 데이터베이스 채팅 관련 테이블 초기화
    console.log('🗄️ 데이터베이스 채팅 테이블 초기화 중...');
    await databaseManager.initialize();
    const db = databaseManager.getDatabase();

    // 채팅 관련 테이블들 초기화 (외래키 순서 고려)
    const tables = [
      'g_messages',
      'g_channel_members',
      'g_channel_invitations',
      'g_channels',
      'g_direct_message_participants',
      'g_user_privacy_settings',
    ];

    for (const table of tables) {
      try {
        await db.raw(`DELETE FROM ${table}`);
        console.log(`  ✅ ${table} 테이블 초기화 완료`);
      } catch (error) {
        console.log(`  ⚠️ ${table} 테이블 초기화 실패 (테이블이 없을 수 있음):`, error.message);
      }
    }

    console.log('✅ 데이터베이스 채팅 테이블 초기화 완료');

    // 3. 연결 종료
    await redisManager.disconnect();
    await databaseManager.disconnect();

    console.log('🎉 채팅 데이터 초기화 완료!');
    console.log('');
    console.log('초기화된 데이터:');
    console.log('- Redis: 모든 사용자 세션, 캐시 데이터');
    console.log('- 데이터베이스: 채널, 메시지, 초대, 멤버십 데이터');
    console.log('');
    console.log('이제 새로운 JWT 인증 시스템으로 채팅을 시작할 수 있습니다! 🚀');
  } catch (error) {
    console.error('❌ 채팅 데이터 초기화 실패:', error);
    process.exit(1);
  }
}

// 스크립트 실행
resetChatData();
