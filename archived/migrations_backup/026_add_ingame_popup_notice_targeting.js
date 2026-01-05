/**
 * Migration: Add channel/subchannel targeting, user ID targeting, and inverted mode to ingame popup notices
 *
 * Note: This migration is a no-op because g_ingame_popup_notices table already has
 * all targeting columns from the initial schema or earlier migrations.
 */

exports.up = async function(connection) {
  console.log('Skipping: g_ingame_popup_notices table already has all targeting columns');
  // No-op: columns already exist
};

exports.down = async function(connection) {
  console.log('Skipping rollback: no changes were made in this migration');
  // No-op: nothing to rollback
};

