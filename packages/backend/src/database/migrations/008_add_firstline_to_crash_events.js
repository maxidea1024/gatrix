/**
 * Migration: Add firstLine column to crash_events table
 * 
 * Adds firstLine field to store the first line of the callstack
 */

exports.up = async function(connection) {
  console.log('Adding firstLine column to crash_events table...');

  // Add firstLine column
  await connection.execute(`
    ALTER TABLE crash_events
    ADD COLUMN firstLine VARCHAR(200) NULL COMMENT 'First line of stack trace' AFTER crashId
  `);

  console.log('✓ Added firstLine column to crash_events table');

  // Add index for searching
  await connection.execute(`
    ALTER TABLE crash_events
    ADD INDEX idx_firstLine (firstLine)
  `);

  console.log('✓ Added index on firstLine column');
};

exports.down = async function(connection) {
  console.log('Rolling back firstLine column from crash_events table...');

  // Drop index first
  await connection.execute(`
    ALTER TABLE crash_events
    DROP INDEX idx_firstLine
  `);

  console.log('✓ Dropped index on firstLine column');

  // Drop column
  await connection.execute(`
    ALTER TABLE crash_events
    DROP COLUMN firstLine
  `);

  console.log('✓ Dropped firstLine column from crash_events table');
};

