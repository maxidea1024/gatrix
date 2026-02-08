/**
 * Migration: Add platforms and channels system-defined KV items
 *
 * Note: This migration is a no-op because platforms and channels KV items
 * are already created in the initial schema or earlier migrations.
 */

exports.up = async function (connection) {
  console.log('Skipping: platforms and channels KV items already exist');
  // No-op: KV items already exist
};

exports.down = async function (connection) {
  console.log('Skipping rollback: no changes were made in this migration');
  // No-op: nothing to rollback
};
