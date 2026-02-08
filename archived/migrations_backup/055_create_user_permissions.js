/**
 * Migration: Create user permissions table for RBAC
 *
 * This migration creates the g_user_permissions table to store user permissions.
 * It also seeds all permissions to admin@gatrix.com as the default super user.
 */

const { ALL_PERMISSIONS } = require('../../types/permissions');

module.exports = {
  id: '055_create_user_permissions',

  async up(db) {
    // Check if table already exists
    const [tableExists] = await db.query(
      `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_user_permissions'`
    );

    if (tableExists[0].cnt === 0) {
      // Create g_user_permissions table
      // Note: g_users.id is INT (not UNSIGNED), so userId must match
      await db.query(`
        CREATE TABLE g_user_permissions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          userId INT NOT NULL,
          permission VARCHAR(100) NOT NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE,
          UNIQUE KEY uk_user_permission (userId, permission),
          INDEX idx_user_id (userId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('Created g_user_permissions table');
    } else {
      console.log('Table g_user_permissions already exists, skipping creation...');
    }

    // Seed all permissions to admin@gatrix.com
    const [adminUsers] = await db.query(
      `SELECT id FROM g_users WHERE email = 'admin@gatrix.com' LIMIT 1`
    );

    if (adminUsers.length > 0) {
      const adminUserId = adminUsers[0].id;

      // Check if admin already has permissions
      const [existingPerms] = await db.query(
        `SELECT COUNT(*) as cnt FROM g_user_permissions WHERE userId = ?`,
        [adminUserId]
      );

      if (existingPerms[0].cnt === 0) {
        // Insert all permissions for admin user
        const values = ALL_PERMISSIONS.map((p) => `(${adminUserId}, '${p}')`).join(', ');
        await db.query(`INSERT INTO g_user_permissions (userId, permission) VALUES ${values}`);
        console.log(`Seeded ${ALL_PERMISSIONS.length} permissions to admin@gatrix.com`);
      } else {
        console.log('Admin user already has permissions, skipping seed...');
      }
    } else {
      console.log('Admin user not found, skipping permission seed...');
    }

    console.log('Migration 055 completed successfully');
  },

  async down(db) {
    await db.query('DROP TABLE IF EXISTS g_user_permissions');
    console.log('Dropped g_user_permissions table');
  },
};
