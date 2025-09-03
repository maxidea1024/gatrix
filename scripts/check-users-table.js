const mysql = require('mysql2/promise');
require('dotenv').config({ path: './packages/backend/.env' });

async function checkUsersTable() {
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
    
    // g_users 테이블 구조 확인
    console.log('\n=== g_users 테이블 구조 ===');
    const [usersColumns] = await connection.execute('DESCRIBE g_users');
    console.table(usersColumns);
    
    // g_account_whitelist의 createdBy 필드 타입 확인
    console.log('\n=== g_account_whitelist 테이블 구조 ===');
    const [whitelistColumns] = await connection.execute('DESCRIBE g_account_whitelist');
    console.table(whitelistColumns);
    
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
checkUsersTable().catch(console.error);
