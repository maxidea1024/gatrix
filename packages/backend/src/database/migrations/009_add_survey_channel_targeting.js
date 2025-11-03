/**
 * Migration: Add channel and inverted targeting fields to surveys table
 *
 * Note: This migration is a no-op because g_surveys table already has all targeting fields
 * (targetChannelSubchannels, targetChannelSubchannelsInverted, targetPlatformsInverted, targetWorldsInverted)
 * from the initial schema or earlier migrations.
 */

exports.up = async function(connection) {
  console.log('Skipping: g_surveys table already has channel targeting and inverted fields');
  // No-op: columns already exist
};

exports.down = async function(connection) {
  console.log('Skipping rollback: no changes were made in this migration');
  // No-op: nothing to rollback
};

