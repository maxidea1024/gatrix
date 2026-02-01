/**
 * Adds NetworkTraffic table for tracking SDK API request traffic
 * Uses 1-hour buckets for aggregation (same as FeatureMetrics)
 */

exports.up = async function (knex) {
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS NetworkTraffic (
            id INT AUTO_INCREMENT PRIMARY KEY,
            environment VARCHAR(100) NOT NULL,
            appName VARCHAR(255) NOT NULL DEFAULT 'unknown',
            endpoint ENUM('features', 'segments') NOT NULL,
            trafficBucket DATETIME NOT NULL COMMENT '1-hour bucket',
            requestCount INT UNSIGNED NOT NULL DEFAULT 1,
            createdAt DATETIME NOT NULL,
            updatedAt DATETIME NOT NULL,
            UNIQUE KEY uk_traffic (environment, appName, endpoint, trafficBucket),
            INDEX idx_bucket (trafficBucket),
            INDEX idx_env_bucket (environment, trafficBucket)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
};

exports.down = async function (knex) {
    await knex.raw('DROP TABLE IF EXISTS NetworkTraffic');
};
