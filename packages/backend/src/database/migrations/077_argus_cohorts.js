exports.up = async function (connection) {
  console.log('[077] Creating g_argus_cohorts table...');

  const [tables] = await connection.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_cohorts'`
  );

  if (tables.length === 0) {
    await connection.execute(`
      CREATE TABLE g_argus_cohorts (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        project_id    VARCHAR(100) NOT NULL,
        name          VARCHAR(255) NOT NULL,
        description   TEXT,
        definition    JSON NOT NULL,
        user_count    INT DEFAULT 0,
        last_computed DATETIME DEFAULT NULL,
        created_by    VARCHAR(100) DEFAULT NULL,
        created_at    DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
        updated_at    DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
        INDEX idx_project (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('[077] ✓ g_argus_cohorts table created');
  } else {
    console.log('[077] g_argus_cohorts table already exists, skipping');
  }
};

exports.down = async function (connection) {
  await connection.execute('DROP TABLE IF EXISTS g_argus_cohorts');
};
