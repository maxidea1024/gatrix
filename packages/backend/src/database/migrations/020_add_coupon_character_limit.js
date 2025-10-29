/**
 * Migration: Add character-level coupon usage limit support
 * 
 * Adds:
 * 1. usageLimitType column to g_coupon_settings (ENUM: USER, CHARACTER)
 * 2. characterId column to g_coupon_uses
 */

exports.up = async function(connection) {
  console.log('Adding character-level coupon usage limit support...');

  // Add usageLimitType column to g_coupon_settings
  await connection.execute(`
    ALTER TABLE g_coupon_settings
    ADD COLUMN usageLimitType ENUM('USER', 'CHARACTER') 
      NOT NULL DEFAULT 'USER' 
      COMMENT 'Coupon usage limit type: USER (per user) or CHARACTER (per character)'
      AFTER perUserLimit
  `);

  console.log('✅ Added usageLimitType column to g_coupon_settings');

  // Add characterId column to g_coupon_uses
  await connection.execute(`
    ALTER TABLE g_coupon_uses
    ADD COLUMN characterId VARCHAR(64) NULL 
      COMMENT 'Character ID (for character-level usage tracking)'
      AFTER userId
  `);

  console.log('✅ Added characterId column to g_coupon_uses');

  // Add index on characterId for faster queries
  await connection.execute(`
    ALTER TABLE g_coupon_uses
    ADD INDEX idx_characterId (characterId)
  `);

  console.log('✅ Added index on characterId column');
};

exports.down = async function(connection) {
  console.log('Rolling back character-level coupon usage limit support...');

  // Drop index
  await connection.execute(`
    ALTER TABLE g_coupon_uses
    DROP INDEX idx_characterId
  `);

  console.log('✅ Dropped index on characterId column');

  // Drop characterId column
  await connection.execute(`
    ALTER TABLE g_coupon_uses
    DROP COLUMN characterId
  `);

  console.log('✅ Dropped characterId column from g_coupon_uses');

  // Drop usageLimitType column
  await connection.execute(`
    ALTER TABLE g_coupon_settings
    DROP COLUMN usageLimitType
  `);

  console.log('✅ Dropped usageLimitType column from g_coupon_settings');
};

