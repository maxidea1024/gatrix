const mysql = require('mysql2/promise');

/**
 * Migration: Add 'updatedAt' column to g_password_reset_tokens table
 * - Adds updatedAt TIMESTAMP column with auto-update
 * - Updates existing records with current timestamp
 */

async function up() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate'
  });

  try {
    console.log('Adding updatedAt column to g_password_reset_tokens table...');

    // Add updatedAt column
    await connection.execute(`
      ALTER TABLE g_password_reset_tokens 
      ADD COLUMN updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    `);

    console.log('✓ Added updatedAt column to g_password_reset_tokens table');

    // Update existing records with current timestamp
    await connection.execute(`
      UPDATE g_password_reset_tokens 
      SET updatedAt = createdAt 
      WHERE updatedAt IS NULL
    `);

    console.log('✓ Updated existing records with updatedAt timestamp');

    console.log('✅ Successfully added updatedAt column to g_password_reset_tokens table');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

async function down() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate'
  });

  try {
    console.log('Removing updatedAt column from g_password_reset_tokens table...');

    // Remove column
    await connection.execute(`
      ALTER TABLE g_password_reset_tokens 
      DROP COLUMN updatedAt
    `);

    console.log('✓ Removed updatedAt column from g_password_reset_tokens table');

    console.log('✅ Successfully removed updatedAt column from g_password_reset_tokens table');

  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

module.exports = { up, down };

// CLI 실행을 위한 코드
if (require.main === module) {
  up()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
