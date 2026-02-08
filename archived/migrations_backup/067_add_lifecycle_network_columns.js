/**
 * Migration: Add network columns to server lifecycle events table
 *
 * Adds hostname, externalAddress, internalAddress, ports, labels columns
 * for efficient searching and filtering.
 */

module.exports = {
  id: '067_add_lifecycle_network_columns',

  async up(db) {
    // Add new columns for network info and labels
    await db.query(`
      ALTER TABLE g_server_lifecycle_events
        ADD COLUMN hostname VARCHAR(255) AFTER serviceGroup,
        ADD COLUMN externalAddress VARCHAR(45) AFTER hostname,
        ADD COLUMN internalAddress VARCHAR(45) AFTER externalAddress,
        ADD COLUMN ports JSON AFTER internalAddress,
        ADD COLUMN labels JSON AFTER cloudZone,
        ADD INDEX idx_lifecycle_hostname (hostname),
        ADD INDEX idx_lifecycle_externalAddress (externalAddress),
        ADD INDEX idx_lifecycle_internalAddress (internalAddress);
    `);

    console.log('Migration 067_add_lifecycle_network_columns completed successfully');
  },

  async down(db) {
    await db.query(`
      ALTER TABLE g_server_lifecycle_events
        DROP INDEX idx_lifecycle_internalAddress,
        DROP INDEX idx_lifecycle_externalAddress,
        DROP INDEX idx_lifecycle_hostname,
        DROP COLUMN labels,
        DROP COLUMN ports,
        DROP COLUMN internalAddress,
        DROP COLUMN externalAddress,
        DROP COLUMN hostname;
    `);
    console.log('Migration 067_add_lifecycle_network_columns reverted successfully');
  },
};
