exports.up = async function (connection) {
  console.log('[076] Expanding query_type ENUM in g_argus_saved_queries...');

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
