/**
 * Migration: Add KV (Key-Value) support to g_vars table
 *
 * Note: This migration is a no-op because g_vars table already has valueType and isSystemDefined columns
 * from the initial schema or earlier migrations.
 */

exports.up = async function (connection) {
  console.log('Skipping: g_vars table already has KV support columns (valueType, isSystemDefined)');
  // No-op: columns already exist
};

exports.down = async function (connection) {
  console.log('Skipping rollback: no changes were made in this migration');
  // No-op: nothing to rollback
};
