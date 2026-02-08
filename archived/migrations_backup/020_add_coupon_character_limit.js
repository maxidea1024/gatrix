/**
 * Migration: Add character-level coupon usage limit support
 *
 * Note: This migration is a no-op because g_coupon_settings and g_coupon_uses tables
 * already have usageLimitType and characterId columns from the initial schema or earlier migrations.
 */

exports.up = async function (connection) {
  console.log('Skipping: coupon tables already have character-level usage limit support');
  // No-op: columns already exist
};

exports.down = async function (connection) {
  console.log('Skipping rollback: no changes were made in this migration');
  // No-op: nothing to rollback
};
