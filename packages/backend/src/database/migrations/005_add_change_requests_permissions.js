/**
 * Migration: Add change-requests permissions
 *
 * Adds missing change-requests.view and change-requests.manage permissions
 * to admin users who already have other permissions.
 */

exports.up = async function (connection) {
  // Add change-requests permissions to all users who have the '*' permission
  // or who have admin-level access (have any .manage permission)
  await connection.execute(`
    INSERT IGNORE INTO g_user_permissions (userId, permission)
    SELECT DISTINCT userId, 'change-requests.view'
    FROM g_user_permissions
    WHERE permission = '*' OR permission LIKE '%.manage'
  `);

  await connection.execute(`
    INSERT IGNORE INTO g_user_permissions (userId, permission)
    SELECT DISTINCT userId, 'change-requests.manage'
    FROM g_user_permissions
    WHERE permission = '*' OR permission LIKE '%.manage'
  `);

  // Also explicitly add to userId 1 (admin@gatrix.com) to ensure it's there
  await connection.execute(`
    INSERT IGNORE INTO g_user_permissions (userId, permission)
    VALUES (1, 'change-requests.view'), (1, 'change-requests.manage')
  `);

  console.log('[Migration 005] Added change-requests permissions to admin users');
};

exports.down = async function (connection) {
  await connection.execute(`
    DELETE FROM g_user_permissions
    WHERE permission IN ('change-requests.view', 'change-requests.manage')
  `);

  console.log('[Migration 005] Removed change-requests permissions');
};
