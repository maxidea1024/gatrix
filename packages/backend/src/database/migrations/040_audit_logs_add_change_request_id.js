/**
 * 040 - Add changeRequestId column to g_audit_logs
 *
 * Was missed during migration coalescing.
 */

exports.up = async function (connection) {
  console.log('[040] Adding changeRequestId column to g_audit_logs...');
  await connection.execute(`
    ALTER TABLE g_audit_logs
    ADD COLUMN changeRequestId CHAR(26) NULL AFTER userId
  `);

  await connection.execute(`
    ALTER TABLE g_audit_logs
    ADD INDEX idx_audit_cr_id (changeRequestId)
  `);

  console.log('[040] ??changeRequestId column added to g_audit_logs');
};

exports.down = async function (connection) {
  await connection.execute(`
    ALTER TABLE g_audit_logs
    DROP INDEX idx_audit_cr_id,
    DROP COLUMN changeRequestId
  `);
};
