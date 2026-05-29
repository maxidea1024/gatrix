/**
 * 060 - Spreadsheets Version Column
 *
 * Adds a `version` column for optimistic concurrency control.
 * Every save increments version; clients send expectedVersion
 * to detect conflicts (409 Conflict when version mismatch).
 */

exports.up = async function (connection) {
  console.log('[060] Adding version column to g_spreadsheets...');

  await connection.execute(`
    ALTER TABLE g_spreadsheets
    ADD COLUMN version INT NOT NULL DEFAULT 1
    COMMENT 'Incremented on every save for optimistic concurrency'
  `);

  console.log('[060] Migration complete.');
};

exports.down = async function (connection) {
  console.log('[060] Rolling back version column...');

  await connection.execute(`
    ALTER TABLE g_spreadsheets
    DROP COLUMN version
  `);

  console.log('[060] Rollback complete.');
};
