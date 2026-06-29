exports.up = async function (connection) {
  console.log('[090] Creating g_password_reset_tokens table...');

  const [tables] = await connection.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_password_reset_tokens'`
  );

  if (tables.length === 0) {
    await connection.execute(`
      CREATE TABLE g_password_reset_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        expiresAt TIMESTAMP NOT NULL,
        used BOOLEAN NOT NULL DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE,
        INDEX idx_token (token),
        INDEX idx_user_id (userId),
        INDEX idx_expires_at (expiresAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[090] ✓ g_password_reset_tokens table created');
  } else {
    console.log('[090] ✓ g_password_reset_tokens table already exists');
  }
};

exports.down = async function (connection) {
  await connection.execute(`DROP TABLE IF EXISTS g_password_reset_tokens`);
};
