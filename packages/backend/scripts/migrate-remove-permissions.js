const mysql = require('mysql2/promise');

const config = {
  host: 'localhost',
  user: 'motif_dev',
  password: 'dev123$',
  database: 'uwo_gate',
};

async function runMigration() {
  const connection = await mysql.createConnection(config);

  try {
    console.log('Starting migration: Remove permissions column and admin token type...');

    // Check if permissions column exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'uwo_gate'
      AND TABLE_NAME = 'g_api_access_tokens'
      AND COLUMN_NAME = 'permissions'
    `);

    if (columns.length > 0) {
      console.log('Removing permissions column...');
      await connection.execute('ALTER TABLE g_api_access_tokens DROP COLUMN permissions');
      console.log('✅ Permissions column removed');
    } else {
      console.log('⚠️ Permissions column already removed');
    }

    // First, update any admin tokens to server tokens
    console.log('Converting admin tokens to server tokens...');
    const [updateResult] = await connection.execute(`
      UPDATE g_api_access_tokens
      SET tokenType = 'server'
      WHERE tokenType = 'admin'
    `);
    console.log(`✅ Converted ${updateResult.affectedRows} admin tokens to server tokens`);

    // Update token type enum to remove 'admin'
    console.log('Updating token type enum...');
    await connection.execute(`
      ALTER TABLE g_api_access_tokens
      MODIFY COLUMN tokenType ENUM('client', 'server') NOT NULL
    `);
    console.log('✅ Token type enum updated');

    // Drop old table if exists
    console.log('Dropping old g_remote_config_api_tokens table...');
    await connection.execute('DROP TABLE IF EXISTS g_remote_config_api_tokens');
    console.log('✅ Old table dropped');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

runMigration().catch(console.error);
