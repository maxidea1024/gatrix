/**
 * Migration: Add wildcard permission to super admin
 *
 * This migration replaces all individual permissions for admin@gatrix.com
 * with a single wildcard '*' permission that grants all permissions.
 * This ensures new permissions are automatically granted to super admin.
 */

module.exports = {
  id: '057_add_superadmin_wildcard_permission',

  async up(db) {
    console.log('Adding wildcard permission to super admin...');

    // Find admin@gatrix.com user
    const [users] = await db.query(
      `SELECT id FROM g_users WHERE email = 'admin@gatrix.com' LIMIT 1`
    );

    if (users.length === 0) {
      console.log('Super admin user (admin@gatrix.com) not found, skipping...');
      return;
    }

    const adminUserId = users[0].id;
    console.log(`Found super admin user with id: ${adminUserId}`);

    // Delete all existing permissions for this user
    await db.query(`DELETE FROM g_user_permissions WHERE userId = ?`, [adminUserId]);
    console.log('Removed all existing permissions for super admin');

    // Insert wildcard permission
    await db.query(`INSERT INTO g_user_permissions (userId, permission) VALUES (?, '*')`, [
      adminUserId,
    ]);
    console.log('Added wildcard (*) permission to super admin');
  },

  async down(db) {
    console.log('Rolling back wildcard permission...');

    // Find admin@gatrix.com user
    const [users] = await db.query(
      `SELECT id FROM g_users WHERE email = 'admin@gatrix.com' LIMIT 1`
    );

    if (users.length === 0) {
      console.log('Super admin user (admin@gatrix.com) not found, skipping...');
      return;
    }

    const adminUserId = users[0].id;

    // Remove wildcard permission
    await db.query(`DELETE FROM g_user_permissions WHERE userId = ? AND permission = '*'`, [
      adminUserId,
    ]);
    console.log('Removed wildcard permission from super admin');

    // Re-add all individual permissions (from permissions.ts)
    const { ALL_PERMISSIONS } = require('../../types/permissions');

    for (const permission of ALL_PERMISSIONS) {
      try {
        await db.query(`INSERT IGNORE INTO g_user_permissions (userId, permission) VALUES (?, ?)`, [
          adminUserId,
          permission,
        ]);
      } catch (e) {
        // Ignore duplicate key errors
      }
    }
    console.log(`Re-added ${ALL_PERMISSIONS.length} individual permissions to super admin`);
  },
};
