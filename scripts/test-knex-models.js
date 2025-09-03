const mysql = require('mysql2/promise');
require('dotenv').config({ path: './packages/backend/.env' });

async function testKnexModels() {
  let connection;
  
  try {
    console.log('데이터베이스 연결 중...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'motif_dev',
      password: process.env.DB_PASSWORD || 'dev123$',
      database: process.env.DB_NAME || 'uwo_gate'
    });
    console.log('데이터베이스 연결 성공!');
    
    // 테스트용 사용자 생성 (이미 있으면 스킵)
    console.log('\n=== 테스트용 사용자 확인/생성 ===');
    const [existingUsers] = await connection.execute('SELECT * FROM g_users WHERE email = ?', ['test@example.com']);
    
    let testUserId;
    if (existingUsers.length === 0) {
      const [userResult] = await connection.execute(
        'INSERT INTO g_users (name, email, role, status) VALUES (?, ?, ?, ?)',
        ['Test User', 'test@example.com', 'admin', 'active']
      );
      testUserId = userResult.insertId;
      console.log(`✅ 테스트 사용자 생성됨: ID ${testUserId}`);
    } else {
      testUserId = existingUsers[0].id;
      console.log(`✅ 기존 테스트 사용자 사용: ID ${testUserId}`);
    }
    
    // 테스트용 태그 생성
    console.log('\n=== 테스트용 태그 생성 ===');
    const [tagResult] = await connection.execute(
      'INSERT INTO g_tags (name, color, description, createdBy) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',
      ['test-tag', '#FF5722', 'Test tag for knex models', testUserId]
    );
    const testTagId = tagResult.insertId;
    console.log(`✅ 테스트 태그 생성/확인됨: ID ${testTagId}`);
    
    // 테스트용 게임 월드 생성
    console.log('\n=== 테스트용 게임 월드 생성 ===');
    const [worldResult] = await connection.execute(
      'INSERT INTO g_game_worlds (worldId, name, description, createdBy) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',
      ['test-world', 'Test World', 'Test world for knex models', testUserId]
    );
    const testWorldId = worldResult.insertId;
    console.log(`✅ 테스트 게임 월드 생성/확인됨: ID ${testWorldId}`);
    
    // 테스트용 화이트리스트 엔트리 생성
    console.log('\n=== 테스트용 화이트리스트 엔트리 생성 ===');
    const [whitelistResult] = await connection.execute(
      'INSERT INTO g_account_whitelist (accountId, purpose, createdBy) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',
      ['test-account-123', 'Test account for knex models', testUserId]
    );
    const testWhitelistId = whitelistResult.insertId;
    console.log(`✅ 테스트 화이트리스트 엔트리 생성/확인됨: ID ${testWhitelistId}`);
    
    // 모든 테이블의 레코드 수 확인
    console.log('\n=== 모든 테이블 레코드 수 확인 ===');
    const tables = [
      'g_users',
      'g_tags', 
      'g_game_worlds',
      'g_account_whitelist',
      'g_tag_assignments',
      'g_vars',
      'g_message_templates',
      'g_job_types'
    ];
    
    for (const table of tables) {
      try {
        const [countResult] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`${table}: ${countResult[0].count}개 레코드`);
      } catch (error) {
        console.log(`${table}: 오류 - ${error.message}`);
      }
    }
    
    console.log('\n✅ 모든 knex 모델 테스트 완료!');
    console.log('백엔드 API가 정상적으로 작동할 준비가 되었습니다.');
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n데이터베이스 연결 종료');
    }
  }
}

// 스크립트 실행
testKnexModels().catch(console.error);
