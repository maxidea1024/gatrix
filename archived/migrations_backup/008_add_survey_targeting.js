/**
 * Migration: Add targeting fields to surveys table
 *
 * Note: This migration is a no-op because g_surveys table already has targeting fields
 * (targetPlatforms, targetWorlds, targetChannelSubchannels, etc.) from the initial schema.
 * These columns were added in 007_create_surveys or earlier migrations.
 */

exports.up = async function (connection) {
  console.log('Skipping: g_surveys table already has targeting fields');
  // No-op: columns already exist
};

exports.down = async function (connection) {
  console.log('Skipping rollback: no changes were made in this migration');
  // No-op: nothing to rollback
};
