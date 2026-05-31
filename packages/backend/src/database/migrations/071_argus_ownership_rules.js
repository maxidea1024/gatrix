exports.up = async function (connection) {
  console.log('[071] Creating g_argus_ownership_rules table...');

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_argus_ownership_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      match_type VARCHAR(20) NOT NULL COMMENT 'path, module, tag, url',
      match_pattern VARCHAR(500) NOT NULL COMMENT 'glob pattern or regex',
      owners JSON NOT NULL COMMENT '["user1","user2"] — assigned owners',
      priority INT DEFAULT 0 COMMENT 'higher = higher priority',
      auto_assign TINYINT(1) DEFAULT 1 COMMENT 'auto-assign on match',
      enabled TINYINT(1) DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
      updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()) ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_ownership_project (project_id),
      INDEX idx_ownership_priority (project_id, priority DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[071] ✓ g_argus_ownership_rules ready');
};

exports.down = async function (connection) {
  await connection.execute('DROP TABLE IF EXISTS g_argus_ownership_rules');
};
