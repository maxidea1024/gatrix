exports.up = async function (connection) {
  console.log('[084] Creating g_argus_issue_trackers table...');

  const [tables] = await connection.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_issue_trackers'`
  );

  if (tables.length === 0) {
    await connection.execute(`
      CREATE TABLE g_argus_issue_trackers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id VARCHAR(64) NOT NULL,
        provider ENUM('jira','github','linear','clickup','asana','notion','shortcut','azure_devops','redmine','youtrack','trello') NOT NULL,
        name VARCHAR(255) NOT NULL,
        api_url VARCHAR(512) NOT NULL,
        api_token VARCHAR(512) NOT NULL,
        config JSON DEFAULT NULL,
        enabled TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT (UTC_TIMESTAMP()),
        updated_at DATETIME DEFAULT (UTC_TIMESTAMP()) ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[084] ✓ g_argus_issue_trackers table created');
  } else {
    // Ensure ENUM has all providers (safe to re-run)
    try {
      await connection.execute(`
        ALTER TABLE g_argus_issue_trackers
        MODIFY COLUMN provider ENUM('jira','github','linear','clickup','asana','notion','shortcut','azure_devops','redmine','youtrack','trello') NOT NULL
      `);
      console.log('[084] ✓ g_argus_issue_trackers provider ENUM updated');
    } catch (e) {
      console.log('[084] ⚠ Could not alter provider ENUM:', e.message);
    }
  }
};

exports.down = async function (connection) {
  await connection.execute(`DROP TABLE IF EXISTS g_argus_issue_trackers`);
};
