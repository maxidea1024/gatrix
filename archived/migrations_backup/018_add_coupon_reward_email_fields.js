/**
 * Migration: Add reward email fields to g_coupon_settings
 *
 * Note: This migration is a no-op because g_coupon_settings table already has
 * rewardEmailTitle and rewardEmailBody columns from the initial schema or earlier migrations.
 */

exports.up = async function(connection) {
  console.log('Skipping: g_coupon_settings table already has reward email fields');
  // No-op: columns already exist
};

exports.down = async function(connection) {
  console.log('Skipping rollback: no changes were made in this migration');
  // No-op: nothing to rollback
};

