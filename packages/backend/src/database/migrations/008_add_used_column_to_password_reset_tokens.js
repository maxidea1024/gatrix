const mysql = require('mysql2/promise');

/**
 * Migration: Add 'used' column to g_password_reset_tokens table
 * - Adds used BOOLEAN column with default FALSE
 * - Updates existing records based on usedAt column
 * - Adds index for better performance
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
    console.log('Adding used column to g_password_reset_tokens table...');

    // Add used column
    await connection.execute(`
      ALTER TABLE g_password_reset_tokens 
      ADD COLUMN used BOOLEAN NOT NULL DEFAULT FALSE
    `);

    console.log('✓ Added used column to g_password_reset_tokens table');

    // Update existing records: set used = TRUE where usedAt is not null
    await connection.execute(`
      UPDATE g_password_reset_tokens 
      SET used = TRUE 
      WHERE usedAt IS NOT NULL
    `);

    console.log('✓ Updated existing records based on usedAt column');

    // Add index for better performance
    await connection.execute(`
      ALTER TABLE g_password_reset_tokens 
      ADD INDEX idx_used (used)
    `);

    console.log('✓ Added index for used column');

    console.log('✅ Successfully added used column to g_password_reset_tokens table');

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
    console.log('Removing used column from g_password_reset_tokens table...');

    // Remove index first
    await connection.execute(`
      ALTER TABLE g_password_reset_tokens 
      DROP INDEX idx_used
    `);

    console.log('✓ Removed index for used column');

    // Remove column
    await connection.execute(`
      ALTER TABLE g_password_reset_tokens 
      DROP COLUMN used
    `);

    console.log('✓ Removed used column from g_password_reset_tokens table');

    console.log('✅ Successfully removed used column from g_password_reset_tokens table');

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
