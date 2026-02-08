require('dotenv').config();
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gatrix_admin',
  charset: 'utf8mb4',
};

async function fixPermissions() {
  const connection = await mysql.createConnection(config);

  try {
    console.log('Fixing permissions format...');

    // Get all tokens with invalid permissions
    const [tokens] = await connection.execute(`
      SELECT id, permissions
      FROM g_api_access_tokens
    `);

    console.log(`Found ${tokens.length} tokens to fix`);

    let fixed = 0;
    for (const token of tokens) {
      try {
        // Try to parse as JSON first
        JSON.parse(token.permissions);
        console.log(`Token ${token.id}: Already valid JSON`);
      } catch (e) {
        // Handle different data types
        let permissionsArray = [];

        if (typeof token.permissions === 'string') {
          // Convert comma-separated string to array
          permissionsArray = token.permissions
            .split(',')
            .map((p) => p.trim())
            .filter((p) => p.length > 0);
        } else if (Array.isArray(token.permissions)) {
          // Already an array
          permissionsArray = token.permissions;
        } else {
          // Default permissions
          permissionsArray = ['read'];
          console.log(`Token ${token.id}: Unknown type ${typeof token.permissions}, using default`);
        }

        const jsonPermissions = JSON.stringify(permissionsArray);

        await connection.execute('UPDATE g_api_access_tokens SET permissions = ? WHERE id = ?', [
          jsonPermissions,
          token.id,
        ]);

        console.log(`Token ${token.id}: Fixed ${typeof token.permissions} -> ${jsonPermissions}`);
        fixed++;
      }
    }

    console.log(`Fixed ${fixed} tokens`);

    // Verify the fix
    console.log('\nVerifying fixes...');
    const [verifyResult] = await connection.execute(`
      SELECT id, tokenName, permissions
      FROM g_api_access_tokens
      LIMIT 5
    `);

    verifyResult.forEach((row) => {
      try {
        const parsed = JSON.parse(row.permissions);
        console.log(`✅ Token ${row.id}: ${JSON.stringify(parsed)}`);
      } catch (e) {
        console.log(`❌ Token ${row.id}: Still invalid - ${e.message}`);
      }
    });
  } catch (error) {
    console.error('Error fixing permissions:', error);
  } finally {
    await connection.end();
  }
}

fixPermissions();
