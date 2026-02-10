/**
 * Adds NetworkTraffic table for tracking SDK API request traffic
 * Uses 1-hour buckets for aggregation (same as FeatureMetrics)
 */

exports.up = async function (connection) {
  console.log('Creating NetworkTraffic table...');
  await connection.execute(`
        CREATE TABLE IF NOT EXISTS NetworkTraffic (
            id INT AUTO_INCREMENT PRIMARY KEY,
            environment VARCHAR(100) NOT NULL,
            appName VARCHAR(255) NOT NULL DEFAULT 'unknown',
            endpoint ENUM('features', 'segments') NOT NULL,
            trafficBucket DATETIME NOT NULL COMMENT '1-hour bucket',
            requestCount INT UNSIGNED NOT NULL DEFAULT 1,
            createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_traffic (environment, appName, endpoint, trafficBucket),
            INDEX idx_bucket (trafficBucket),
            INDEX idx_env_bucket (environment, trafficBucket)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  console.log('✓ NetworkTraffic table created');
};

exports.down = async function (connection) {
  console.log('Dropping NetworkTraffic table...');
  await connection.execute('DROP TABLE IF EXISTS NetworkTraffic');
  console.log('✓ NetworkTraffic table dropped');
};
