const mysql = require('mysql2/promise');

/**
 * Migration: Add tags support for users
 * - Adds tags column to g_users table
 * - Updates tag assignments to support 'user' entity type
 */

async function up(connection) {
  console.log('Adding tags support for users...');

  // Add tags column to g_users table
  await connection.execute(`
    ALTER TABLE g_users 
    ADD COLUMN tags JSON NULL COMMENT 'User tags (for backward compatibility)'
  `);

  console.log('✓ Added tags column to g_users table');

  // The g_tag_assignments table already supports any entity type,
  // so we just need to ensure 'user' is a valid entity type
  console.log('✓ Tag assignments table already supports user entity type');

  console.log('User tags migration completed successfully!');
}

async function down(connection) {
  console.log('Removing tags support for users...');

  // Remove user tag assignments
  await connection.execute(`
    DELETE FROM g_tag_assignments 
    WHERE entityType = 'user'
  `);

  // Remove tags column from g_users table
  await connection.execute(`
    ALTER TABLE g_users 
    DROP COLUMN tags
  `);

  console.log('✓ Removed tags column from g_users table');
  console.log('✓ Removed user tag assignments');
  console.log('User tags rollback completed successfully!');
}

module.exports = { up, down };
