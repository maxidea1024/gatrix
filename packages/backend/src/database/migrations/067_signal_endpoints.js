/**
 * Signal Endpoints System
 *
 * Signal endpoints allow external systems to send signals to Gatrix
 * via a simple HTTP POST API. Signals can then trigger automated actions.
 */

exports.up = async function (connection) {
    console.log('Creating signal endpoints system...');

    // Signal endpoints table
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_signal_endpoints (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL COMMENT 'URL-friendly unique name, used in endpoint path',
      description TEXT NULL,
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_name (name),
      INDEX idx_is_enabled (isEnabled),
      CONSTRAINT fk_signal_ep_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_signal_ep_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Signal endpoint tokens table (for authenticating external callers)
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_signal_endpoint_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      signalEndpointId INT NOT NULL,
      name VARCHAR(255) NOT NULL COMMENT 'Token name for identification',
      tokenHash VARCHAR(255) NOT NULL COMMENT 'Hashed token value',
      createdBy INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_signal_endpoint_id (signalEndpointId),
      INDEX idx_token_hash (tokenHash),
      CONSTRAINT fk_sep_token_endpoint FOREIGN KEY (signalEndpointId) REFERENCES g_signal_endpoints(id) ON DELETE CASCADE,
      CONSTRAINT fk_sep_token_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Signals table (incoming signals received from external systems)
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_signals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source VARCHAR(100) NOT NULL DEFAULT 'signal-endpoint' COMMENT 'Signal source type',
      sourceId INT NOT NULL COMMENT 'Reference to the source (e.g. signal endpoint ID)',
      payload JSON NULL COMMENT 'Free-form JSON payload',
      isProcessed BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether this signal has been processed by action engine',
      createdByTokenId INT NULL COMMENT 'Token that sent this signal',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_source (source, sourceId),
      INDEX idx_is_processed (isProcessed),
      INDEX idx_created_at (createdAt),
      INDEX idx_created_by_token (createdByTokenId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    console.log('✓ Signal endpoints system created');
};

exports.down = async function (connection) {
    await connection.execute('DROP TABLE IF EXISTS g_signals');
    await connection.execute('DROP TABLE IF EXISTS g_signal_endpoint_tokens');
    await connection.execute('DROP TABLE IF EXISTS g_signal_endpoints');
};
