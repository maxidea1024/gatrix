/**
 * Migration: Add channel and subchannel targeting to service notices
 *
 * Adds support for channel and subchannel filtering in service notices,
 * similar to the coupon system.
 */

async function up(connection) {
  console.log('Adding channel and subchannel targeting to service notices...');

  // Add channels and subchannels JSON columns to g_service_notices
  await connection.execute(`
    ALTER TABLE g_service_notices
    ADD COLUMN channels JSON DEFAULT NULL COMMENT 'Target channels (e.g., ["official", "kakao"])'
    AFTER platforms
  `);

  await connection.execute(`
    ALTER TABLE g_service_notices
    ADD COLUMN subchannels JSON DEFAULT NULL COMMENT 'Target subchannels in "channel:subchannel" format'
    AFTER channels
  `);

  console.log('✓ Added channels and subchannels columns to g_service_notices');
}

async function down(connection) {
  console.log('Removing channel and subchannel targeting from service notices...');

  await connection.execute(`
    ALTER TABLE g_service_notices
    DROP COLUMN subchannels
  `);

  await connection.execute(`
    ALTER TABLE g_service_notices
    DROP COLUMN channels
  `);

  console.log('✓ Removed channels and subchannels columns from g_service_notices');
}

module.exports = { up, down };
