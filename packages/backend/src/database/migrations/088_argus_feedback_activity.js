exports.up = async function (connection) {
  console.log('[088] Creating g_argus_feedback_activity table...');

  const [tables] = await connection.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_feedback_activity'`
  );

  if (tables.length === 0) {
    await connection.execute(`
      CREATE TABLE g_argus_feedback_activity (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id VARCHAR(64) NOT NULL,
        feedback_id VARCHAR(64) NOT NULL,
        user_name VARCHAR(255) DEFAULT NULL,
        action ENUM('status_change','assign','comment','mark_spam','unmark_spam') NOT NULL,
        data JSON DEFAULT NULL,
        created_at DATETIME DEFAULT (UTC_TIMESTAMP()),
        INDEX idx_feedback (project_id, feedback_id),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[088] ✓ g_argus_feedback_activity table created');
  } else {
    console.log('[088] ✓ g_argus_feedback_activity table already exists');
  }
};

exports.down = async function (connection) {
  await connection.execute(`DROP TABLE IF EXISTS g_argus_feedback_activity`);
};
