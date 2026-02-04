/**
 * Migration: Add unknown flags tracking table
 * Tracks SDK accesses to non-existent feature flags
 */

exports.up = async function (connection) {
  await connection.query(`
        CREATE TABLE IF NOT EXISTS unknown_flags (
            id INT AUTO_INCREMENT PRIMARY KEY,
            flagName VARCHAR(255) NOT NULL,
            environment VARCHAR(100) NOT NULL,
            appName VARCHAR(100) NULL,
            sdkVersion VARCHAR(50) NULL,
            accessCount INT UNSIGNED NOT NULL DEFAULT 1,
            firstReportedAt DATETIME NOT NULL,
            lastReportedAt DATETIME NOT NULL,
            isResolved TINYINT(1) NOT NULL DEFAULT 0,
            resolvedAt DATETIME NULL,
            resolvedBy VARCHAR(255) NULL,
            UNIQUE KEY uk_flag_env (flagName, environment),
            INDEX idx_last_reported (lastReportedAt),
            INDEX idx_resolved (isResolved),
            INDEX idx_app_sdk (appName, sdkVersion)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
};

exports.down = async function (connection) {
  await connection.query('DROP TABLE IF EXISTS unknown_flags');
};
