/**
 * Migration: Create Server Lifecycle Events table back
 *
 * This table stores history of server start, stop, error, and timeout events.
 */

module.exports = {
  id: '066_create_server_lifecycle_events',

  async up(db) {
    // Create g_server_lifecycle_events table
    await db.query(`
      CREATE TABLE IF NOT EXISTS g_server_lifecycle_events (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        environmentId VARCHAR(127) NOT NULL,
        instanceId VARCHAR(127) NOT NULL,
        serviceType VARCHAR(63) NOT NULL,
        serviceGroup VARCHAR(63),
        cloudProvider VARCHAR(63),
        cloudRegion VARCHAR(63),
        cloudZone VARCHAR(63),
        serverVersion VARCHAR(63),
        sdkVersion VARCHAR(63),
        eventType VARCHAR(31) NOT NULL, -- REGISTER, UNREGISTER, STATUS_CHANGE, TIMEOUT
        instanceStatus VARCHAR(31) NOT NULL,
        uptimeSeconds INT UNSIGNED DEFAULT 0,
        heartbeatCount INT UNSIGNED DEFAULT 0,
        lastHeartbeatAt TIMESTAMP NULL,
        errorMessage TEXT,
        errorStack LONGTEXT,
        metadata JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_lifecycle_instanceId (instanceId),
        INDEX idx_lifecycle_serviceType (serviceType),
        INDEX idx_lifecycle_serviceGroup (serviceGroup),
        INDEX idx_lifecycle_cloudRegion (cloudRegion),
        INDEX idx_lifecycle_serverVersion (serverVersion),
        INDEX idx_lifecycle_createdAt (createdAt),
        INDEX idx_lifecycle_environmentId (environmentId),
        CONSTRAINT fk_lifecycle_environment FOREIGN KEY (environmentId) REFERENCES g_environments(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('Migration 066_create_server_lifecycle_events completed successfully');
  },

  async down(db) {
    await db.query('DROP TABLE IF EXISTS g_server_lifecycle_events');
    console.log('Migration 066_create_server_lifecycle_events reverted successfully');
  }
};
