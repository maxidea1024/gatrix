exports.up = async function (connection) {
  console.log('[070] Creating g_argus_integrations and g_argus_commits tables...');

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_argus_integrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      provider VARCHAR(20) NOT NULL COMMENT 'github, gitlab, bitbucket',
      repo_url VARCHAR(500) NOT NULL,
      default_branch VARCHAR(100) DEFAULT 'main',
      access_token VARCHAR(500) NULL COMMENT 'encrypted PAT',
      webhook_secret VARCHAR(255) NULL,
      enabled TINYINT(1) DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
      updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()) ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_integrations_project (project_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[070] ✓ g_argus_integrations ready');

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_argus_commits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      integration_id INT NULL,
      commit_hash VARCHAR(40) NOT NULL,
      author_name VARCHAR(255) NULL,
      author_email VARCHAR(255) NULL,
      message TEXT NULL,
      timestamp DATETIME NULL,
      release_version VARCHAR(255) NULL COMMENT 'linked release tag',
      files_changed TEXT NULL COMMENT 'JSON array of changed file paths',
      additions INT DEFAULT 0,
      deletions INT DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
      INDEX idx_commits_project (project_id),
      INDEX idx_commits_release (release_version),
      INDEX idx_commits_hash (commit_hash),
      UNIQUE KEY uk_commit (project_id, commit_hash)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[070] ✓ g_argus_commits ready');
};

exports.down = async function (connection) {
  await connection.execute('DROP TABLE IF EXISTS g_argus_commits');
  await connection.execute('DROP TABLE IF EXISTS g_argus_integrations');
};
