require('dotenv').config();
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gatrix_admin',
  port: process.env.DB_PORT || 3306,
};

async function checkTableStructure() {
  const connection = await mysql.createConnection(config);

  try {
    console.log('📋 Checking g_api_access_tokens table structure...');

    const [result] = await connection.execute('DESCRIBE g_api_access_tokens');
    console.log('\nTable structure:');
    console.log('================');
    result.forEach((col) => {
      console.log(
        `${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key ? `(${col.Key})` : ''}`
      );
    });
  } catch (error) {
    console.error('Error checking table structure:', error);
  } finally {
    await connection.end();
  }
}

checkTableStructure();
