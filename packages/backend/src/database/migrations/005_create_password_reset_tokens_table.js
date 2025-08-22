const name = 'Create password reset tokens table';

async function up(connection) {
  const sql = `
    CREATE TABLE IF NOT EXISTS g_password_reset_tokens (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  await connection.execute(sql);
}

async function down(connection) {
  await connection.execute('DROP TABLE IF EXISTS g_password_reset_tokens');
}

module.exports = { name, up, down };
