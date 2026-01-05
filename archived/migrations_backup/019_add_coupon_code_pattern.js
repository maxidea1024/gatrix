/**
 * Migration: Add coupon code pattern support
 *
 * Note: This migration is a no-op because g_coupon_settings table already has
 * codePattern column from the initial schema or earlier migrations.
 */

exports.up = async function(connection) {
  console.log('Skipping: g_coupon_settings table already has codePattern column');
  // No-op: column already exists
};

exports.down = async function(connection) {
  console.log('Skipping rollback: no changes were made in this migration');
  // No-op: nothing to rollback
};

