require('dotenv').config();
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gatrix_admin',
  charset: 'utf8mb4',
};

async function checkTokens() {
  const connection = await mysql.createConnection(config);

  try {
    // Count total tokens
    const [countResult] = await connection.execute(
      'SELECT COUNT(*) as total FROM g_api_access_tokens'
    );
    console.log(`Total API tokens: ${countResult[0].total}`);

    // Count by type
    const [typeResult] = await connection.execute(`
      SELECT tokenType, COUNT(*) as count
      FROM g_api_access_tokens
      GROUP BY tokenType
    `);
    console.log('\nTokens by type:');
    typeResult.forEach((row) => {
      console.log(`  ${row.tokenType}: ${row.count}`);
    });

    // Count by status
    const [statusResult] = await connection.execute(`
      SELECT isActive, COUNT(*) as count
      FROM g_api_access_tokens
      GROUP BY isActive
    `);
    console.log('\nTokens by status:');
    statusResult.forEach((row) => {
      console.log(`  ${row.isActive ? 'Active' : 'Inactive'}: ${row.count}`);
    });

    // Show sample tokens
    const [sampleResult] = await connection.execute(`
      SELECT tokenName, tokenType, isActive, createdAt
      FROM g_api_access_tokens
      ORDER BY createdAt DESC
      LIMIT 10
    `);
    console.log('\nSample tokens (latest 10):');
    sampleResult.forEach((row) => {
      console.log(
        `  ${row.tokenName} (${row.tokenType}) - ${row.isActive ? 'Active' : 'Inactive'} - ${row.createdAt}`
      );
    });
  } catch (error) {
    console.error('Error checking tokens:', error);
  } finally {
    await connection.end();
  }
}

checkTokens();
