/**
 * Migration: Remove marketTypes KV item
 *
 * Note: This migration is a no-op because marketTypes KV item is not created
 * in the initial schema, so there's nothing to remove.
 */

exports.up = async function(connection) {
  console.log('Skipping: marketTypes KV item not present in initial schema');
  // No-op: nothing to remove
};

exports.down = async function(connection) {
  console.log('Skipping rollback: no changes were made in this migration');
  // No-op: nothing to rollback
};

