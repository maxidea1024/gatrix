/**
 * Migration: Add description column to g_audit_logs
 *
 * Adds a human-readable description field to audit logs
 * following the 5W1H (육하원칙) principle for audit trail.
 * This field provides context like "Created feature flag 'dark-mode' in production"
 * instead of just raw action codes and entity IDs.
 */
exports.up = async function (connection) {
    await connection.execute(`
    ALTER TABLE g_audit_logs
    ADD COLUMN description VARCHAR(500) NULL AFTER action
  `);
    console.log('Migration 069: Added description column to g_audit_logs');
};

exports.down = async function (connection) {
    await connection.execute(`
    ALTER TABLE g_audit_logs
    DROP COLUMN description
  `);
    console.log('Migration 069 rollback: Removed description column from g_audit_logs');
};
