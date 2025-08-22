const name = 'Create users table';

async function up(connection) {
  const sql = `
    CREATE TABLE IF NOT EXISTS g_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      passwordHash VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      avatarUrl VARCHAR(500),
      role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
      status ENUM('pending', 'active', 'suspended', 'deleted') NOT NULL DEFAULT 'pending',
      emailVerified BOOLEAN NOT NULL DEFAULT FALSE,
      emailVerifiedAt TIMESTAMP NULL,
      lastLoginAt TIMESTAMP NULL,
      oauthProvider VARCHAR(50),
      oauthId VARCHAR(255),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email (email),
      INDEX idx_role (role),
      INDEX idx_status (status),
      INDEX idx_oauth (oauthProvider, oauthId),
      INDEX idx_created_at (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  await connection.execute(sql);
}

async function down(connection) {
  await connection.execute('DROP TABLE IF EXISTS g_users');
}

module.exports = { name, up, down };
