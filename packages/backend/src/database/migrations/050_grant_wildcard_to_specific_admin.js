/**
 * Migration: Grant wildcard permission (*) to admin@gatrix.com
 *
 * This ensures that the primary admin account has full system access.
 * This migration is added because some released versions were missing this permission.
 */

exports.up = async function (connection) {
    // Grant '*' permission specifically to admin@gatrix.com
    // Using INSERT IGNORE to prevent duplicate errors
    await connection.execute(`
    INSERT IGNORE INTO g_user_permissions (userId, permission)
    SELECT id, '*' FROM g_users WHERE email = 'admin@gatrix.com'
  `);

    console.log('[Migration 050] Granted wildcard permission (*) to admin@gatrix.com');
};

exports.down = async function (connection) {
    // We don't remove permissions in down for safety reasons in this context,
    // but if needed, we could find the user by email and delete their '*' permission.
    console.log('[Migration 050] Down migration (no-op for safety)');
};
