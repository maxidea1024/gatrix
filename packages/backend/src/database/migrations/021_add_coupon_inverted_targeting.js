/**
 * Migration: Add inverted targeting fields to coupon system
 * 
 * Adds inverted mode support for coupon targeting:
 * - targetPlatformsInverted: Boolean for inverted platform targeting
 * - targetChannelsInverted: Boolean for inverted channel/subchannel targeting
 * - targetWorldsInverted: Boolean for inverted world targeting
 */

exports.up = async function(connection) {
  console.log('Adding inverted targeting fields to coupon system...');

  // Add inverted columns to g_coupon_settings
  await connection.execute(`
    ALTER TABLE g_coupon_settings
    ADD COLUMN targetPlatformsInverted BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Inverted mode for platform targeting',
    ADD COLUMN targetChannelsInverted BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Inverted mode for channel/subchannel targeting',
    ADD COLUMN targetWorldsInverted BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Inverted mode for world targeting'
  `);

  console.log('✅ Successfully added inverted targeting fields to coupon system');
};

exports.down = async function(connection) {
  console.log('Removing inverted targeting fields from coupon system...');

  // Check if columns exist and drop them
  const [columns] = await connection.execute(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'g_coupon_settings'
    AND COLUMN_NAME IN ('targetPlatformsInverted', 'targetChannelsInverted', 'targetWorldsInverted')
  `);

  const existingColumns = columns.map(col => col.COLUMN_NAME);

  if (existingColumns.includes('targetPlatformsInverted')) {
    await connection.execute('ALTER TABLE g_coupon_settings DROP COLUMN targetPlatformsInverted');
  }
  if (existingColumns.includes('targetChannelsInverted')) {
    await connection.execute('ALTER TABLE g_coupon_settings DROP COLUMN targetChannelsInverted');
  }
  if (existingColumns.includes('targetWorldsInverted')) {
    await connection.execute('ALTER TABLE g_coupon_settings DROP COLUMN targetWorldsInverted');
  }

  console.log('✅ Successfully removed inverted targeting fields from coupon system');
};

