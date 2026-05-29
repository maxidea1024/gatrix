/**
 * 023 - Add scopeType column to g_roles
 *
 * Adds a scopeType column to distinguish system-scope roles from org/project roles.
 * System-scope roles (with *:* permission) should only be visible to system admins.
 * Existing roles with *:* permission in g_role_permissions are set to 'system',
 * all others default to 'org'.
 */

exports.up = async function (connection) {
  console.log('[023] Adding scopeType column to g_roles...');

  // 1. Check if column already exists
  const [cols] = await connection.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_roles' AND COLUMN_NAME = 'scopeType'`
  );

  if (cols.length === 0) {
    await connection.execute(`
      ALTER TABLE g_roles
      ADD COLUMN scopeType VARCHAR(20) NOT NULL DEFAULT 'org' AFTER description
    `);
    console.log('[023] ??scopeType column added to g_roles');
  }

  // 2. Set scopeType = 'system' for roles that have *:* permission
  await connection.execute(`
    UPDATE g_roles
    SET scopeType = 'system'
    WHERE id IN (
      SELECT DISTINCT roleId FROM g_role_permissions WHERE permission = '*:*'
    )
  `);

  console.log('[023] ??System-scope roles marked');
};

exports.down = async function (connection) {
  console.log('[023] Reverting scopeType column from g_roles...');

  const [cols] = await connection.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_roles' AND COLUMN_NAME = 'scopeType'`
  );

  if (cols.length > 0) {
    await connection.execute(`ALTER TABLE g_roles DROP COLUMN scopeType`);
  }

  console.log('[023] ??scopeType column removed from g_roles');
};
