/**
 * 044 - Project Token and Client Version Scope Migration
 *
 * 1. Add 'project' to g_api_access_tokens.tokenType ENUM
 * 2. Add projectId + targetEnv columns to g_client_versions
 * 3. Migrate existing data: environmentId ??projectId + targetEnv
 * 4. Remove environmentId, update unique constraint
 */

exports.up = async function (connection) {
  console.log('[044] Starting project token and client version scope migration...');

  // 1. Add 'project' to tokenType ENUM
  console.log('[044] Adding "project" to tokenType ENUM...');
  await connection.execute(`
    ALTER TABLE g_api_access_tokens
    MODIFY COLUMN tokenType ENUM('client', 'server', 'edge', 'project') NOT NULL DEFAULT 'server'
  `);
  console.log('[044] ??tokenType ENUM updated');

  // 2. Add projectId column to g_client_versions
  console.log('[044] Adding projectId column to g_client_versions...');
  await connection.execute(`
    ALTER TABLE g_client_versions
    ADD COLUMN projectId CHAR(26) NULL AFTER environmentId
  `);

  // 3. Add targetEnv column to g_client_versions
  console.log('[044] Adding targetEnv column to g_client_versions...');
  await connection.execute(`
    ALTER TABLE g_client_versions
    ADD COLUMN targetEnv CHAR(26) NULL AFTER projectId
  `);

  // 4. Migrate existing data: resolve projectId from environment, set targetEnv = current environmentId
  console.log('[044] Migrating existing client version data...');
  await connection.execute(`
    UPDATE g_client_versions cv
    JOIN g_environments e ON cv.environmentId = e.id
    SET cv.projectId = e.projectId,
        cv.targetEnv = cv.environmentId
  `);

  // 5. Set projectId as NOT NULL
  console.log('[044] Setting projectId as NOT NULL...');
  await connection.execute(`
    ALTER TABLE g_client_versions
    MODIFY COLUMN projectId CHAR(26) NOT NULL
  `);

  // 6. Drop old unique constraint
  console.log('[044] Dropping old unique constraint...');
  await connection.execute(`
    ALTER TABLE g_client_versions
    DROP INDEX unique_env_platform_version
  `);

  // 7. Drop old environmentId index
  console.log('[044] Dropping old environmentId index...');
  await connection.execute(`
    ALTER TABLE g_client_versions
    DROP INDEX idx_environment_id
  `);

  // 8. Drop environmentId column
  console.log('[044] Dropping environmentId column...');
  await connection.execute(`
    ALTER TABLE g_client_versions
    DROP COLUMN environmentId
  `);

  // 9. Add new unique constraint (projectId + platform + clientVersion)
  console.log('[044] Adding new unique constraint...');
  await connection.execute(`
    ALTER TABLE g_client_versions
    ADD UNIQUE KEY uk_project_platform_version (projectId, platform, clientVersion)
  `);

  // 10. Add projectId index
  console.log('[044] Adding projectId index...');
  await connection.execute(`
    ALTER TABLE g_client_versions
    ADD INDEX idx_project_id (projectId)
  `);

  console.log('[044] ??Project token and client version scope migration completed');
};

exports.down = async function (connection) {
  console.log('[044] Reverting project token and client version scope migration...');

  // Re-add environmentId column
  await connection.execute(`
    ALTER TABLE g_client_versions
    ADD COLUMN environmentId CHAR(26) NULL AFTER id
  `);

  // Restore data from targetEnv ??environmentId
  await connection.execute(`
    UPDATE g_client_versions
    SET environmentId = targetEnv
  `);

  // Make environmentId NOT NULL
  await connection.execute(`
    ALTER TABLE g_client_versions
    MODIFY COLUMN environmentId CHAR(26) NOT NULL
  `);

  // Drop new unique constraint
  await connection.execute(`
    ALTER TABLE g_client_versions
    DROP INDEX uk_project_platform_version
  `);

  // Drop projectId index
  await connection.execute(`
    ALTER TABLE g_client_versions
    DROP INDEX idx_project_id
  `);

  // Drop projectId and targetEnv columns
  await connection.execute(`
    ALTER TABLE g_client_versions
    DROP COLUMN projectId,
    DROP COLUMN targetEnv
  `);

  // Restore old unique constraint and index
  await connection.execute(`
    ALTER TABLE g_client_versions
    ADD UNIQUE KEY unique_env_platform_version (environmentId, platform, clientVersion),
    ADD INDEX idx_environment_id (environmentId)
  `);

  // Revert tokenType ENUM
  await connection.execute(`
    ALTER TABLE g_api_access_tokens
    MODIFY COLUMN tokenType ENUM('client', 'server', 'edge') NOT NULL DEFAULT 'server'
  `);

  console.log('[044] ??Revert completed');
};
