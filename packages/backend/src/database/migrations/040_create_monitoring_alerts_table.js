"use strict";

/**
 * Migration for monitoring_alerts table
 */

module.exports = {
  async up(connection) {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS monitoring_alerts (
        id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
        alertName VARCHAR(255) NOT NULL,
        alertSeverity VARCHAR(32) NOT NULL,
        alertStatus VARCHAR(32) NOT NULL,
        alertMessage TEXT NULL,
        alertLabels JSON NULL,
        alertAnnotations JSON NULL,
        startsAt DATETIME NULL,
        endsAt DATETIME NULL,
        generatorUrl TEXT NULL,
        fingerprint VARCHAR(128) NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_alertSeverity (alertSeverity),
        INDEX idx_alertStatus (alertStatus),
        INDEX idx_startsAt (startsAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  },

  async down(connection) {
    await connection.execute(`
      DROP TABLE IF EXISTS monitoring_alerts;
    `);
  },
};

