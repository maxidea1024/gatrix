/**
 * 013 - Refactor service account tokens for RBAC
 *
 * The g_service_account_tokens table was originally designed with environmentId
 * to scope tokens to a single environment. With the RBAC system, environment
 * access is managed through roles, so environmentId is no longer needed.
 *
 * Changes:
 * - Add serviceAccountId column (references g_users.id for the service account)
 * - Migrate existing data: copy environmentId values to serviceAccountId
 * - Drop environmentId column
 * - Drop permissions JSON column (managed by RBAC roles now)
 */

exports.up = async function (connection) {
    console.log('[013] Refactoring service account tokens for RBAC...');

    // Add serviceAccountId column
    await connection.execute(`
    ALTER TABLE g_service_account_tokens
    ADD COLUMN serviceAccountId CHAR(26) NULL AFTER id
  `);

    // Migrate existing data: environmentId was being used to store the service account user ID
    await connection.execute(`
    UPDATE g_service_account_tokens
    SET serviceAccountId = environmentId
    WHERE serviceAccountId IS NULL
  `);

    // Make serviceAccountId NOT NULL after migration
    await connection.execute(`
    ALTER TABLE g_service_account_tokens
    MODIFY COLUMN serviceAccountId CHAR(26) NOT NULL
  `);

    // Add foreign key and index
    await connection.execute(`
    ALTER TABLE g_service_account_tokens
    ADD CONSTRAINT fk_sat_service_account FOREIGN KEY (serviceAccountId) REFERENCES g_users(id) ON DELETE CASCADE,
    ADD INDEX idx_service_account_id (serviceAccountId)
  `);

    // Drop environmentId column and index
    await connection.execute(`
    ALTER TABLE g_service_account_tokens
    DROP INDEX idx_environment_id,
    DROP COLUMN environmentId
  `);

    // Drop permissions column (managed by RBAC roles now)
    await connection.execute(`
    ALTER TABLE g_service_account_tokens
    DROP COLUMN permissions
  `);

    console.log('[013] ??Service account tokens refactored for RBAC');
};

exports.down = async function (connection) {
    // Re-add permissions column
    await connection.execute(`
    ALTER TABLE g_service_account_tokens
    ADD COLUMN permissions JSON NULL AFTER tokenValue
  `);

    // Re-add environmentId column
    await connection.execute(`
    ALTER TABLE g_service_account_tokens
    ADD COLUMN environmentId CHAR(26) NOT NULL AFTER id
  `);

    // Copy serviceAccountId back to environmentId
    await connection.execute(`
    UPDATE g_service_account_tokens
    SET environmentId = serviceAccountId
  `);

    // Add back the index
    await connection.execute(`
    ALTER TABLE g_service_account_tokens
    ADD INDEX idx_environment_id (environmentId)
  `);

    // Drop serviceAccountId column, FK, and index
    await connection.execute(`
    ALTER TABLE g_service_account_tokens
    DROP FOREIGN KEY fk_sat_service_account,
    DROP INDEX idx_service_account_id,
    DROP COLUMN serviceAccountId
  `);
};
