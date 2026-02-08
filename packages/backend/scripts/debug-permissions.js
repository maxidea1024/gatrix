require('dotenv').config();
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gatrix_admin',
  charset: 'utf8mb4',
};

async function debugPermissions() {
  const connection = await mysql.createConnection(config);

  try {
    console.log('Testing direct JSON insert...');

    // Clear existing data
    await connection.execute('DELETE FROM g_api_access_tokens WHERE id > 0');

    // Test 1: Insert with proper JSON array
    console.log('\nTest 1: Inserting with JSON array string...');
    await connection.execute(
      `
      INSERT INTO g_api_access_tokens (
        tokenName, tokenHash, tokenType, environmentId, permissions,
        isActive, createdBy, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `,
      [
        'Test Token 1',
        'hash123',
        'client',
        1,
        '["read","write"]', // JSON array as string
        true,
        1,
      ]
    );

    // Test 2: Insert with JSON_ARRAY function
    console.log('Test 2: Inserting with JSON_ARRAY function...');
    await connection.execute(
      `
      INSERT INTO g_api_access_tokens (
        tokenName, tokenHash, tokenType, environmentId, permissions,
        isActive, createdBy, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, JSON_ARRAY('read', 'write', 'admin'), ?, ?, NOW(), NOW())
    `,
      ['Test Token 2', 'hash456', 'admin', null, true, 1]
    );

    // Check results
    console.log('\nChecking results...');
    const [results] = await connection.execute(`
      SELECT id, tokenName, permissions, 
             JSON_TYPE(permissions) as json_type,
             JSON_VALID(permissions) as json_valid
      FROM g_api_access_tokens
    `);

    results.forEach((row) => {
      console.log(`\nID: ${row.id}, Name: ${row.tokenName}`);
      console.log(`Permissions: ${JSON.stringify(row.permissions)}`);
      console.log(`JSON Type: ${row.json_type}`);
      console.log(`JSON Valid: ${row.json_valid}`);

      try {
        const parsed = JSON.parse(JSON.stringify(row.permissions));
        console.log(`✅ Parsed: ${JSON.stringify(parsed)}`);
      } catch (e) {
        console.log(`❌ Parse Error: ${e.message}`);
      }
    });
  } catch (error) {
    console.error('Error debugging permissions:', error);
  } finally {
    await connection.end();
  }
}

debugPermissions();
