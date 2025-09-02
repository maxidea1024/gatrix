const mysql = require('mysql2/promise');
require('dotenv').config({ path: './packages/backend/.env' });

async function fixWhitelistTagsV2() {
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
    
    // 먼저 현재 상태 확인
    console.log('\n=== 현재 상태 확인 ===');
    const [currentState] = await connection.execute(
      'SELECT id, tags FROM g_account_whitelist WHERE id IN (6, 7, 8) ORDER BY id'
    );
    
    console.log('현재 태그 상태:');
    for (const row of currentState) {
      console.log(`ID ${row.id}: "${row.tags}"`);
    }
    
    // 잘못된 데이터를 다시 올바른 형태로 생성
    console.log('\n=== 데이터 재생성 ===');
    
    // 원래 생성 스크립트에서 사용한 태그들
    const availableTags = ['긴급', '공지', '이벤트', '시스템', '업데이트', '보안', '마케팅', '고객지원', '정기점검', '장애'];
    
    // 계정 화이트리스트 수정
    const [accountRows] = await connection.execute(
      'SELECT id FROM g_account_whitelist WHERE id >= 6 ORDER BY id'
    );
    
    let accountFixed = 0;
    for (const row of accountRows) {
      // 1-3개의 랜덤 태그 생성
      const numTags = Math.floor(Math.random() * 3) + 1;
      const selectedTags = [];
      
      for (let i = 0; i < numTags; i++) {
        const randomTag = availableTags[Math.floor(Math.random() * availableTags.length)];
        if (!selectedTags.includes(randomTag)) {
          selectedTags.push(randomTag);
        }
      }
      
      const tagsJson = JSON.stringify(selectedTags);
      
      await connection.execute(
        'UPDATE g_account_whitelist SET tags = ? WHERE id = ?',
        [tagsJson, row.id]
      );
      
      console.log(`계정 ID ${row.id}: ${tagsJson}`);
      accountFixed++;
      
      if (accountFixed % 20 === 0) {
        console.log(`  진행률: ${accountFixed}/${accountRows.length}`);
      }
    }
    
    // IP 화이트리스트 수정
    const [ipRows] = await connection.execute(
      'SELECT id FROM g_ip_whitelist WHERE id >= 3 ORDER BY id'
    );
    
    let ipFixed = 0;
    for (const row of ipRows) {
      // 1-3개의 랜덤 태그 생성
      const numTags = Math.floor(Math.random() * 3) + 1;
      const selectedTags = [];
      
      for (let i = 0; i < numTags; i++) {
        const randomTag = availableTags[Math.floor(Math.random() * availableTags.length)];
        if (!selectedTags.includes(randomTag)) {
          selectedTags.push(randomTag);
        }
      }
      
      const tagsJson = JSON.stringify(selectedTags);
      
      await connection.execute(
        'UPDATE g_ip_whitelist SET tags = ? WHERE id = ?',
        [tagsJson, row.id]
      );
      
      console.log(`IP ID ${row.id}: ${tagsJson}`);
      ipFixed++;
      
      if (ipFixed % 20 === 0) {
        console.log(`  진행률: ${ipFixed}/${ipRows.length}`);
      }
    }
    
    console.log(`\n✅ 수정 완료!`);
    console.log(`📋 계정 화이트리스트: ${accountFixed}개 수정`);
    console.log(`🌐 IP 화이트리스트: ${ipFixed}개 수정`);
    
    // 수정 결과 확인
    console.log('\n=== 수정 결과 확인 ===');
    const [verifyAccount] = await connection.execute(
      'SELECT id, tags FROM g_account_whitelist WHERE id IN (6, 7, 8) ORDER BY id'
    );
    
    console.log('수정된 계정 화이트리스트:');
    for (const row of verifyAccount) {
      try {
        const parsed = JSON.parse(row.tags);
        console.log(`  ID ${row.id}: ${row.tags} → 파싱 성공:`, parsed);
      } catch (error) {
        console.log(`  ID ${row.id}: ${row.tags} → 파싱 실패: ${error.message}`);
      }
    }
    
    const [verifyIp] = await connection.execute(
      'SELECT id, tags FROM g_ip_whitelist WHERE id IN (3, 4, 5) ORDER BY id'
    );
    
    console.log('수정된 IP 화이트리스트:');
    for (const row of verifyIp) {
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
fixWhitelistTagsV2().catch(console.error);
