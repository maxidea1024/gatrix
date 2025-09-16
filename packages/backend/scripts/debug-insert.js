require('dotenv').config();
const mysql = require('mysql2/promise');
const crypto = require('crypto');

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gatrix_admin',
  port: process.env.DB_PORT || 3306
};

async function debugInsert() {
  const connection = await mysql.createConnection(config);
  
  try {
    console.log('🔍 Debugging insert statement...');
    
    // Test data
    const tokenName = 'Test Token';
    const description = 'Test Description';
    const tokenValue = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');
    const tokenType = 'client';
    const environmentId = 1;
    const expiresAt = null;
    const lastUsedAt = null;
    const createdBy = 1;
    const updatedBy = 1;
    const createdAt = new Date();
    const updatedAt = new Date();
    
    const values = [
      tokenName,
      description,
      tokenHash,
      tokenType,
      environmentId,
      expiresAt,
      lastUsedAt,
      createdBy,
      updatedBy,
      createdAt,
      updatedAt
    ];
    
    console.log('Values count:', values.length);
    console.log('Values:', values);
    
    const sql = `
      INSERT INTO g_api_access_tokens (
        tokenName, description, tokenHash, tokenType, environmentId,
        expiresAt, lastUsedAt, createdBy, updatedBy, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    console.log('SQL:', sql);
    console.log('Placeholder count:', (sql.match(/\?/g) || []).length);
    
    await connection.execute(sql, values);
    console.log('✅ Insert successful!');
    
  } catch (error) {
    console.error('❌ Insert failed:', error);
  } finally {
    await connection.end();
  }
}

debugInsert();
