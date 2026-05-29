/**
 * 033 - Generic Draft System
 * Creates a shared g_drafts table for staging changes across all content types.
 */

exports.up = async function (connection) {
  console.log('[033] Creating generic draft system...');

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_drafts (
      id CHAR(26) NOT NULL,
      targetType VARCHAR(50) NOT NULL COMMENT 'Resource type: feature_flag, banner, segment, etc.',
      targetId VARCHAR(255) NOT NULL COMMENT 'Target resource ID',
      environmentId VARCHAR(255) NULL COMMENT 'Environment ID (NULL for project-level resources)',
      draftData JSON NOT NULL COMMENT 'Draft snapshot data',
      createdBy CHAR(26) NOT NULL COMMENT 'User who created the draft',
      updatedBy CHAR(26) NULL COMMENT 'User who last updated the draft',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_draft_target (targetType, targetId, environmentId),
      INDEX idx_draft_type_env (targetType, environmentId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[033] ??Generic draft system created');
};

exports.down = async function (connection) {
  await connection.execute('DROP TABLE IF EXISTS g_drafts');
};
