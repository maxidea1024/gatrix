const name = 'Create audit logs table';

async function up(connection) {
  const sql = `
    CREATE TABLE IF NOT EXISTS g_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT,
      action VARCHAR(100) NOT NULL,
      resourceType VARCHAR(50),
      resourceId VARCHAR(100),
      details JSON,
      ipAddress VARCHAR(45),
      userAgent TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_user_id (userId),
      INDEX idx_action (action),
      INDEX idx_resource (resourceType, resourceId),
      INDEX idx_created_at (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  await connection.execute(sql);
}

async function down(connection) {
  await connection.execute('DROP TABLE IF EXISTS g_audit_logs');
}

module.exports = { name, up, down };
