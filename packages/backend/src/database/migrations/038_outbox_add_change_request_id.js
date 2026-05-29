/**
 * 038 - Align g_outbox_events with OutboxEvent model
 *
 * Original table has: aggregateType, aggregateId, error
 * Model expects:      entityType, entityId, errorMessage, changeRequestId
 *
 * Add missing columns to align with the model.
 */

exports.up = async function (connection) {
  // Helper to check if column exists
  async function columnExists(table, column) {
    const [rows] = await connection.execute(
      `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    return rows[0].cnt > 0;
  }

  // Add changeRequestId
  if (!(await columnExists('g_outbox_events', 'changeRequestId'))) {
    console.log('[038] Adding changeRequestId column...');
    await connection.execute(`
      ALTER TABLE g_outbox_events
      ADD COLUMN changeRequestId CHAR(26) NULL AFTER id
    `);
  }

  // Add entityType
  if (!(await columnExists('g_outbox_events', 'entityType'))) {
    console.log('[038] Adding entityType column...');
    await connection.execute(`
      ALTER TABLE g_outbox_events
      ADD COLUMN entityType VARCHAR(100) NULL AFTER changeRequestId
    `);
  }

  // Add entityId
  if (!(await columnExists('g_outbox_events', 'entityId'))) {
    console.log('[038] Adding entityId column...');
    await connection.execute(`
      ALTER TABLE g_outbox_events
      ADD COLUMN entityId VARCHAR(255) NULL AFTER entityType
    `);
  }

  // Add errorMessage
  if (!(await columnExists('g_outbox_events', 'errorMessage'))) {
    console.log('[038] Adding errorMessage column...');
    await connection.execute(`
      ALTER TABLE g_outbox_events
      ADD COLUMN errorMessage TEXT NULL AFTER retryCount
    `);
  }

  // Backfill new columns from existing data
  console.log('[038] Backfilling entityType/entityId from aggregate columns...');
  await connection.execute(`
    UPDATE g_outbox_events
    SET entityType = aggregateType, entityId = aggregateId
    WHERE entityType IS NULL AND aggregateType IS NOT NULL
  `);

  // Add indexes (ignore if exist)
  try {
    await connection.execute(`
      ALTER TABLE g_outbox_events
      ADD INDEX idx_outbox_events_cr_id (changeRequestId)
    `);
  } catch (_) { /* index may already exist */ }

  try {
    await connection.execute(`
      ALTER TABLE g_outbox_events
      ADD INDEX idx_outbox_entity (entityType, entityId)
    `);
  } catch (_) { /* index may already exist */ }

  console.log('[038] ??g_outbox_events aligned with OutboxEvent model');
};

exports.down = async function (connection) {
  await connection.execute(`
    ALTER TABLE g_outbox_events
    DROP INDEX IF EXISTS idx_outbox_entity,
    DROP INDEX IF EXISTS idx_outbox_events_cr_id,
    DROP COLUMN IF EXISTS errorMessage,
    DROP COLUMN IF EXISTS entityId,
    DROP COLUMN IF EXISTS entityType,
    DROP COLUMN IF EXISTS changeRequestId
  `);
};
