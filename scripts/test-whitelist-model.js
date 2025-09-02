const mysql = require('mysql2/promise');
require('dotenv').config({ path: './packages/backend/.env' });

// AccountWhitelist 모델을 직접 테스트
async function testWhitelistModel() {
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
    
    // AccountWhitelist.findAll과 동일한 쿼리 테스트
    console.log('\n=== 카운트 쿼리 테스트 ===');
    const countQuery = `
      SELECT COUNT(*) as total
      FROM g_account_whitelist w
      LEFT JOIN g_users u ON w.createdBy = u.id
      WHERE 1=1
    `;
    
    try {
      const [countResult] = await connection.execute(countQuery);
      console.log('카운트 결과:', countResult);
    } catch (error) {
      console.error('카운트 쿼리 오류:', error);
    }
    
    console.log('\n=== 메인 쿼리 테스트 ===');
    const mainQuery = `
      SELECT
        w.id,
        w.accountId,
        w.ipAddress,
        w.startDate,
        w.endDate,
        w.purpose,
        CAST(w.tags AS CHAR) as tags,
        w.createdBy,
        w.createdAt,
        w.updatedAt,
        u.name as createdByName,
        u.email as createdByEmail,
        1 as isActive
      FROM g_account_whitelist w
      LEFT JOIN g_users u ON w.createdBy = u.id
      WHERE 1=1
      ORDER BY w.createdAt DESC
      LIMIT 10 OFFSET 0
    `;
    
    try {
      const [mainResult] = await connection.execute(mainQuery);
      console.log('메인 쿼리 결과 (첫 3개):');
      console.table(mainResult.slice(0, 3));
      console.log(`총 ${mainResult.length}개 결과`);
    } catch (error) {
      console.error('메인 쿼리 오류:', error);
    }
    
    // JSON 파싱 테스트
    console.log('\n=== JSON 파싱 테스트 ===');
    try {
      const [jsonTestResult] = await connection.execute(
        'SELECT id, accountId, CAST(tags AS CHAR) as tags FROM g_account_whitelist WHERE tags IS NOT NULL LIMIT 3'
      );
      
      for (const row of jsonTestResult) {
        console.log(`ID ${row.id}: tags = ${row.tags}`);
        try {
          const parsed = JSON.parse(row.tags);
          console.log('  파싱 성공:', parsed);
        } catch (parseError) {
          console.error('  JSON 파싱 오류:', parseError.message);
        }
      }
    } catch (error) {
      console.error('JSON 테스트 오류:', error);
    }
    
  } catch (error) {
    console.error('❌ 전체 오류:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n데이터베이스 연결 종료');
    }
  }
}

// 스크립트 실행
testWhitelistModel().catch(console.error);
