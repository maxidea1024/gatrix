exports.up = async function (connection) {
  console.log('[085] Creating g_argus_global_integrations table...');

  const [tables] = await connection.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_global_integrations'`
  );

  if (tables.length === 0) {
    await connection.execute(`
      CREATE TABLE g_argus_global_integrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        provider VARCHAR(50) NOT NULL,
        name VARCHAR(100) DEFAULT NULL,
        url VARCHAR(255) DEFAULT NULL,
        credentials JSON DEFAULT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY idx_provider_url (provider, url)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[085] ✓ g_argus_global_integrations table created');
  } else {
    console.log('[085] ✓ g_argus_global_integrations table already exists');
  }
};

exports.down = async function (connection) {
  await connection.execute(`DROP TABLE IF EXISTS g_argus_global_integrations`);
};
