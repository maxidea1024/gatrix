/**
 * 024 - Add description column to g_role_bindings
 *
 * Adds a nullable description field for easier identification of role bindings.
 */

exports.up = async function (connection) {
  console.log('[024] Adding description column to g_role_bindings...');

  const [cols] = await connection.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_role_bindings' AND COLUMN_NAME = 'description'`
  );

  if (cols.length === 0) {
    await connection.execute(`
      ALTER TABLE g_role_bindings
      ADD COLUMN description VARCHAR(255) NULL AFTER assignedAt
    `);
    console.log('[024] ??description column added to g_role_bindings');
  } else {
    console.log('[024] description column already exists, skipping');
  }
};

exports.down = async function (connection) {
  console.log('[024] Reverting description column from g_role_bindings...');

  const [cols] = await connection.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_role_bindings' AND COLUMN_NAME = 'description'`
  );

  if (cols.length > 0) {
    await connection.execute(`ALTER TABLE g_role_bindings DROP COLUMN description`);
  }

  console.log('[024] ??description column removed from g_role_bindings');
};
