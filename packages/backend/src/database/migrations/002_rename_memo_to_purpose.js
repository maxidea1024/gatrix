const mysql = require('mysql2/promise');

async function up(connection) {
  console.log('Running migration: Rename memo column to purpose in g_account_whitelist table');
  
  try {
    // Check if memo column exists and purpose column doesn't exist
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'g_account_whitelist' 
        AND COLUMN_NAME IN ('memo', 'purpose')
    `);
    
    const columnNames = columns.map(col => col.COLUMN_NAME);
    const hasMemo = columnNames.includes('memo');
    const hasPurpose = columnNames.includes('purpose');
    
    if (hasMemo && !hasPurpose) {
      // Rename memo column to purpose
      await connection.execute(`
        ALTER TABLE g_account_whitelist 
        CHANGE COLUMN memo purpose TEXT NULL
      `);
      console.log('Successfully renamed memo column to purpose');
    } else if (hasPurpose && !hasMemo) {
      console.log('Column already renamed to purpose');
    } else if (hasMemo && hasPurpose) {
      console.log('Both memo and purpose columns exist, manual intervention required');
    } else {
      console.log('Neither memo nor purpose column found, creating purpose column');
      await connection.execute(`
        ALTER TABLE g_account_whitelist 
        ADD COLUMN purpose TEXT NULL
      `);
    }
  } catch (error) {
    console.error('Error in migration:', error);
    throw error;
  }
}

async function down(connection) {
  console.log('Rolling back migration: Rename purpose column back to memo');
  
  try {
    // Check if purpose column exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'g_account_whitelist' 
        AND COLUMN_NAME = 'purpose'
    `);
    
    if (columns.length > 0) {
      // Rename purpose column back to memo
      await connection.execute(`
        ALTER TABLE g_account_whitelist 
        CHANGE COLUMN purpose memo TEXT NULL
      `);
      console.log('Successfully renamed purpose column back to memo');
    } else {
      console.log('Purpose column not found');
    }
  } catch (error) {
    console.error('Error in rollback:', error);
    throw error;
  }
}

module.exports = { up, down };
