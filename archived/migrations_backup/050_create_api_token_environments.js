/**
 * Migration: Create API Access Token Environments linking table
 *
 * This migration creates a many-to-many relationship between API access tokens
 * and environments, allowing tokens to be restricted to specific environments.
 */

exports.up = async function (connection) {
  console.log('Creating g_api_access_token_environments table...');

  // Create the linking table (both tokenId and environmentId are ULID CHAR(26))
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_api_access_token_environments (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      tokenId CHAR(26) NOT NULL COMMENT 'ULID reference to g_api_access_tokens',
      environmentId VARCHAR(127) NOT NULL COMMENT 'ULID reference to g_environments',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      UNIQUE KEY uk_token_environment (tokenId, environmentId),

      CONSTRAINT fk_token_env_token FOREIGN KEY (tokenId)
        REFERENCES g_api_access_tokens(id) ON DELETE CASCADE,
      CONSTRAINT fk_token_env_environment FOREIGN KEY (environmentId)
        REFERENCES g_environments(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('g_api_access_token_environments table created successfully');
};

exports.down = async function (connection) {
  console.log('Dropping g_api_access_token_environments table...');

  // Drop the linking table
  await connection.execute('DROP TABLE IF EXISTS g_api_access_token_environments');
  console.log('g_api_access_token_environments table dropped');
};
