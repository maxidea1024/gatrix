
/**
 * Migration for Unified Change Request Engine
 */
const { ulid } = require('ulid');

exports.up = async function (connection) {
  console.log('Creating Change Request Engine schema...');

  // 1. g_change_requests table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_change_requests (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      requesterId INT NOT NULL,
      environment VARCHAR(100) NOT NULL COMMENT 'Environment name',
      status ENUM('draft', 'open', 'approved', 'applied', 'rejected') NOT NULL DEFAULT 'draft',
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      reason TEXT NULL COMMENT 'Justification',
      impactAnalysis TEXT NULL,
      priority ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
      category VARCHAR(50) NOT NULL DEFAULT 'general',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_requester (requesterId),
      INDEX idx_environment (environment),
      INDEX idx_status (status),
      CONSTRAINT fk_cr_requester FOREIGN KEY (requesterId) REFERENCES g_users(id),
      CONSTRAINT fk_cr_environment FOREIGN KEY (environment) REFERENCES g_environments(environment) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 2. g_change_items table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_change_items (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      changeRequestId VARCHAR(26) NOT NULL,
      targetTable VARCHAR(100) NOT NULL,
      targetId VARCHAR(255) NOT NULL COMMENT 'Generic generic ID storage',
      beforeData JSON NULL,
      afterData JSON NULL,
      INDEX idx_cr_id (changeRequestId),
      INDEX idx_target (targetTable, targetId),
      CONSTRAINT fk_ci_request FOREIGN KEY (changeRequestId) REFERENCES g_change_requests(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 3. g_approvals table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_approvals (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      changeRequestId VARCHAR(26) NOT NULL,
      approverId INT NOT NULL,
      comment TEXT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_approval_cr (changeRequestId),
      INDEX idx_approver (approverId),
      CONSTRAINT fk_approval_request FOREIGN KEY (changeRequestId) REFERENCES g_change_requests(id) ON DELETE CASCADE,
      CONSTRAINT fk_approval_user FOREIGN KEY (approverId) REFERENCES g_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 4. Update g_audit_logs to include changeRequestId
  // Check if column exists first to avoid error
  const [rows] = await connection.execute(`
    SHOW COLUMNS FROM g_audit_logs LIKE 'changeRequestId'
  `);

  if (rows.length === 0) {
    await connection.execute(`
      ALTER TABLE g_audit_logs 
      ADD COLUMN changeRequestId VARCHAR(26) NULL AFTER entityId,
      ADD INDEX idx_audit_cr (changeRequestId)
    `);

    // Attempt to add foreign key, but don't fail if there's data inconsistency (though valid for new table)
    // Using string interpolation for safety in migration script context
    try {
      await connection.execute(`
            ALTER TABLE g_audit_logs
            ADD CONSTRAINT fk_audit_cr FOREIGN KEY (changeRequestId) REFERENCES g_change_requests(id) ON DELETE SET NULL
        `);
    } catch (e) {
      console.warn('Could not add FK constraint to g_audit_logs.changeRequestId (non-fatal):', e.message);
    }
  }

  // 5. Set default CR settings for production environment
  // Production requires approval, others do not
  await connection.execute(`
    UPDATE g_environments 
    SET requiresApproval = TRUE, requiredApprovers = 1 
    WHERE environment = 'production'
  `);

  console.log('✓ Production environment CR settings configured (requiresApproval=true, requiredApprovers=1)');
  console.log('Change Request Engine schema created successfully.');
};

exports.down = async function (connection) {
  console.log('Rolling back Change Request Engine schema...');

  // Remove column from audit logs
  try {
    // Drop FK first
    await connection.execute(`ALTER TABLE g_audit_logs DROP FOREIGN KEY fk_audit_cr`);
  } catch (e) { /* ignore */ }

  try {
    await connection.execute(`ALTER TABLE g_audit_logs DROP COLUMN changeRequestId`);
  } catch (e) { /* ignore */ }

  await connection.execute(`DROP TABLE IF EXISTS g_approvals`);
  await connection.execute(`DROP TABLE IF EXISTS g_change_items`);
  await connection.execute(`DROP TABLE IF EXISTS g_change_requests`);
};
