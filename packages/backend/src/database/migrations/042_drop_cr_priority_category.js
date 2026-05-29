/**
 * 042 - Drop unused priority and category columns from g_change_requests
 *
 * These fields were never exposed in the UI and always set to hardcoded defaults.
 */

exports.up = async function (connection) {
  // Check if columns exist before dropping (MySQL < 8.0.1 doesn't support IF EXISTS)
  const [columns] = await connection.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'g_change_requests'
     AND COLUMN_NAME IN ('priority', 'category')`
  );

  const columnNames = columns.map(c => c.COLUMN_NAME);

  if (columnNames.includes('priority')) {
    console.log('[042] Dropping priority column from g_change_requests...');
    await connection.execute('ALTER TABLE g_change_requests DROP COLUMN priority');
  }

  if (columnNames.includes('category')) {
    console.log('[042] Dropping category column from g_change_requests...');
    await connection.execute('ALTER TABLE g_change_requests DROP COLUMN category');
  }

  console.log('[042] ??priority and category columns dropped');
};

exports.down = async function (connection) {
  await connection.execute(`
    ALTER TABLE g_change_requests
    ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'medium' COMMENT 'Request priority',
    ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'general' COMMENT 'Request category'
  `);
};
