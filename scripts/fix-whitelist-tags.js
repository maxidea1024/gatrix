const mysql = require('mysql2/promise');
require('dotenv').config({ path: './packages/backend/.env' });

async function fixWhitelistTags() {
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
    
    // 계정 화이트리스트 태그 수정
    console.log('\n=== 계정 화이트리스트 태그 수정 ===');
    const [accountWhitelists] = await connection.execute(
      'SELECT id, tags FROM g_account_whitelist WHERE tags IS NOT NULL'
    );
    
    let accountFixed = 0;
    for (const row of accountWhitelists) {
      try {
        // 이미 올바른 JSON인지 확인
        JSON.parse(row.tags);
        console.log(`ID ${row.id}: 이미 올바른 JSON`);
      } catch (error) {
        // JSON이 아닌 경우 수정
        let fixedTags;
        if (typeof row.tags === 'string') {
          // 쉼표로 구분된 문자열을 배열로 변환
          const tagArray = row.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
          fixedTags = JSON.stringify(tagArray);
        } else {
          fixedTags = JSON.stringify([]);
        }
        
        await connection.execute(
          'UPDATE g_account_whitelist SET tags = ? WHERE id = ?',
          [fixedTags, row.id]
        );
        
        console.log(`ID ${row.id}: "${row.tags}" → ${fixedTags}`);
        accountFixed++;
      }
    }
    
    // IP 화이트리스트 태그 수정
    console.log('\n=== IP 화이트리스트 태그 수정 ===');
    const [ipWhitelists] = await connection.execute(
      'SELECT id, tags FROM g_ip_whitelist WHERE tags IS NOT NULL'
    );
    
    let ipFixed = 0;
    for (const row of ipWhitelists) {
      try {
        // 이미 올바른 JSON인지 확인
        JSON.parse(row.tags);
        console.log(`ID ${row.id}: 이미 올바른 JSON`);
      } catch (error) {
        // JSON이 아닌 경우 수정
        let fixedTags;
        if (typeof row.tags === 'string') {
          // 쉼표로 구분된 문자열을 배열로 변환
          const tagArray = row.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
          fixedTags = JSON.stringify(tagArray);
        } else {
          fixedTags = JSON.stringify([]);
        }
        
        await connection.execute(
          'UPDATE g_ip_whitelist SET tags = ? WHERE id = ?',
          [fixedTags, row.id]
        );
        
        console.log(`ID ${row.id}: "${row.tags}" → ${fixedTags}`);
        ipFixed++;
      }
    }
    
    console.log(`\n✅ 수정 완료!`);
    console.log(`📋 계정 화이트리스트: ${accountFixed}개 수정`);
    console.log(`🌐 IP 화이트리스트: ${ipFixed}개 수정`);
    
    // 수정 결과 확인
    console.log('\n=== 수정 결과 확인 ===');
    const [verifyAccount] = await connection.execute(
      'SELECT id, tags FROM g_account_whitelist WHERE tags IS NOT NULL LIMIT 3'
    );
    
    console.log('계정 화이트리스트 샘플:');
    for (const row of verifyAccount) {
      try {
        const parsed = JSON.parse(row.tags);
        console.log(`  ID ${row.id}: ${row.tags} → 파싱 성공:`, parsed);
      } catch (error) {
        console.log(`  ID ${row.id}: ${row.tags} → 파싱 실패: ${error.message}`);
      }
    }
    
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
fixWhitelistTags().catch(console.error);
