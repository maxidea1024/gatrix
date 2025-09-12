const mysql = require('mysql2/promise');

/**
 * Add g_remote_config_variants table for A/B testing
 */
exports.up = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix'
  });

  console.log('Adding g_remote_config_variants table...');

  // Create variants table (A/B Testing - no conditions needed, pure traffic split)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_variants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      configId INT NOT NULL,
      variantName VARCHAR(255) NOT NULL,
      value TEXT NULL,
      trafficPercentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_variants_config FOREIGN KEY (configId) REFERENCES g_remote_configs(id) ON DELETE CASCADE,
      CONSTRAINT fk_variants_creator FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_variants_updater FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_config_id (configId),
      INDEX idx_variant_name (variantName),
      INDEX idx_traffic_percentage (trafficPercentage),
      INDEX idx_is_active (isActive),
      INDEX idx_created_at (createdAt),
      UNIQUE KEY unique_config_variant (configId, variantName)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('✓ g_remote_config_variants table created');

  await connection.end();
};

/**
 * Drop g_remote_config_variants table
 */
exports.down = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix'
  });

  console.log('Dropping g_remote_config_variants table...');

  await connection.execute(`DROP TABLE IF EXISTS g_remote_config_variants`);

  console.log('✓ g_remote_config_variants table dropped');

  await connection.end();
};
