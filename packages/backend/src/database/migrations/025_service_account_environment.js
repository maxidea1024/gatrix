/**
 * 025 - Service Account Environment Assignment
 *
 * Creates g_service_account_environments table to assign
 * a service account to a single environment.
 * Each service account (g_users with authType='service-account')
 * can be assigned to exactly one environment.
 */

exports.up = async function (connection) {
  console.log('[025] Creating g_service_account_environments table...');

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_service_account_environments (
      serviceAccountId CHAR(26) NOT NULL PRIMARY KEY COMMENT 'FK to g_users.id',
      environmentId CHAR(26) NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_sae_user FOREIGN KEY (serviceAccountId) REFERENCES g_users(id) ON DELETE CASCADE,
      CONSTRAINT fk_sae_env FOREIGN KEY (environmentId) REFERENCES g_environments(id) ON DELETE CASCADE,
      INDEX idx_sae_env (environmentId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Auto-insert rows for existing service accounts (environmentId = NULL not possible since NOT NULL,
  // so existing service accounts will need to be assigned via UI)

  console.log('[025] ??g_service_account_environments table created');
};

exports.down = async function (connection) {
  console.log('[025] Dropping g_service_account_environments table...');
  await connection.execute('DROP TABLE IF EXISTS g_service_account_environments');
  console.log('[025] ??g_service_account_environments table dropped');
};
