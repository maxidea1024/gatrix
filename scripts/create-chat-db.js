const mysql = require('mysql2/promise');

async function createChatDatabase() {
  let connection;
  
  try {
    console.log('🔄 Creating chat database...');
    
    // Connect to MySQL without specifying database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'motif_dev',
      password: process.env.DB_PASSWORD || 'dev123$'
    });
    
    // Create database
    await connection.execute('CREATE DATABASE IF NOT EXISTS gatrix_chat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    console.log('✅ Chat database created successfully');
    
    // Close connection
    await connection.end();
    
  } catch (error) {
    console.error('❌ Error creating chat database:', error.message);
    process.exit(1);
  }
}

createChatDatabase();
