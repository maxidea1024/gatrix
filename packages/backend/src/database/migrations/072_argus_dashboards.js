exports.up = async function (connection) {
  console.log('[072] Creating argus_dashboards table...');

  const [tables] = await connection.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'argus_dashboards'`
  );

  if (tables.length === 0) {
    await connection.execute(`
      CREATE TABLE argus_dashboards (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id VARCHAR(64) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        widgets_config JSON NOT NULL,
        created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
        updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
        INDEX idx_project (project_id),
        INDEX idx_updated (updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[072] ✓ argus_dashboards table created');
  } else {
    console.log('[072] ✓ argus_dashboards table already exists, skipping');
  }
};

exports.down = async function (connection) {
  await connection.execute(`DROP TABLE IF EXISTS argus_dashboards`);
  console.log('[072] ✓ argus_dashboards table dropped');
};
