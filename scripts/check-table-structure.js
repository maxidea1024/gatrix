const mysql = require('mysql2/promise');
require('dotenv').config({ path: './packages/backend/.env' });

async function checkTableStructure() {
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
    
    // g_account_whitelist 테이블 구조 확인
    console.log('\n=== g_account_whitelist 테이블 구조 ===');
    const [accountWhitelistColumns] = await connection.execute('DESCRIBE g_account_whitelist');
    console.table(accountWhitelistColumns);
    
    // g_ip_whitelist 테이블 구조 확인
    console.log('\n=== g_ip_whitelist 테이블 구조 ===');
    const [ipWhitelistColumns] = await connection.execute('DESCRIBE g_ip_whitelist');
    console.table(ipWhitelistColumns);
    
    // 샘플 데이터 확인
    console.log('\n=== g_account_whitelist 샘플 데이터 (첫 3개) ===');
    const [accountSamples] = await connection.execute('SELECT * FROM g_account_whitelist LIMIT 3');
    console.table(accountSamples);
    
    console.log('\n=== g_ip_whitelist 샘플 데이터 (첫 3개) ===');
    const [ipSamples] = await connection.execute('SELECT * FROM g_ip_whitelist LIMIT 3');
    console.table(ipSamples);
    
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n데이터베이스 연결 종료');
    }
  }
}

// 스크립트 실행
checkTableStructure().catch(console.error);
