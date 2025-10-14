const mysql = require('mysql2/promise');

async function createApiTokensTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'gatrix_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'gatrix'
  });
  
  try {
    console.log('🔧 Creating g_api_access_tokens table...\n');
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS g_api_access_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tokenName VARCHAR(255) NOT NULL,
        description TEXT NULL,
        tokenHash VARCHAR(255) NOT NULL UNIQUE,
        tokenType ENUM('client', 'server') NOT NULL,
        environmentId INT NULL,
        expiresAt TIMESTAMP NULL,
        lastUsedAt TIMESTAMP NULL,
        usageCount BIGINT DEFAULT 0,
        createdBy INT NOT NULL,
        updatedBy INT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        CONSTRAINT fk_api_token_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id),
        CONSTRAINT fk_api_token_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id),
        
        INDEX idx_token_type (tokenType),
        INDEX idx_created_by (createdBy),
        INDEX idx_created_at (createdAt),
        INDEX idx_last_used_at (lastUsedAt),
        INDEX idx_expires_at (expiresAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ g_api_access_tokens table created successfully\n');
    
    // Show table structure
    const [columns] = await connection.execute('DESCRIBE g_api_access_tokens');
    console.log('📋 Table structure:');
    columns.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key ? `(${col.Key})` : ''}`);
    });
    
  } catch (error) {
    console.error('❌ Error creating table:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

createApiTokensTable();

