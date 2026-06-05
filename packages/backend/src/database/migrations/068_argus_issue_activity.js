exports.up = async function (connection) {
  console.log('[068] Creating g_argus_issue_activity table...');

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_argus_issue_activity (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id INT NOT NULL,
      issue_id INT NOT NULL,
      user_name VARCHAR(255) NULL,
      action VARCHAR(50) NOT NULL COMMENT 'status_change, assign, comment, priority_change, merge',
      data JSON NULL COMMENT 'Action-specific data (e.g. {from: "unresolved", to: "resolved"})',
      created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
      INDEX idx_issue_activity_issue (issue_id),
      INDEX idx_issue_activity_project (project_id),
      INDEX idx_issue_activity_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[068] ✓ g_argus_issue_activity ready');
};

exports.down = async function (connection) {
  await connection.execute('DROP TABLE IF EXISTS g_argus_issue_activity');
};
