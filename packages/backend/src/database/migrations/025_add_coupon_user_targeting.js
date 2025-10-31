/**
 * Migration: Add user ID targeting support to coupon system
 * Creates g_coupon_target_users table to store targeted user IDs
 * Adds targetUserIdsInverted column to g_coupon_settings
 */

exports.up = async function(connection) {
  console.log('Adding user ID targeting support to coupon system...');

  // Add targetUserIdsInverted column to g_coupon_settings
  await connection.execute(`
    ALTER TABLE g_coupon_settings
    ADD COLUMN targetUserIdsInverted BOOLEAN NOT NULL DEFAULT FALSE 
      COMMENT 'Inverted mode for user ID targeting'
      AFTER targetWorldsInverted
  `);

  console.log('✅ Added targetUserIdsInverted column to g_coupon_settings');

  // Create g_coupon_target_users table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_coupon_target_users (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      settingId VARCHAR(26) NOT NULL,
      userId VARCHAR(64) NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_setting_user (settingId, userId),
      INDEX idx_setting (settingId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('✅ Created g_coupon_target_users table');
};

exports.down = async function(connection) {
  console.log('Reverting user ID targeting support from coupon system...');

  // Drop g_coupon_target_users table
  await connection.execute(`
    DROP TABLE IF EXISTS g_coupon_target_users
  `);

  console.log('✅ Dropped g_coupon_target_users table');

  // Remove targetUserIdsInverted column from g_coupon_settings
  const [columns] = await connection.execute(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'g_coupon_settings' AND COLUMN_NAME = 'targetUserIdsInverted'
  `);

  if (columns.length > 0) {
    await connection.execute(`
      ALTER TABLE g_coupon_settings
      DROP COLUMN targetUserIdsInverted
    `);
    console.log('✅ Removed targetUserIdsInverted column from g_coupon_settings');
  }
};

