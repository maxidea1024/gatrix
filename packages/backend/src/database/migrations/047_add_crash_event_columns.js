/**
 * Add missing columns to g_crash_events
 * - firstLine: first line of stack trace for quick reference
 * - crashEventUserAgent: user agent string from crash reporter
 */

exports.name = '002_add_crash_event_columns';

exports.up = async function (connection) {
  // Add firstLine column if not exists
  try {
    await connection.execute(`
      ALTER TABLE g_crash_events
      ADD COLUMN firstLine VARCHAR(200) NULL AFTER crashId
    `);
  } catch (err) {
    if (err.errno !== 1060) throw err; // 1060 = Duplicate column name
    console.log('[002] firstLine column already exists, skipping');
  }

  // Add crashEventUserAgent column if not exists
  try {
    await connection.execute(`
      ALTER TABLE g_crash_events
      ADD COLUMN crashEventUserAgent VARCHAR(500) NULL AFTER crashEventIp
    `);
  } catch (err) {
    if (err.errno !== 1060) throw err;
    console.log('[002] crashEventUserAgent column already exists, skipping');
  }

  console.log('[002] ✓ Added missing columns to g_crash_events');
};

exports.down = async function (connection) {
  await connection.execute(`
    ALTER TABLE g_crash_events
    DROP COLUMN IF EXISTS firstLine,
    DROP COLUMN IF EXISTS crashEventUserAgent
  `);
  console.log('[002] ✓ Removed added columns from g_crash_events');
};
