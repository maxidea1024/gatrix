const mysql = require('mysql2/promise');

exports.up = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix'
  });

  console.log('Creating missing tables...');

  // Create g_audit_logs table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_audit_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      userId INT NULL,
      action VARCHAR(255) NOT NULL,
      resourceType VARCHAR(100) NULL,
      resourceId VARCHAR(255) NULL,
      details JSON NULL,
      ipAddress VARCHAR(45) NULL,
      userAgent TEXT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_user (userId),
      INDEX idx_action (action),
      INDEX idx_resource (resourceType, resourceId),
      INDEX idx_created (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Create g_game_worlds table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_game_worlds (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      displayName VARCHAR(255) NOT NULL,
      description TEXT NULL,
      serverUrl VARCHAR(500) NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      maxPlayers INT NULL,
      currentPlayers INT NOT NULL DEFAULT 0,
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_name (name),
      INDEX idx_active (isActive),
      INDEX idx_created (createdBy),
      INDEX idx_updated (updatedBy)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('Missing tables created successfully');
  await connection.end();
};

exports.down = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix'
  });

  console.log('Dropping missing tables...');

  await connection.execute('DROP TABLE IF EXISTS g_game_worlds');
  await connection.execute('DROP TABLE IF EXISTS g_audit_logs');

  console.log('Missing tables dropped successfully');
  await connection.end();
};
