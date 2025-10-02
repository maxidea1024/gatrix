require('dotenv').config();
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gatrix_admin',
  charset: 'utf8mb4'
};

async function checkTables() {
  const connection = await mysql.createConnection(config);
  
  try {
    console.log('Checking API token tables...');
    
    // Check if g_api_access_tokens exists
    const [apiTokensResult] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = ? AND table_name = 'g_api_access_tokens'
    `, [config.database]);
    
    console.log(`g_api_access_tokens exists: ${apiTokensResult[0].count > 0}`);
    
    // Check if g_api_v2_access_tokens exists
    const [apiV2TokensResult] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = ? AND table_name = 'g_api_v2_access_tokens'
    `, [config.database]);
    
    console.log(`g_api_v2_access_tokens exists: ${apiV2TokensResult[0].count > 0}`);
    
    // If g_api_access_tokens exists, show its structure
    if (apiTokensResult[0].count > 0) {
      console.log('\ng_api_access_tokens structure:');
      const [columns] = await connection.execute(`
        DESCRIBE g_api_access_tokens
      `);
      columns.forEach(col => {
        console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key ? `(${col.Key})` : ''}`);
      });
      
      // Check data count
      const [countResult] = await connection.execute('SELECT COUNT(*) as count FROM g_api_access_tokens');
      console.log(`  Records: ${countResult[0].count}`);
    }
    
    // If g_api_v2_access_tokens exists, show its structure and data count
    if (apiV2TokensResult[0].count > 0) {
      console.log('\ng_api_v2_access_tokens structure:');
      const [columns] = await connection.execute(`
        DESCRIBE g_api_v2_access_tokens
      `);
      columns.forEach(col => {
        console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key ? `(${col.Key})` : ''}`);
      });
      
      // Check data count
      const [countResult] = await connection.execute('SELECT COUNT(*) as count FROM g_api_v2_access_tokens');
      console.log(`  Records: ${countResult[0].count}`);
    }
    
  } catch (error) {
    console.error('Error checking tables:', error);
  } finally {
    await connection.end();
  }
}

checkTables();
