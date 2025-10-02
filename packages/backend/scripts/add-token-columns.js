require('dotenv').config();
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gatrix_admin',
  charset: 'utf8mb4'
};

async function addTokenColumns() {
  const connection = await mysql.createConnection(config);
  
  try {
    console.log('Adding description and updatedBy columns to g_api_access_tokens...');
    
    // Check if columns already exist
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'g_api_access_tokens'
    `, [config.database]);
    
    const existingColumns = columns.map(col => col.COLUMN_NAME);
    console.log('Existing columns:', existingColumns);
    
    // Add description column if it doesn't exist
    if (!existingColumns.includes('description')) {
      await connection.execute(`
        ALTER TABLE g_api_access_tokens 
        ADD COLUMN description TEXT NULL AFTER tokenName
      `);
      console.log('✅ Added description column');
    } else {
      console.log('⚠️ description column already exists');
    }
    
    // Add updatedBy column if it doesn't exist
    if (!existingColumns.includes('updatedBy')) {
      await connection.execute(`
        ALTER TABLE g_api_access_tokens 
        ADD COLUMN updatedBy INT NULL AFTER createdBy,
        ADD CONSTRAINT fk_api_token_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id)
      `);
      console.log('✅ Added updatedBy column with foreign key');
    } else {
      console.log('⚠️ updatedBy column already exists');
    }
    
    // Update existing records to have updatedBy = createdBy
    const [updateResult] = await connection.execute(`
      UPDATE g_api_access_tokens 
      SET updatedBy = createdBy 
      WHERE updatedBy IS NULL
    `);
    console.log(`✅ Updated ${updateResult.affectedRows} records with updatedBy = createdBy`);
    
    // Show updated table structure
    console.log('\n📋 Updated table structure:');
    const [newColumns] = await connection.execute(`
      DESCRIBE g_api_access_tokens
    `);
    newColumns.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key ? `(${col.Key})` : ''}`);
    });
    
  } catch (error) {
    console.error('Error adding columns:', error);
  } finally {
    await connection.end();
  }
}

addTokenColumns();
