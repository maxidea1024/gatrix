/**
 * 037 - CR Draft Data Support
 *
 * Adds opType + ops columns to g_change_items for field-level change tracking.
 * Adds draftData JSON column for complex entity changes
 * (feature flags, segments) that cannot be expressed as simple field-level ops.
 *
 * Also drops g_drafts table as the draft system is fully replaced by CR.
 */

exports.up = async function (connection) {
  // Add opType column (entity-level operation type)
  console.log('[037] Adding opType column to g_change_items...');
  await connection.execute(`
    ALTER TABLE g_change_items
    ADD COLUMN opType ENUM('CREATE','UPDATE','DELETE') NULL
    AFTER operation
  `);

  // Backfill opType from existing operation column (uppercase)
  await connection.execute(`
    UPDATE g_change_items
    SET opType = UPPER(operation)
    WHERE opType IS NULL
  `);

  // Add ops JSON column (field-level operations)
  console.log('[037] Adding ops column to g_change_items...');
  await connection.execute(`
    ALTER TABLE g_change_items
    ADD COLUMN ops JSON NULL COMMENT 'Field-level operations array'
    AFTER afterData
  `);

  // Add draftData JSON column
  console.log('[037] Adding draftData column to g_change_items...');
  await connection.execute(`
    ALTER TABLE g_change_items
    ADD COLUMN draftData JSON NULL COMMENT 'Full snapshot data for complex changes (feature flags, segments)'
    AFTER ops
  `);

  console.log('[037] ??opType, ops, draftData columns added to g_change_items');

  // Drop the legacy draft system table
  console.log('[037] Dropping g_drafts table...');
  await connection.execute('DROP TABLE IF EXISTS g_drafts');
  console.log('[037] ??g_drafts table dropped');
};

exports.down = async function (connection) {
  // Remove added columns
  await connection.execute(`
    ALTER TABLE g_change_items
    DROP COLUMN IF EXISTS draftData,
    DROP COLUMN IF EXISTS ops,
    DROP COLUMN IF EXISTS opType
  `);

  // Re-create g_drafts table
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
};
