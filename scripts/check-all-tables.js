const mysql = require('mysql2/promise');
require('dotenv').config({ path: './packages/backend/.env' });

async function checkAllTables() {
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
    
    const tablesToCheck = [
      'g_users',
      'g_game_worlds', 
      'g_message_template_locales',
      'g_tag_assignments',
      'g_vars',
      'g_job_types'
    ];
    
    for (const tableName of tablesToCheck) {
      console.log(`\n=== ${tableName} 테이블 구조 ===`);
      try {
        const [columns] = await connection.execute(`DESCRIBE ${tableName}`);
        console.table(columns);
        
        // 샘플 데이터 확인
        const [sampleData] = await connection.execute(`SELECT * FROM ${tableName} LIMIT 3`);
        if (sampleData.length > 0) {
          console.log(`\n=== ${tableName} 샘플 데이터 (첫 3개) ===`);
          console.table(sampleData);
        } else {
          console.log(`\n=== ${tableName} 샘플 데이터: 데이터 없음 ===`);
        }
      } catch (error) {
        console.log(`❌ ${tableName} 테이블 확인 실패:`, error.message);
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
checkAllTables().catch(console.error);
