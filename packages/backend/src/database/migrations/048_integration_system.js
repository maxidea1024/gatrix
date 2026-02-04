/**
 * Migration: Create Integration System Tables
 *
 * Creates tables for external service integration (Slack, Webhook, Teams, Lark)
 * - g_integrations: Integration configuration storage
 * - g_integration_events: Integration event logs
 */

exports.up = async function (connection) {
  // Create g_integrations table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_integrations (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      provider VARCHAR(50) NOT NULL COMMENT 'slack, webhook, teams, lark',
      description VARCHAR(500) NULL,
      isEnabled BOOLEAN DEFAULT TRUE,
      parameters JSON NULL COMMENT 'Provider-specific settings (url, token, etc.)',
      events JSON NULL COMMENT 'Subscribed event types',
      environments JSON NULL COMMENT 'Filter by environments (empty = all)',
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_provider (provider),
      INDEX idx_isEnabled (isEnabled),
      FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ Created g_integrations table');

  // Create g_integration_events table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_integration_events (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      integrationId VARCHAR(26) NOT NULL,
      eventType VARCHAR(100) NOT NULL COMMENT 'Original event type',
      state VARCHAR(20) NOT NULL COMMENT 'success, failed, successWithErrors',
      stateDetails TEXT NULL,
      eventData JSON NULL COMMENT 'Event details',
      details JSON NULL COMMENT 'Delivery details (url, channels, etc.)',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_integrationId (integrationId),
      INDEX idx_createdAt (createdAt),
      INDEX idx_state (state),
      FOREIGN KEY (integrationId) REFERENCES g_integrations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ Created g_integration_events table');

  console.log('Integration system migration completed successfully!');
};

exports.down = async function (connection) {
  await connection.execute('DROP TABLE IF EXISTS g_integration_events');
  await connection.execute('DROP TABLE IF EXISTS g_integrations');
  console.log('✓ Dropped integration system tables');
};
