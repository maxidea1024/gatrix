require('dotenv').config();
const mysql = require('mysql2/promise');
const crypto = require('crypto');

async function createServerApiToken() {
  let connection;

  try {
    console.log('🔧 Creating Server API Token...\n');

    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'motif_dev',
      password: process.env.DB_PASSWORD || 'dev123$',
      database: process.env.DB_NAME || 'uwo_gate',
    });

    console.log('✅ Database connected\n');

    // Generate a secure token
    const tokenValue = crypto.randomBytes(32).toString('hex');
    const now = new Date();

    // Insert server API token directly into database
    const insertQuery = `
      INSERT INTO g_api_access_tokens (
        tokenName, tokenType, tokenHash, description,
        createdBy, usageCount, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await connection.execute(insertQuery, [
      'Chat Server API Token',
      'server',
      tokenValue,
      'API token for chat server to communicate with main backend',
      1, // Admin user ID
      0, // Initial usage count
      now,
      now,
    ]);

    console.log('✅ Server API Token created successfully!');
    console.log('📋 Token Details:');
    console.log(`   ID: ${result.insertId}`);
    console.log(`   Name: Chat Server API Token`);
    console.log(`   Type: server`);
    console.log(`   Token: ${tokenValue}`);
    console.log(`   Created: ${now.toISOString()}`);
    console.log('');

    console.log('🔧 Environment Variable Setup:');
    console.log('Add this to your chat-server .env file:');
    console.log(`GATRIX_API_SECRET=${tokenValue}`);
    console.log('');

    console.log('🔧 Configuration Update:');
    console.log('Make sure your chat-server config uses X-API-Token header');
    console.log('');
  } catch (error) {
    console.error('❌ Error creating server API token:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

// Run if called directly
if (require.main === module) {
  createServerApiToken();
}

module.exports = { createServerApiToken };
