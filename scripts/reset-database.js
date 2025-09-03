const mysql = require('mysql2/promise');
require('dotenv').config({ path: './packages/backend/.env' });

async function resetDatabase() {
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
    
    // 외래키 체크 비활성화
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    
    // 모든 테이블 목록 가져오기
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE 'g_%'
    `, [process.env.DB_NAME || 'uwo_gate']);
    
    console.log(`\n=== 삭제할 테이블 목록 (${tables.length}개) ===`);
    tables.forEach(table => console.log(`- ${table.TABLE_NAME}`));
    
    // 모든 테이블 삭제
    for (const table of tables) {
      await connection.execute(`DROP TABLE IF EXISTS ${table.TABLE_NAME}`);
      console.log(`✓ 삭제됨: ${table.TABLE_NAME}`);
    }
    
    // 외래키 체크 재활성화
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('\n✅ 모든 테이블이 삭제되었습니다!');
    console.log('\n이제 마이그레이션을 실행하세요:');
    console.log('cd packages/backend && node src/database/migrations/001_initial_schema.js');
    
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
resetDatabase().catch(console.error);
