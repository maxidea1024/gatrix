const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function migrate() {
  let connection;

  try {
    console.log('🚀 Starting MySQL migrations...');

    // MySQL 연결
    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER || 'gatrix_user',
      password: process.env.MYSQL_PASSWORD || 'gatrix_password',
      database: process.env.MYSQL_DATABASE || 'gatrix',
      multipleStatements: true,
    });

    console.log('✅ MySQL connected');

    // 마이그레이션 파일 읽기
    const migrationsDir = path.join(__dirname, '../migrations/mysql');
    const files = fs.readdirSync(migrationsDir).sort();

    for (const file of files) {
      if (!file.endsWith('.sql')) continue;

      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await connection.query(sql);
      console.log(`✅ ${file} completed`);
    }

    console.log('✅ All MySQL migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrate();

