require('dotenv').config();
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gatrix_admin',
  charset: 'utf8mb4'
};

async function checkPermissions() {
  const connection = await mysql.createConnection(config);
  
  try {
    // Check sample permissions data
    const [result] = await connection.execute(`
      SELECT id, tokenName, permissions 
      FROM g_api_v2_access_tokens 
      LIMIT 5
    `);
    
    console.log('Sample permissions data:');
    result.forEach(row => {
      console.log(`ID: ${row.id}, Name: ${row.tokenName}`);
      console.log(`Permissions: "${row.permissions}"`);
      console.log(`Type: ${typeof row.permissions}`);
      try {
        const parsed = JSON.parse(row.permissions);
        console.log(`Parsed: ${JSON.stringify(parsed)}`);
      } catch (e) {
        console.log(`Parse Error: ${e.message}`);
      }
      console.log('---');
    });
    
  } catch (error) {
    console.error('Error checking permissions:', error);
  } finally {
    await connection.end();
  }
}

checkPermissions();
