/**
 * Migration to rename g_vars table columns
 * key -> varKey, value -> varValue
 */

const mysql = require('mysql2/promise');

async function up(connection) {
  console.log('Running migration: Rename g_vars columns (key -> varKey, value -> varValue)');

  try {
    // Check if the table exists
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_vars'
    `);

    if (tables.length === 0) {
      console.log('g_vars table does not exist, skipping migration');
      return;
    }

    // Check if columns already have the new names
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'g_vars' 
        AND COLUMN_NAME IN ('varKey', 'varValue')
    `);

    if (columns.length === 2) {
      console.log('Columns already renamed, skipping migration');
      return;
    }

    // Check if old columns exist
    const [oldColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'g_vars' 
        AND COLUMN_NAME IN ('key', 'value')
    `);

    if (oldColumns.length === 0) {
      console.log('Old columns do not exist, skipping migration');
      return;
    }

    // Rename columns
    if (oldColumns.some(col => col.COLUMN_NAME === 'key')) {
      await connection.execute(`
        ALTER TABLE g_vars 
        CHANGE COLUMN \`key\` varKey VARCHAR(255) NOT NULL UNIQUE
      `);
      console.log('Renamed column: key -> varKey');
    }

    if (oldColumns.some(col => col.COLUMN_NAME === 'value')) {
      await connection.execute(`
        ALTER TABLE g_vars 
        CHANGE COLUMN \`value\` varValue TEXT NULL
      `);
      console.log('Renamed column: value -> varValue');
    }

    // Update index name if it exists
    try {
      await connection.execute(`
        ALTER TABLE g_vars 
        DROP INDEX idx_key
      `);
      console.log('Dropped old index: idx_key');
    } catch (error) {
      // Index might not exist, ignore error
    }

    try {
      await connection.execute(`
        ALTER TABLE g_vars 
        ADD INDEX idx_varKey (varKey)
      `);
      console.log('Added new index: idx_varKey');
    } catch (error) {
      // Index might already exist, ignore error
    }

    console.log('Successfully renamed g_vars columns');

  } catch (error) {
    console.error('Error renaming g_vars columns:', error);
    throw error;
  }
}

async function down(connection) {
  console.log('Rolling back migration: Rename g_vars columns (varKey -> key, varValue -> value)');
  
  try {
    // Check if the table exists
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_vars'
    `);

    if (tables.length === 0) {
      console.log('g_vars table does not exist, skipping rollback');
      return;
    }

    // Rename columns back
    await connection.execute(`
      ALTER TABLE g_vars 
      CHANGE COLUMN varKey \`key\` VARCHAR(255) NOT NULL UNIQUE
    `);

    await connection.execute(`
      ALTER TABLE g_vars 
      CHANGE COLUMN varValue \`value\` TEXT NULL
    `);

    // Update index
    try {
      await connection.execute(`
        ALTER TABLE g_vars 
        DROP INDEX idx_varKey
      `);
    } catch (error) {
      // Index might not exist, ignore error
    }

    try {
      await connection.execute(`
        ALTER TABLE g_vars 
        ADD INDEX idx_key (\`key\`)
      `);
    } catch (error) {
      // Index might already exist, ignore error
    }

    console.log('Successfully rolled back g_vars column names');

  } catch (error) {
    console.error('Error rolling back g_vars column names:', error);
    throw error;
  }
}

module.exports = { up, down };

// 스크립트 직접 실행
if (require.main === module) {
  async function runMigration() {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gatrix'
    });

    try {
      await up(connection);
    } catch (error) {
      console.error('Migration failed:', error);
    } finally {
      await connection.end();
    }
  }

  runMigration().catch(console.error);
}
