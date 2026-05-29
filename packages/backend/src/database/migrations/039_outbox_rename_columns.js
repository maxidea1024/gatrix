/**
 * 039 - Drop legacy aggregate columns from g_outbox_events
 *
 * Migration 038 already added entityType/entityId/errorMessage and backfilled
 * data from the old aggregateType/aggregateId/error columns.
 * This migration drops the old columns if they still exist.
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

  // Drop aggregateType (replaced by entityType in 038)
  if (await columnExists('g_outbox_events', 'aggregateType')) {
    console.log('[039] Dropping legacy aggregateType column...');
    await connection.execute(`
      ALTER TABLE g_outbox_events DROP COLUMN aggregateType
    `);
  }

  // Drop aggregateId (replaced by entityId in 038)
  if (await columnExists('g_outbox_events', 'aggregateId')) {
    console.log('[039] Dropping legacy aggregateId column...');
    await connection.execute(`
      ALTER TABLE g_outbox_events DROP COLUMN aggregateId
    `);
  }

  // Drop error (replaced by errorMessage in 038)
  if (await columnExists('g_outbox_events', 'error')) {
    console.log('[039] Dropping legacy error column...');
    await connection.execute(`
      ALTER TABLE g_outbox_events DROP COLUMN error
    `);
  }

  console.log('[039] ??Legacy aggregate columns cleaned up');
};

exports.down = async function (connection) {
  // Re-add legacy columns if needed
  async function columnExists(table, column) {
    const [rows] = await connection.execute(
      `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    return rows[0].cnt > 0;
  }

  if (!(await columnExists('g_outbox_events', 'aggregateType'))) {
    await connection.execute(`
      ALTER TABLE g_outbox_events
      ADD COLUMN aggregateType VARCHAR(100) NOT NULL DEFAULT ''
    `);
  }

  if (!(await columnExists('g_outbox_events', 'aggregateId'))) {
    await connection.execute(`
      ALTER TABLE g_outbox_events
      ADD COLUMN aggregateId VARCHAR(255) NOT NULL DEFAULT ''
    `);
  }

  if (!(await columnExists('g_outbox_events', 'error'))) {
    await connection.execute(`
      ALTER TABLE g_outbox_events
      ADD COLUMN error TEXT NULL
    `);
  }

  // Backfill from new columns
  await connection.execute(`
    UPDATE g_outbox_events
    SET aggregateType = entityType, aggregateId = entityId
    WHERE aggregateType = '' AND entityType IS NOT NULL
  `);
};
