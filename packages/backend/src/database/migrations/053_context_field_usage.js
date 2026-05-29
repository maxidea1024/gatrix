// Migration: Create g_context_field_usage table for tracking discovered context fields from SDK evaluations
exports.name = '053_context_field_usage';

exports.up = async function (connection) {
  // Check if table already exists
  const [tables] = await connection.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_context_field_usage'`
  );
  if (tables.length > 0) {
    console.log('[053] g_context_field_usage table already exists, skipping');
    return;
  }

  await connection.execute(`
    CREATE TABLE g_context_field_usage (
      id VARCHAR(26) NOT NULL PRIMARY KEY,
      projectId VARCHAR(26) NOT NULL,
      environmentId VARCHAR(26) NOT NULL,
      fieldName VARCHAR(255) NOT NULL,
      appName VARCHAR(255) NULL,
      sdkVersion VARCHAR(100) NULL,
      accessCount BIGINT NOT NULL DEFAULT 0,
      firstSeenAt DATETIME NOT NULL,
      lastSeenAt DATETIME NOT NULL,
      description TEXT NULL,
      tags JSON NULL,
      isIgnored BOOLEAN NOT NULL DEFAULT FALSE,
      UNIQUE KEY uk_ctx_usage (projectId, environmentId, fieldName, appName),
      INDEX idx_ctx_usage_project (projectId),
      INDEX idx_ctx_usage_env (projectId, environmentId),
      INDEX idx_ctx_usage_last_seen (lastSeenAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[053] g_context_field_usage table created');
};

exports.down = async function (connection) {
  const [tables] = await connection.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_context_field_usage'`
  );
  if (tables.length > 0) {
    await connection.execute(`DROP TABLE g_context_field_usage`);
  }
  console.log('[053] g_context_field_usage table dropped');
};
