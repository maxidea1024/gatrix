const mysql = require('mysql2/promise');
require('dotenv').config({ path: './packages/backend/.env' });

async function debugTags() {
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
    
    // 직접 JSON 데이터 삽입 테스트
    console.log('\n=== JSON 삽입 테스트 ===');
    const testTags = JSON.stringify(['테스트', '디버그']);
    console.log('삽입할 JSON:', testTags);
    
    // 테스트 데이터 삽입
    await connection.execute(
      'UPDATE g_account_whitelist SET tags = ? WHERE id = 6',
      [testTags]
    );
    
    // 삽입된 데이터 확인
    const [result] = await connection.execute(
      'SELECT id, tags, HEX(tags) as hex_tags FROM g_account_whitelist WHERE id = 6'
    );
    
    console.log('삽입된 데이터:', result[0]);
    
    // 다른 방법으로 삽입 테스트
    console.log('\n=== 다른 방법으로 삽입 테스트 ===');
    const testTags2 = '["한글", "테스트"]';
    console.log('삽입할 문자열:', testTags2);
    
    await connection.execute(
      'UPDATE g_account_whitelist SET tags = ? WHERE id = 7',
      [testTags2]
    );
    
    const [result2] = await connection.execute(
      'SELECT id, tags, HEX(tags) as hex_tags FROM g_account_whitelist WHERE id = 7'
    );
    
    console.log('삽입된 데이터 2:', result2[0]);
    
    // JSON_VALID 함수로 확인
    console.log('\n=== JSON 유효성 확인 ===');
    const [validCheck] = await connection.execute(
      'SELECT id, tags, JSON_VALID(tags) as is_valid FROM g_account_whitelist WHERE id IN (6, 7)'
    );
    
    console.log('JSON 유효성 확인:');
    for (const row of validCheck) {
      console.log(`ID ${row.id}: valid=${row.is_valid}, tags="${row.tags}"`);
    }
    
    // 직접 JSON 함수 사용해서 삽입
    console.log('\n=== JSON 함수 사용 삽입 ===');
    await connection.execute(
      'UPDATE g_account_whitelist SET tags = JSON_ARRAY(?, ?) WHERE id = 8',
      ['공지', '시스템']
    );
    
    const [result3] = await connection.execute(
      'SELECT id, tags, JSON_VALID(tags) as is_valid FROM g_account_whitelist WHERE id = 8'
    );
    
    console.log('JSON 함수로 삽입된 데이터:', result3[0]);
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n데이터베이스 연결 종료');
    }
  }
}

// 스크립트 실행
debugTags().catch(console.error);
