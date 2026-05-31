exports.up = async function (connection) {
  console.log('[069] Creating g_argus_saved_queries table...');

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_argus_saved_queries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      description VARCHAR(500) NULL,
      query_config JSON NOT NULL COMMENT 'Serialized query: fields, conditions, groupBy, orderBy, period',
      created_by VARCHAR(255) NULL,
      is_global TINYINT(1) DEFAULT 0 COMMENT '1=visible to all project members',
      display_type VARCHAR(20) DEFAULT 'table' COMMENT 'table, bar, line, number',
      created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
      updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()) ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_saved_queries_project (project_id),
      INDEX idx_saved_queries_user (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[069] ✓ g_argus_saved_queries ready');
};

exports.down = async function (connection) {
  await connection.execute('DROP TABLE IF EXISTS g_argus_saved_queries');
};
