exports.up = async function (connection) {
  console.log('[079] Adding missing query_type column to g_argus_saved_queries...');

  const [tables] = await connection.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_saved_queries'`
  );
  if (tables.length === 0) {
    console.log('[079] g_argus_saved_queries table does not exist, skipping');
    return;
  }

  // Check if query_type column already exists
  const [cols] = await connection.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_saved_queries' AND COLUMN_NAME = 'query_type'`
  );

  if (cols.length === 0) {
    await connection.execute(`
      ALTER TABLE g_argus_saved_queries
      ADD COLUMN query_type VARCHAR(50) NOT NULL DEFAULT 'discover'
      AFTER display_type
    `);
    console.log('[079] ✓ query_type column added');

    // Add index for project_id + query_type
    await connection.execute(`
      ALTER TABLE g_argus_saved_queries
      ADD INDEX idx_project_query_type (project_id, query_type)
    `);
    console.log('[079] ✓ idx_project_query_type index added');
  } else {
    console.log('[079] query_type column already exists, skipping');
  }
};

exports.down = async function (connection) {
  const [cols] = await connection.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_saved_queries' AND COLUMN_NAME = 'query_type'`
  );
  if (cols.length > 0) {
    await connection.execute(`
      ALTER TABLE g_argus_saved_queries
      DROP INDEX idx_project_query_type,
      DROP COLUMN query_type
    `);
  }
};
