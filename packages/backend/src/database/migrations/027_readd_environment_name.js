/**
 * 027 - Re-add name column to g_environments
 *
 * The `name` field is being restored as a slug/identifier
 * (e.g. "development", "staging", "production").
 *
 * This is needed for:
 * - Unsecured token format: unsecured-{org}:{project}:{envName}-{type}-api-token
 * - Prometheus metric labels (human-readable environment name)
 * - Token-based environment resolution (replacing x-environment header)
 *
 * `name` is a URL-safe slug, `displayName` remains the UI label.
 * Unique constraint: (projectId, name)
 */

exports.up = async function (connection) {
  console.log('[027] Re-adding name column to g_environments...');

  // 1. Add name column
  await connection.execute(`
    ALTER TABLE g_environments ADD COLUMN name VARCHAR(100) NOT NULL DEFAULT '' AFTER id
  `);
  console.log('[027] ??Added name column');

  // 2. Populate name from displayName (lowercased, spaces replaced with hyphens)
  await connection.execute(`
    UPDATE g_environments SET name = LOWER(REPLACE(REPLACE(displayName, ' ', '-'), '_', '-'))
  `);
  console.log('[027] ??Populated name from displayName');

  // 3. Add unique constraint on (projectId, name)
  await connection.execute(`
    ALTER TABLE g_environments ADD UNIQUE KEY uq_env_name_project (projectId, name)
  `);
  console.log('[027] ??Added unique index uq_env_name_project');

  console.log('[027] ??Migration complete');
};

exports.down = async function (connection) {
  // 1. Drop the unique constraint
  try {
    await connection.execute(`
      ALTER TABLE g_environments DROP INDEX uq_env_name_project
    `);
  } catch (e) {
    console.log('[027] ??uq_env_name_project index not found, skipping');
  }

  // 2. Drop the name column
  await connection.execute(`
    ALTER TABLE g_environments DROP COLUMN name
  `);
};
