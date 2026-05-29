/**
 * Migration: Drop orgRole column from g_organisation_members
 *
 * The orgRole column is replaced by RBAC role bindings (g_role_bindings).
 * Access control is now determined by assigned roles and their permissions,
 * not by a simple 'admin'/'user' string.
 */

exports.name = 'drop_orgRole_column';

exports.up = async function (connection) {
  console.log('[021] Dropping orgRole column from g_organisation_members...');

  const [columns] = await connection.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_organisation_members' AND COLUMN_NAME = 'orgRole'`
  );

  if (columns.length > 0) {
    await connection.execute('ALTER TABLE g_organisation_members DROP COLUMN orgRole');
    console.log('[021] ??orgRole column dropped');
  } else {
    console.log('[021] orgRole column does not exist, skipping');
  }
};

exports.down = async function (connection) {
  console.log('[021] Re-adding orgRole column to g_organisation_members...');

  const [columns] = await connection.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_organisation_members' AND COLUMN_NAME = 'orgRole'`
  );

  if (columns.length === 0) {
    await connection.execute(
      `ALTER TABLE g_organisation_members ADD COLUMN orgRole VARCHAR(20) DEFAULT 'user' AFTER userId`
    );
    console.log('[021] ??orgRole column re-added');
  } else {
    console.log('[021] orgRole column already exists, skipping');
  }
};
