/**
 * Migration: Add target filtering columns to g_surveys table
 * Adds targetChannels, targetChannelsInverted, targetPlatforms, targetPlatformsInverted,
 * targetSubchannels, targetSubchannelsInverted, targetWorlds, targetWorldsInverted
 */
exports.up = async function (connection) {
  console.log('[036] Adding target columns to g_surveys...');

  await connection.execute(`
    ALTER TABLE g_surveys
      ADD COLUMN targetPlatforms JSON NULL AFTER isActive,
      ADD COLUMN targetPlatformsInverted BOOLEAN NOT NULL DEFAULT FALSE AFTER targetPlatforms,
      ADD COLUMN targetChannels JSON NULL AFTER targetPlatformsInverted,
      ADD COLUMN targetChannelsInverted BOOLEAN NOT NULL DEFAULT FALSE AFTER targetChannels,
      ADD COLUMN targetSubchannels JSON NULL AFTER targetChannelsInverted,
      ADD COLUMN targetSubchannelsInverted BOOLEAN NOT NULL DEFAULT FALSE AFTER targetSubchannels,
      ADD COLUMN targetWorlds JSON NULL AFTER targetSubchannelsInverted,
      ADD COLUMN targetWorldsInverted BOOLEAN NOT NULL DEFAULT FALSE AFTER targetWorlds
  `);

  console.log('[036] Done.');
};

exports.down = async function (connection) {
  await connection.execute(`
    ALTER TABLE g_surveys
      DROP COLUMN targetPlatforms,
      DROP COLUMN targetPlatformsInverted,
      DROP COLUMN targetChannels,
      DROP COLUMN targetChannelsInverted,
      DROP COLUMN targetSubchannels,
      DROP COLUMN targetSubchannelsInverted,
      DROP COLUMN targetWorlds,
      DROP COLUMN targetWorldsInverted
  `);
};
