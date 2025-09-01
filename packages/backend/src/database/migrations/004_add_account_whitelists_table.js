const mysql = require('mysql2/promise');

exports.up = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix'
  });

  console.log('Creating g_account_whitelists table...');

  // Create g_account_whitelists table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_account_whitelists (
      id INT AUTO_INCREMENT PRIMARY KEY,
      accountId VARCHAR(255) NOT NULL,
      ipAddress VARCHAR(45) NULL,
      startDate TIMESTAMP NULL,
      endDate TIMESTAMP NULL,
      memo TEXT NULL,
      tags JSON NULL,
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_account (accountId),
      INDEX idx_ip (ipAddress),
      INDEX idx_created (createdBy),
      INDEX idx_updated (updatedBy),
      INDEX idx_dates (startDate, endDate)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('g_account_whitelists table created successfully');
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

  console.log('Dropping g_account_whitelists table...');

  await connection.execute('DROP TABLE IF EXISTS g_account_whitelists');

  console.log('g_account_whitelists table dropped successfully');
  await connection.end();
};
