/**
 * Migration 028: Update surveys targeting fields
 * Replace targetChannelSubchannels with targetChannels and targetSubchannels
 */

const mysql = require('mysql2/promise');

async function up(pool) {
  console.log('Running migration 028: Update surveys targeting fields');

  try {
    // Add new columns
    await pool.execute(`
      ALTER TABLE g_surveys
      ADD COLUMN targetChannels JSON NULL AFTER targetPlatformsInverted,
      ADD COLUMN targetChannelsInverted TINYINT(1) NOT NULL DEFAULT 0 AFTER targetChannels,
      ADD COLUMN targetSubchannels JSON NULL AFTER targetChannelsInverted,
      ADD COLUMN targetSubchannelsInverted TINYINT(1) NOT NULL DEFAULT 0 AFTER targetSubchannels
    `);

    console.log('Migration 028 completed successfully');
  } catch (error) {
    console.error('Migration 028 failed:', error);
    throw error;
  }
}

async function down(pool) {
  console.log('Rolling back migration 028: Update surveys targeting fields');

  try {
    // Remove new columns
    await pool.execute(`
      ALTER TABLE g_surveys
      DROP COLUMN targetChannels,
      DROP COLUMN targetChannelsInverted,
      DROP COLUMN targetSubchannels,
      DROP COLUMN targetSubchannelsInverted
    `);

    console.log('Migration 028 rollback completed successfully');
  } catch (error) {
    console.error('Migration 028 rollback failed:', error);
    throw error;
  }
}

module.exports = { up, down };

