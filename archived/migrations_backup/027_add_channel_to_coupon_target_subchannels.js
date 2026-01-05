/**
 * Migration: Add channel column to g_coupon_target_subchannels
 *
 * Note: This migration is a no-op because g_coupon_target_subchannels table already has
 * channel column from the initial schema or earlier migrations.
 */

module.exports = {
  async up(connection) {
    console.log('Skipping: g_coupon_target_subchannels table already has channel column');
    // No-op: column already exists
  },

  async down(connection) {
    console.log('Skipping rollback: no changes were made in this migration');
    // No-op: nothing to rollback
  }
};

