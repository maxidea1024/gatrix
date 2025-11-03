/**
 * Migration 030: Make startDate nullable in g_service_notices
 *
 * Note: This migration is a no-op because g_service_notices.startDate
 * is already nullable from the initial schema or earlier migrations.
 */

module.exports = {
  async up(connection) {
    console.log('Skipping: g_service_notices.startDate is already nullable');
    // No-op: column already nullable
  },

  async down(connection) {
    console.log('Skipping rollback: no changes were made in this migration');
    // No-op: nothing to rollback
  }
};

