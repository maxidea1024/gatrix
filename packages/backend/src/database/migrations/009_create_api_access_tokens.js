/**
 * Migration: Create API Access Tokens table
 *
 * This migration creates the g_api_access_tokens table for managing
 * API tokens used by client and server SDKs.
 */

exports.up = async function(connection) {
  console.log('Creating g_api_access_tokens table...');

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_api_access_tokens (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      tokenName VARCHAR(255) NOT NULL,
      description TEXT NULL,
      tokenValue VARCHAR(255) NOT NULL UNIQUE,
      tokenType ENUM('client', 'server') NOT NULL,
      allowAllEnvironments BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'If true, token can access all environments',
      expiresAt TIMESTAMP NULL,
      lastUsedAt TIMESTAMP NULL,
      usageCount BIGINT DEFAULT 0,
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      CONSTRAINT fk_api_token_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id),
      CONSTRAINT fk_api_token_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id),

      INDEX idx_token_type (tokenType),
      INDEX idx_created_by (createdBy),
      INDEX idx_created_at (createdAt),
      INDEX idx_last_used_at (lastUsedAt),
      INDEX idx_expires_at (expiresAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('✅ g_api_access_tokens table created successfully');
};

exports.down = async function(connection) {
  console.log('Dropping g_api_access_tokens table...');
  
  await connection.execute(`
    DROP TABLE IF EXISTS g_api_access_tokens
  `);
  
  console.log('✅ g_api_access_tokens table dropped successfully');
};

