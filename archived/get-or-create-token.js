const mysql = require('mysql2/promise');
const crypto = require('crypto');

async function getOrCreateClientToken() {
  let connection;

  try {
    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_NAME || 'gatrix',
    });

    console.log('✅ Connected to database\n');

    // Check for existing client tokens
    const [tokens] = await connection.execute(
      'SELECT id, tokenName, tokenHash, tokenType, createdAt FROM g_api_access_tokens WHERE tokenType = ? LIMIT 5',
      ['client']
    );

    if (tokens.length > 0) {
      console.log('📋 Existing client tokens:');
      console.log('='.repeat(80));
      tokens.forEach((token, index) => {
        console.log(`${index + 1}. Token Name: ${token.tokenName}`);
        console.log(`   Token: ${token.tokenHash}`);
        console.log(`   Created: ${token.createdAt}`);
        console.log('-'.repeat(80));
      });

      console.log('\n✨ Use one of the above tokens in your script!');
      console.log(`\nExample: const API_TOKEN = '${tokens[0].tokenHash}';`);

      return tokens[0].tokenHash;
    } else {
      console.log('⚠️  No client tokens found. Creating a new one...\n');

      // Get first user ID for createdBy
      const [users] = await connection.execute('SELECT id FROM g_users LIMIT 1');

      if (users.length === 0) {
        console.error('❌ No users found in database. Please create a user first.');
        return null;
      }

      const userId = users[0].id;

      // Generate new token
      const tokenValue = crypto.randomBytes(32).toString('hex');
      const tokenName = 'Test Client Token';

      // Insert new token
      await connection.execute(
        `INSERT INTO g_api_access_tokens 
        (tokenName, description, tokenHash, tokenType, createdBy, updatedBy, createdAt, updatedAt) 
        VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [tokenName, 'Auto-generated token for testing', tokenValue, 'client', userId, userId]
      );

      console.log('✅ New client token created!');
      console.log('='.repeat(80));
      console.log(`Token Name: ${tokenName}`);
      console.log(`Token: ${tokenValue}`);
      console.log('='.repeat(80));
      console.log(`\nUse this token in your script:`);
      console.log(`const API_TOKEN = '${tokenValue}';`);

      return tokenValue;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Make sure MySQL is running and the connection details are correct.');
    }
    return null;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the script
getOrCreateClientToken()
  .then((token) => {
    if (token) {
      console.log('\n✨ Done!');
    } else {
      console.log('\n❌ Failed to get or create token.');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
