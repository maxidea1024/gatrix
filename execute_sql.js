const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: './packages/backend/.env' });

async function executeSqlFile() {
  try {
    // 데이터베이스 연결
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'motif_dev',
      password: process.env.DB_PASSWORD || 'dev123$',
      database: process.env.DB_NAME || 'uwo_gate',
      port: process.env.DB_PORT || 3306
    });

    console.log('데이터베이스에 연결되었습니다.');

    // SQL 파일 읽기
    const sqlContent = fs.readFileSync('../../insert_additional_users.sql', 'utf8');
    
    // 주석 제거 및 쿼리 분리
    const queries = sqlContent
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim() !== '')
      .join('\n')
      .split(';')
      .filter(query => query.trim() !== '');

    console.log(`${queries.length}개의 쿼리를 실행합니다...`);

    // 각 쿼리 실행
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i].trim();
      if (query) {
        try {
          const [result] = await connection.execute(query);
          console.log(`쿼리 ${i + 1} 실행 완료: ${result.affectedRows}개 행 영향받음`);
        } catch (error) {
          console.error(`쿼리 ${i + 1} 실행 실패:`, error.message);
        }
      }
    }

    // 연결 종료
    await connection.end();
    console.log('데이터베이스 연결이 종료되었습니다.');

    // 결과 확인
    const checkConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gatrix',
      port: process.env.DB_PORT || 3306
    });

    const [rows] = await checkConnection.execute('SELECT COUNT(*) as count FROM g_users WHERE role = "user"');
    console.log(`현재 데이터베이스에 ${rows[0].count}명의 사용자가 있습니다.`);

    await checkConnection.end();

  } catch (error) {
    console.error('오류 발생:', error.message);
    process.exit(1);
  }
}

executeSqlFile();
