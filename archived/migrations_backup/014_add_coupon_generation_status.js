/**
 * Migration: Add coupon generation status tracking
 *
 * Note: This migration is a no-op because g_coupon_settings table already has
 * generationStatus, generatedCount, totalCount, and generationJobId columns
 * from the initial schema or earlier migrations.
 */

exports.up = async function(connection) {
  console.log('Skipping: g_coupon_settings table already has generation status columns');
  // No-op: columns already exist
};

exports.down = async function(connection) {
  console.log('Skipping rollback: no changes were made in this migration');
  // No-op: nothing to rollback
};

