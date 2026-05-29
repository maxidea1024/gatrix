/**
 * 045 - Rename 'project' token type to 'universal_client'
 *
 * 1. Add 'universal_client' to g_api_access_tokens.tokenType ENUM
 * 2. Update existing 'project' rows to 'universal_client'
 * 3. Update token prefix from 'gxp_' to 'gxuc_'
 * 4. Remove 'project' from ENUM
 */

exports.up = async function (connection) {
  console.log('[045] Starting project ??universal_client rename migration...');

  // 1. Add 'universal_client' to ENUM (keep 'project' temporarily)
  console.log('[045] Expanding tokenType ENUM...');
  await connection.execute(`
    ALTER TABLE g_api_access_tokens
    MODIFY COLUMN tokenType ENUM('client', 'server', 'edge', 'project', 'universal_client') NOT NULL DEFAULT 'server'
  `);

  // 2. Update existing tokenType values
  console.log('[045] Updating tokenType: project ??universal_client...');
  await connection.execute(`
    UPDATE g_api_access_tokens
    SET tokenType = 'universal_client'
    WHERE tokenType = 'project'
  `);

  // 3. Update token prefix: gxp_ ??gxuc_
  console.log('[045] Updating token prefix: gxp_ ??gxuc_...');
  await connection.execute(`
    UPDATE g_api_access_tokens
    SET tokenValue = CONCAT('gxuc_', SUBSTRING(tokenValue, 5))
    WHERE tokenValue LIKE 'gxp_%'
  `);

  // 4. Remove 'project' from ENUM
  console.log('[045] Removing project from ENUM...');
  await connection.execute(`
    ALTER TABLE g_api_access_tokens
    MODIFY COLUMN tokenType ENUM('client', 'server', 'edge', 'universal_client') NOT NULL DEFAULT 'server'
  `);

  console.log('[045] ??Rename migration completed');
};

exports.down = async function (connection) {
  console.log('[045] Reverting universal_client ??project rename...');

  // 1. Add 'project' back to ENUM
  await connection.execute(`
    ALTER TABLE g_api_access_tokens
    MODIFY COLUMN tokenType ENUM('client', 'server', 'edge', 'project', 'universal_client') NOT NULL DEFAULT 'server'
  `);

  // 2. Revert tokenType values
  await connection.execute(`
    UPDATE g_api_access_tokens
    SET tokenType = 'project'
    WHERE tokenType = 'universal_client'
  `);

  // 3. Revert token prefix: gxuc_ ??gxp_
  await connection.execute(`
    UPDATE g_api_access_tokens
    SET tokenValue = CONCAT('gxp_', SUBSTRING(tokenValue, 6))
    WHERE tokenValue LIKE 'gxuc_%'
  `);

  // 4. Remove 'universal_client' from ENUM
  await connection.execute(`
    ALTER TABLE g_api_access_tokens
    MODIFY COLUMN tokenType ENUM('client', 'server', 'edge', 'project') NOT NULL DEFAULT 'server'
  `);

  console.log('[045] ??Revert completed');
};
