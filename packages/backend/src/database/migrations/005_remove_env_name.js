/**
 * 005 - Remove name column from g_environments
 * 
 * The `name` field was a slug-like identifier (e.g. "development", "production").
 * Since we now use ULID `id` as the primary identifier everywhere,
 * `name` is redundant and causes confusion.
 * `displayName` becomes the unique human-readable identifier.
 */

exports.up = async function (connection) {
  console.log('[005] Removing name column from g_environments...');

  // 1. Drop the unique constraint on (projectId, name)
  try {
    await connection.execute(`
      ALTER TABLE g_environments DROP INDEX uniq_project_env
    `);
    console.log('[005] ??Dropped unique index uniq_project_env');
  } catch (e) {
    console.log('[005] ??uniq_project_env index not found, skipping');
  }

  // 2. Add unique constraint on (projectId, displayName)
  await connection.execute(`
    ALTER TABLE g_environments 
    ADD UNIQUE KEY uniq_project_display (projectId, displayName)
  `);
  console.log('[005] ??Added unique index uniq_project_display');

  // 3. Drop the name column
  await connection.execute(`
    ALTER TABLE g_environments DROP COLUMN name
  `);
  console.log('[005] ??Dropped name column');

  console.log('[005] ??Migration complete');
};

exports.down = async function (connection) {
  // 1. Re-add name column
  await connection.execute(`
    ALTER TABLE g_environments ADD COLUMN name VARCHAR(100) NOT NULL DEFAULT '' AFTER id
  `);

  // 2. Populate name from displayName (lowercased, spaces replaced with hyphens)
  await connection.execute(`
    UPDATE g_environments SET name = LOWER(REPLACE(displayName, ' ', '-'))
  `);

  // 3. Drop the new unique constraint
  try {
    await connection.execute(`
      ALTER TABLE g_environments DROP INDEX uniq_project_display
    `);
  } catch (e) {
    // Ignore
  }

  // 4. Re-add original unique constraint
  await connection.execute(`
    ALTER TABLE g_environments ADD UNIQUE KEY uniq_project_env (projectId, name)
  `);
};
