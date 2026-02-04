/**
 * Migration: Change g_audit_logs entityId from INT to VARCHAR(36)
 *
 * Feature flag IDs use ULID format (26 characters), which cannot be stored in INT column.
 */
module.exports = {
  name: 'change_audit_log_entityid_to_varchar',
  async up(connection) {
    // Modify entityId column to VARCHAR(36) to support ULID format
    await connection.query(`
            ALTER TABLE g_audit_logs 
            MODIFY COLUMN entityId VARCHAR(36) NULL
        `);

    console.log('Migration 022: Changed g_audit_logs.entityId from INT to VARCHAR(36)');
  },
  async down(connection) {
    // Note: Converting back to INT will lose any non-numeric data
    await connection.query(`
            ALTER TABLE g_audit_logs 
            MODIFY COLUMN entityId INT NULL
        `);

    console.log('Migration 022 rollback: Changed g_audit_logs.entityId back to INT');
  },
};
