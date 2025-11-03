/**
 * Migration: Rename columns nameKey -> name, descriptionKey -> description in g_coupon_settings
 * Notes:
 * - This migration is a no-op because g_coupon_settings was already created with name and description columns
 * - The 012_create_coupon_system migration already uses the correct column names
 * - Keep camelCase per convention
 * - MySQL DATETIME unaffected
 */

exports.up = async function(connection) {
  console.log('Skipping: g_coupon_settings already has correct column names (name, description)');
  // No-op: columns already exist with correct names from 012_create_coupon_system
};

exports.down = async function(connection) {
  console.log('Skipping rollback: no changes were made in this migration');
  // No-op: nothing to rollback
};

