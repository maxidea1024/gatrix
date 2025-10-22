/**
 * Migration: Add targeting fields to surveys table
 * 
 * Adds targeting fields similar to ingame popup notices:
 * - targetPlatforms
 * - targetWorlds
 * - targetMarkets
 * - targetClientVersions
 * - targetAccountIds
 */

exports.up = async function(connection) {
  console.log('Adding targeting fields to g_surveys table...');

  await connection.execute(`
    ALTER TABLE g_surveys
    ADD COLUMN targetPlatforms JSON NULL COMMENT 'Target platforms (e.g., ["pc", "ios", "android"])',
    ADD COLUMN targetWorlds JSON NULL COMMENT 'Target world IDs',
    ADD COLUMN targetMarkets JSON NULL COMMENT 'Target markets (e.g., ["kr", "global"])',
    ADD COLUMN targetClientVersions JSON NULL COMMENT 'Target client versions',
    ADD COLUMN targetAccountIds JSON NULL COMMENT 'Target account IDs for specific users'
  `);

  console.log('✅ Successfully added targeting fields to g_surveys table');
};

exports.down = async function(connection) {
  console.log('Removing targeting fields from g_surveys table...');

  await connection.execute(`
    ALTER TABLE g_surveys
    DROP COLUMN targetPlatforms,
    DROP COLUMN targetWorlds,
    DROP COLUMN targetMarkets,
    DROP COLUMN targetClientVersions,
    DROP COLUMN targetAccountIds
  `);

  console.log('✅ Successfully removed targeting fields from g_surveys table');
};

