/**
 * Migration: Grant wildcard permission to all admin users
 *
 * This ensures that admin users (including the super admin) have access to all features
 * including any newly added ones without needing explicit permission entries.
 */

exports.up = async function (connection) {
    // Grant '*' permission to all users with role 'admin'
    await connection.execute(`
    INSERT IGNORE INTO g_user_permissions (userId, permission)
    SELECT id, '*' FROM g_users WHERE role = 'admin'
  `);

    console.log('[Migration 049] Granted wildcard permission (*) to all admin users');
};

exports.down = async function (connection) {
    // We don't remove the wildcard permission in down because it's a safety feature
    // but if we must:
    /*
    await connection.execute(`
      DELETE FROM g_user_permissions WHERE permission = '*'
    `);
    */
    console.log('[Migration 049] Wildcard permission granted (no-op on down)');
};
