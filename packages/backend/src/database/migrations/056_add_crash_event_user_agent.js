/**
 * Migration: Add crashEventUserAgent column to crash_events table
 * 
 * Adds crashEventUserAgent field to store the user agent of the crash reporter
 */

exports.up = async function(connection) {
  console.log('Adding crashEventUserAgent column to crash_events table...');

  // Add crashEventUserAgent column
  await connection.execute(`
    ALTER TABLE crash_events
    ADD COLUMN crashEventUserAgent VARCHAR(500) NULL COMMENT 'User agent of crash reporter' AFTER crashEventIp
  `);

  console.log('✓ Added crashEventUserAgent column to crash_events table');
};

exports.down = async function(connection) {
  console.log('Rolling back crashEventUserAgent column from crash_events table...');

  // Drop column
  await connection.execute(`
    ALTER TABLE crash_events
    DROP COLUMN crashEventUserAgent
  `);

  console.log('✓ Dropped crashEventUserAgent column from crash_events table');
};

