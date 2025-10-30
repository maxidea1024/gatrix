/**
 * Migration: Add isCopyable flag to g_vars and rename KV keys
 * - Add isCopyable column to control whether KV items can be duplicated
 * - Rename kv:platforms to $platforms
 * - Rename kv:channels to $channels
 * - Rename kv:clientVersionPassiveData to $clientVersionPassiveData
 * - Set isCopyable=FALSE for these system KV items
 */

exports.up = async function(connection) {
  console.log('Adding isCopyable flag and renaming KV keys...');

  // Add isCopyable column
  await connection.execute(`
    ALTER TABLE g_vars
    ADD COLUMN isCopyable BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether this KV item can be duplicated/copied'
  `);

  console.log('isCopyable column added successfully');

  // Rename kv:platforms to $platforms
  await connection.execute(`
    UPDATE g_vars
    SET varKey = '$platforms', isCopyable = FALSE
    WHERE varKey = 'kv:platforms'
  `);

  console.log('Renamed kv:platforms to $platforms');

  // Rename kv:channels to $channels
  await connection.execute(`
    UPDATE g_vars
    SET varKey = '$channels', isCopyable = FALSE
    WHERE varKey = 'kv:channels'
  `);

  console.log('Renamed kv:channels to $channels');

  // Rename kv:clientVersionPassiveData to $clientVersionPassiveData
  await connection.execute(`
    UPDATE g_vars
    SET varKey = '$clientVersionPassiveData', isCopyable = FALSE
    WHERE varKey = 'kv:clientVersionPassiveData'
  `);

  console.log('Renamed kv:clientVersionPassiveData to $clientVersionPassiveData');
};

exports.down = async function(connection) {
  console.log('Reverting KV key names and removing isCopyable flag...');

  // Rename $platforms back to kv:platforms
  await connection.execute(`
    UPDATE g_vars
    SET varKey = 'kv:platforms'
    WHERE varKey = '$platforms'
  `);

  // Rename $channels back to kv:channels
  await connection.execute(`
    UPDATE g_vars
    SET varKey = 'kv:channels'
    WHERE varKey = '$channels'
  `);

  // Rename $clientVersionPassiveData back to kv:clientVersionPassiveData
  await connection.execute(`
    UPDATE g_vars
    SET varKey = 'kv:clientVersionPassiveData'
    WHERE varKey = '$clientVersionPassiveData'
  `);

  // Remove isCopyable column
  await connection.execute(`
    ALTER TABLE g_vars
    DROP COLUMN isCopyable
  `);

  console.log('Reverted successfully');
};

