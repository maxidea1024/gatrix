require('dotenv').config();
const mysql = require('mysql2/promise');

async function removeIsActiveColumn() {
  let connection;

  try {
    console.log('데이터베이스 연결 중...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'motif_dev',
      password: process.env.DB_PASSWORD || 'dev123$',
      database: process.env.DB_NAME || 'uwo_gate',
    });
    console.log('데이터베이스 연결 성공!');

    console.log('Starting migration: Remove isActive column from g_api_access_tokens...');

    // Check if isActive column exists
    console.log('Checking if isActive column exists...');
    const [columns] = await connection.execute(
      `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'g_api_access_tokens' AND COLUMN_NAME = 'isActive'
    `,
      [process.env.DB_NAME || 'uwo_gate']
    );

    if (columns.length === 0) {
      console.log('✅ isActive column does not exist, nothing to do');
      return;
    }

    // Remove isActive column
    console.log('Removing isActive column...');
    await connection.execute(`
      ALTER TABLE g_api_access_tokens 
      DROP COLUMN isActive
    `);
    console.log('✅ isActive column removed');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('데이터베이스 연결 종료');
    }
  }
}

// Run migration
removeIsActiveColumn().catch(console.error);
