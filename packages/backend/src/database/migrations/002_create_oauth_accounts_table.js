const name = 'Create OAuth accounts table';

async function up(connection) {
  const sql = `
    CREATE TABLE IF NOT EXISTS g_oauth_accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      provider ENUM('google', 'github') NOT NULL,
      providerId VARCHAR(255) NOT NULL,
      providerEmail VARCHAR(255),
      providerName VARCHAR(255),
      providerAvatar VARCHAR(500),
      accessToken TEXT,
      refreshToken TEXT,
      expiresAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_provider_account (provider, providerId),
      INDEX idx_user_id (userId),
      INDEX idx_provider (provider),
      INDEX idx_provider_id (providerId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  await connection.execute(sql);
}

async function down(connection) {
  await connection.execute('DROP TABLE IF EXISTS g_oauth_accounts');
}

module.exports = { name, up, down };
