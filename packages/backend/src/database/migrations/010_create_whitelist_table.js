const name = 'Create whitelist table';

async function up(connection) {
  const sql = `
    CREATE TABLE IF NOT EXISTS g_whitelist (
      id INT PRIMARY KEY AUTO_INCREMENT,
      nickname VARCHAR(100) NOT NULL,
      ip_address VARCHAR(45) NULL COMMENT 'IPv4 or IPv6 address',
      start_date DATETIME NULL COMMENT 'Allow period start (optional)',
      end_date DATETIME NULL COMMENT 'Allow period end (optional)',
      memo TEXT NULL COMMENT 'Additional notes',
      created_by INT NOT NULL COMMENT 'User ID who created this entry',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_nickname (nickname),
      INDEX idx_ip_address (ip_address),
      INDEX idx_created_by (created_by),
      INDEX idx_start_date (start_date),
      INDEX idx_end_date (end_date),

      FOREIGN KEY (created_by) REFERENCES g_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `;

  await connection.execute(sql);
}

async function down(connection) {
  await connection.execute('DROP TABLE IF EXISTS g_whitelist');
}

module.exports = { name, up, down };
