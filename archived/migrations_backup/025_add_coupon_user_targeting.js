/**
 * Migration: Add user ID targeting support to coupon system
 *
 * Note: This migration is a no-op because g_coupon_settings table already has
 * targetUserIdsInverted column and g_coupon_target_users table already exists
 * from the initial schema (012_create_coupon_system).
 */

exports.up = async function (connection) {
  console.log('Skipping: coupon system already has user ID targeting support');
  // No-op: columns and tables already exist
};

exports.down = async function (connection) {
  console.log('Skipping rollback: no changes were made in this migration');
  // No-op: nothing to rollback
};
