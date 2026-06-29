exports.up = async function (connection) {
  console.log('[083] Creating g_argus_notification_channels table...');

  const [tables] = await connection.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_notification_channels'`
  );

  if (tables.length === 0) {
    await connection.execute(`
      CREATE TABLE g_argus_notification_channels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id VARCHAR(64) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        name VARCHAR(100) DEFAULT NULL,
        config JSON DEFAULT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[083] ✓ g_argus_notification_channels table created');
  } else {
    console.log('[083] ✓ g_argus_notification_channels table already exists');
  }
};

exports.down = async function (connection) {
  await connection.execute(`DROP TABLE IF EXISTS g_argus_notification_channels`);
};
