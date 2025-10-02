const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkTables() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate'
  });

  try {
    console.log('Checking Remote Config tables...');
    
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE 'g_remote_config_%'
    `, [process.env.DB_NAME || 'uwo_gate']);
    
    console.log('Remote Config tables:');
    for (const table of tables) {
      console.log(`- ${table.TABLE_NAME}`);
    }
    
    if (tables.length > 0) {
      console.log('\nChecking segments table structure:');
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'g_remote_config_segments'
        ORDER BY ORDINAL_POSITION
      `, [process.env.DB_NAME || 'uwo_gate']);
      
      console.log('Segments table columns:');
      for (const col of columns) {
        console.log(`- ${col.COLUMN_NAME}: ${col.DATA_TYPE} (nullable: ${col.IS_NULLABLE})`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkTables();
