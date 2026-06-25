exports.up = async function (connection) {
  console.log('[076] Expanding query_type ENUM in g_argus_saved_queries...');

  const [tables] = await connection.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_saved_queries'`
  );
  if (tables.length === 0) {
    console.log('[076] g_argus_saved_queries table does not exist, skipping');
    return;
  }
  const [cols] = await connection.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_saved_queries' AND COLUMN_NAME = 'query_type'`
  );
  if (cols.length === 0) {
    console.log('[076] query_type column does not exist, skipping');
    return;
  }

  await connection.execute(`
    ALTER TABLE g_argus_saved_queries
    MODIFY COLUMN query_type ENUM(
      'discover',
      'logs',
      'traces',
      'metrics',
      'issues',
      'analytics-insights',
      'analytics-funnels',
      'analytics-retention',
      'analytics-flows'
    ) NOT NULL DEFAULT 'discover'
  `);

  console.log('[076] ✓ query_type ENUM updated');
};

exports.down = async function (connection) {
  // Revert to original enum (will truncate any rows with new values)
  await connection.execute(`
    ALTER TABLE g_argus_saved_queries
    MODIFY COLUMN query_type ENUM(
      'discover',
      'logs',
      'traces',
      'metrics'
    ) NOT NULL DEFAULT 'discover'
  `);
};
