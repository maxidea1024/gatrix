/**
 * Service Accounts System
 *
 * Service accounts provide an identity for automation tools (e.g. Actions)
 * to access the Gatrix API with specific permissions.
 * They reuse the existing g_users table with authType='service-account'.
 * Tokens are managed in a separate table.
 */

exports.up = async function (connection) {
    console.log('Creating service accounts system...');

    // Service account tokens table
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_service_account_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL COMMENT 'Reference to g_users.id (service account user)',
      name VARCHAR(255) NOT NULL COMMENT 'Token name for identification',
      tokenHash VARCHAR(255) NOT NULL COMMENT 'Hashed token value',
      description TEXT NULL,
      expiresAt TIMESTAMP NULL COMMENT 'Token expiration date (NULL = never expires)',
      lastUsedAt TIMESTAMP NULL,
      createdBy INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (userId),
      INDEX idx_token_hash (tokenHash),
      INDEX idx_expires_at (expiresAt),
      CONSTRAINT fk_sa_tokens_user FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE,
      CONSTRAINT fk_sa_tokens_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    console.log('✓ Service accounts system created');
};

exports.down = async function (connection) {
    await connection.execute('DROP TABLE IF EXISTS g_service_account_tokens');
};
