/**
 * Migration: Add authentication type field to g_users table
 * Adds authType field to track how users authenticate (local, google, github, qq)
 */

const mysql = require('mysql2/promise');

async function up() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate'
  });

  try {
    console.log('Adding authType field to g_users table...');

    // Add authType column
    await connection.execute(`
      ALTER TABLE g_users
      ADD COLUMN authType VARCHAR(50) NOT NULL DEFAULT 'local'
      AFTER status
    `);

    // Add index for authType
    await connection.execute(`
      ALTER TABLE g_users 
      ADD INDEX idx_auth_type (authType)
    `);

    // Update existing users based on their authentication method
    // Users with passwordHash are local users
    await connection.execute(`
      UPDATE g_users 
      SET authType = 'local' 
      WHERE passwordHash IS NOT NULL
    `);

    // Check if there are any OAuth users and update them
    // This is a best-effort update based on email patterns or existing OAuth data
    await connection.execute(`
      UPDATE g_users 
      SET authType = 'github' 
      WHERE passwordHash IS NULL AND email LIKE '%@github.local'
    `);

    console.log('✅ Successfully added authType field to g_users table');

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
    console.log('Removing authType field from g_users table...');

    // Remove index first
    await connection.execute(`
      ALTER TABLE g_users 
      DROP INDEX idx_auth_type
    `);

    // Remove column
    await connection.execute(`
      ALTER TABLE g_users 
      DROP COLUMN authType
    `);

    console.log('✅ Successfully removed authType field from g_users table');

  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

module.exports = { up, down };

// Run migration if called directly
if (require.main === module) {
  up().then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  }).catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}
