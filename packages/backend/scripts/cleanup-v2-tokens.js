require('dotenv').config();
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gatrix_admin',
  charset: 'utf8mb4',
};

async function cleanupV2Tokens() {
  const connection = await mysql.createConnection(config);

  try {
    console.log('Removing g_api_v2_access_tokens table...');

    // Drop the v2 table
    await connection.execute('DROP TABLE IF EXISTS g_api_v2_access_tokens');
    console.log('✅ g_api_v2_access_tokens table removed successfully');

    // Verify removal
    const [result] = await connection.execute(
      `
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = ? AND table_name = 'g_api_v2_access_tokens'
    `,
      [config.database]
    );

    console.log(`Verification: g_api_v2_access_tokens exists: ${result[0].count > 0}`);
  } catch (error) {
    console.error('Error removing v2 tokens table:', error);
  } finally {
    await connection.end();
  }
}

cleanupV2Tokens();
