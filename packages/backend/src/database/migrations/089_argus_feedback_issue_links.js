exports.up = async function (connection) {
  console.log('[089] Creating g_argus_feedback_issue_links table...');

  const [tables] = await connection.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_feedback_issue_links'`
  );

  if (tables.length === 0) {
    await connection.execute(`
      CREATE TABLE g_argus_feedback_issue_links (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id VARCHAR(64) NOT NULL,
        feedback_id VARCHAR(64) NOT NULL,
        issue_id INT NOT NULL,
        created_at DATETIME DEFAULT (UTC_TIMESTAMP()),
        updated_at DATETIME DEFAULT (UTC_TIMESTAMP()) ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_feedback (project_id, feedback_id),
        INDEX idx_issue (issue_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[089] ✓ g_argus_feedback_issue_links table created');
  } else {
    console.log('[089] ✓ g_argus_feedback_issue_links table already exists');
  }
};

exports.down = async function (connection) {
  await connection.execute(`DROP TABLE IF EXISTS g_argus_feedback_issue_links`);
};
