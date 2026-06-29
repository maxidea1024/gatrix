exports.up = async function (connection) {
  console.log('[087] Creating g_argus_spam_keywords table...');

  const [tables] = await connection.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_spam_keywords'`
  );

  if (tables.length === 0) {
    await connection.execute(`
      CREATE TABLE g_argus_spam_keywords (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id VARCHAR(64) NOT NULL,
        keyword VARCHAR(255) NOT NULL,
        is_regex TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT (UTC_TIMESTAMP()),
        INDEX idx_project (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[087] ✓ g_argus_spam_keywords table created');
  } else {
    console.log('[087] ✓ g_argus_spam_keywords table already exists');
  }
};

exports.down = async function (connection) {
  await connection.execute(`DROP TABLE IF EXISTS g_argus_spam_keywords`);
};
