exports.up = async function (connection) {
  console.log('[075] Adding analytics_breakdown_limit to g_argus_projects...');

  const [tables] = await connection.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_projects'`
  );
  if (tables.length === 0) {
    console.log('[075] g_argus_projects table does not exist, skipping');
    return;
  }

  const [cols] = await connection.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_projects' AND COLUMN_NAME = 'analytics_breakdown_limit'`
  );

  if (cols.length === 0) {
    await connection.execute(`
      ALTER TABLE g_argus_projects
      ADD COLUMN analytics_breakdown_limit INT NOT NULL DEFAULT 20 AFTER metrics_group_limit
    `);
    console.log('[075] ✓ analytics_breakdown_limit column added');
  } else {
    console.log('[075] ✓ analytics_breakdown_limit already exists, skipping');
  }
};

exports.down = async function (connection) {
  await connection.execute(`ALTER TABLE g_argus_projects DROP COLUMN analytics_breakdown_limit`);
};
