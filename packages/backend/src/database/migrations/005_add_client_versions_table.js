const mysql = require('mysql2/promise');

exports.up = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix'
  });

  console.log('Creating g_client_versions table...');

  // Create g_client_versions table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_client_versions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      clientVersion VARCHAR(50) NOT NULL,
      platform ENUM('windows', 'mac', 'linux', 'android', 'ios') NOT NULL,
      downloadUrl VARCHAR(500) NULL,
      releaseNotes TEXT NULL,
      isRequired BOOLEAN NOT NULL DEFAULT FALSE,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      releaseDate TIMESTAMP NULL,
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_version (clientVersion),
      INDEX idx_platform (platform),
      INDEX idx_active (isActive),
      INDEX idx_required (isRequired),
      INDEX idx_created (createdBy),
      INDEX idx_updated (updatedBy),
      UNIQUE KEY unique_version_platform (clientVersion, platform)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('g_client_versions table created successfully');
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

  console.log('Dropping g_client_versions table...');

  await connection.execute('DROP TABLE IF EXISTS g_client_versions');

  console.log('g_client_versions table dropped successfully');
  await connection.end();
};
