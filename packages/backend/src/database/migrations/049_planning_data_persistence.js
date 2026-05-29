// Migration: Add g_planning_data_cache table for DB persistence of planning data
// Previously planning data was stored only in Redis cache and lost on restart
exports.name = '049_planning_data_persistence';

exports.up = async function (connection) {
  // Check if table already exists
  const [tables] = await connection.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_planning_data_cache'`
  );
  if (tables.length > 0) {
    console.log('[049] g_planning_data_cache already exists, skipping');
    return;
  }

  await connection.execute(`
    CREATE TABLE g_planning_data_cache (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      dataType VARCHAR(100) NOT NULL COMMENT 'e.g. cashshop-lookup, reward-lookup-kr',
      dataContent LONGTEXT NOT NULL COMMENT 'JSON string of the planning data',
      dataHash VARCHAR(64) NOT NULL COMMENT 'SHA256 hash for change detection',
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_env_datatype (environmentId, dataType),
      INDEX idx_environment_id (environmentId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[049] g_planning_data_cache table created');
};

exports.down = async function (connection) {
  await connection.execute('DROP TABLE IF EXISTS g_planning_data_cache');
  console.log('[049] g_planning_data_cache table dropped');
};
