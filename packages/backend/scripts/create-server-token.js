const crypto = require('crypto');
const mysql = require('mysql2/promise');

async function createServerToken() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gatrix',
  });

  try {
    // Generate a secure token
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Insert the token into the database
    const [result] = await connection.execute(
      `INSERT INTO api_tokens (
        tokenName, 
        tokenType, 
        hashedToken, 
        permissions, 
        isActive, 
        createdBy, 
        createdAt, 
        updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        'Chat Server Token',
        'server',
        hashedToken,
        JSON.stringify([
          'server:auth:verify',
          'server:users:read',
          'server:notifications:send',
          'server:files:upload',
          'server:chat:manage',
        ]),
        1,
        1, // Assuming admin user ID is 1
      ]
    );

    console.log('✅ Server SDK Token created successfully!');
    console.log('Token ID:', result.insertId);
    console.log('Token:', token);
    console.log('');
    console.log('Add this to your chat server .env file:');
    console.log(`GATRIX_API_SECRET=${token}`);
    console.log('');
    console.log('⚠️  Keep this token secure and do not share it!');
  } catch (error) {
    console.error('❌ Failed to create server token:', error);
  } finally {
    await connection.end();
  }
}

createServerToken();
