/**
 * Migration 028: Update surveys targeting fields
 *
 * Note: This migration is a no-op because g_surveys table already has
 * targetChannels, targetChannelsInverted, targetSubchannels, and targetSubchannelsInverted
 * columns from the initial schema or earlier migrations.
 */

async function up(pool) {
  console.log('Skipping: g_surveys table already has all targeting fields');
  // No-op: columns already exist
}

async function down(pool) {
  console.log('Skipping rollback: no changes were made in this migration');
  // No-op: nothing to rollback
}

module.exports = { up, down };

