exports.up = async function (connection) {
  console.log('[086] Creating g_argus_github_installations table...');

  const [tables] = await connection.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_github_installations'`
  );

  if (tables.length === 0) {
    await connection.execute(`
      CREATE TABLE g_argus_github_installations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        installation_id VARCHAR(100) NOT NULL,
        account_name VARCHAR(255) NOT NULL,
        target_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY idx_installation_id (installation_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[086] ✓ g_argus_github_installations table created');
  } else {
    console.log('[086] ✓ g_argus_github_installations table already exists');
  }
};

exports.down = async function (connection) {
  await connection.execute(`DROP TABLE IF EXISTS g_argus_github_installations`);
};
