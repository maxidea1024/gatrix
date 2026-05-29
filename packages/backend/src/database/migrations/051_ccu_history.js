// Migration: Create g_ccu_history table for tracking concurrent user counts
exports.name = '051_ccu_history';

exports.up = async function (connection) {
  // Check if table already exists
  const [tables] = await connection.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_ccu_history'`
  );
  if (tables.length > 0) {
    console.log('[051] g_ccu_history table already exists, skipping');
    return;
  }

  await connection.execute(`
    CREATE TABLE g_ccu_history (
      id VARCHAR(26) NOT NULL PRIMARY KEY,
      environmentId VARCHAR(26) NOT NULL,
      worldId VARCHAR(100) NULL COMMENT 'null = total CCU across all worlds',
      worldName VARCHAR(255) NULL,
      playerCount INT NOT NULL DEFAULT 0,
      botCount INT NOT NULL DEFAULT 0,
      recordedAt DATETIME NOT NULL,
      INDEX idx_ccu_env_recorded (environmentId, recordedAt),
      INDEX idx_ccu_env_world_recorded (environmentId, worldId, recordedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[051] g_ccu_history table created');
};

exports.down = async function (connection) {
  const [tables] = await connection.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_ccu_history'`
  );
  if (tables.length > 0) {
    await connection.execute(`DROP TABLE g_ccu_history`);
  }
  console.log('[051] g_ccu_history table dropped');
};
