exports.up = async function (connection) {
  console.log('[078] Creating g_argus_kpi_alerts table...');

  const [tables] = await connection.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_kpi_alerts'`
  );

  if (tables.length === 0) {
    await connection.execute(`
      CREATE TABLE g_argus_kpi_alerts (
        id                    INT AUTO_INCREMENT PRIMARY KEY,
        project_id            VARCHAR(100) NOT NULL,
        name                  VARCHAR(255) NOT NULL,
        metric_config         JSON NOT NULL,
        \`operator\`           VARCHAR(20) NOT NULL,
        threshold             DOUBLE NOT NULL,
        check_interval        INT DEFAULT 3600,
        notification_channels JSON DEFAULT NULL,
        \`status\`             VARCHAR(20) DEFAULT 'ok',
        last_checked          DATETIME DEFAULT NULL,
        \`last_value\`         DOUBLE DEFAULT NULL,
        enabled               TINYINT(1) DEFAULT 1,
        created_at            DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
        updated_at            DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
        INDEX idx_project (project_id),
        INDEX idx_status (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('[078] ✓ g_argus_kpi_alerts table created');
  } else {
    console.log('[078] g_argus_kpi_alerts table already exists, skipping');
  }
};

exports.down = async function (connection) {
  await connection.execute('DROP TABLE IF EXISTS g_argus_kpi_alerts');
};
