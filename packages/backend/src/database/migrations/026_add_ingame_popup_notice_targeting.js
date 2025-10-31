/**
 * Migration: Add channel/subchannel targeting, user ID targeting, and inverted mode to ingame popup notices
 *
 * Adds support for channel, subchannel, and user ID targeting with inverted mode,
 * similar to the coupon system implementation.
 * Also removes targetMarkets, targetClientVersions, and targetAccountIds columns.
 */

exports.up = async function(connection) {
  console.log('Adding channel/subchannel/user ID targeting and inverted mode to ingame popup notices...');

  // Check if columns already exist
  const [columnsResult] = await connection.execute(`
    SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'g_ingame_popup_notices'
    AND COLUMN_NAME IN ('targetChannels', 'targetChannelsInverted')
  `);

  if (columnsResult[0].count === 0) {
    // Add targetChannels and targetChannelsInverted columns
    await connection.execute(`
      ALTER TABLE g_ingame_popup_notices
      ADD COLUMN targetChannels JSON NULL
        COMMENT 'Target channels (array of strings)'
        AFTER targetPlatforms,
      ADD COLUMN targetChannelsInverted BOOLEAN NOT NULL DEFAULT FALSE
        COMMENT 'Inverted mode for channel targeting'
        AFTER targetChannels,
      ADD COLUMN targetSubchannels JSON NULL
        COMMENT 'Target subchannels (array of strings)'
        AFTER targetChannelsInverted,
      ADD COLUMN targetSubchannelsInverted BOOLEAN NOT NULL DEFAULT FALSE
        COMMENT 'Inverted mode for subchannel targeting'
        AFTER targetSubchannels
    `);

    console.log('✅ Added targetChannels, targetChannelsInverted, targetSubchannels, targetSubchannelsInverted columns');
  } else {
    console.log('⚠️  Columns already exist, skipping...');
  }

  // Add inverted mode columns for existing targeting fields
  const [platformsInvertedResult] = await connection.execute(`
    SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'g_ingame_popup_notices'
    AND COLUMN_NAME = 'targetPlatformsInverted'
  `);

  if (platformsInvertedResult[0].count === 0) {
    await connection.execute(`
      ALTER TABLE g_ingame_popup_notices
      ADD COLUMN targetPlatformsInverted BOOLEAN NOT NULL DEFAULT FALSE
        COMMENT 'Inverted mode for platform targeting'
        AFTER targetPlatforms,
      ADD COLUMN targetWorldsInverted BOOLEAN NOT NULL DEFAULT FALSE
        COMMENT 'Inverted mode for world targeting'
        AFTER targetWorlds
    `);

    console.log('✅ Added targetPlatformsInverted and targetWorldsInverted columns');
  } else {
    console.log('⚠️  Inverted mode columns already exist, skipping...');
  }

  // Add targetUserIds and targetUserIdsInverted columns
  const [userIdsResult] = await connection.execute(`
    SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'g_ingame_popup_notices'
    AND COLUMN_NAME = 'targetUserIds'
  `);

  if (userIdsResult[0].count === 0) {
    await connection.execute(`
      ALTER TABLE g_ingame_popup_notices
      ADD COLUMN targetUserIds LONGTEXT NULL
        COMMENT 'Target user IDs (comma-separated or newline-separated)'
        AFTER targetSubchannelsInverted,
      ADD COLUMN targetUserIdsInverted BOOLEAN NOT NULL DEFAULT FALSE
        COMMENT 'Inverted mode for user ID targeting'
        AFTER targetUserIds
    `);

    console.log('✅ Added targetUserIds and targetUserIdsInverted columns');
  } else {
    console.log('⚠️  User ID columns already exist, skipping...');
  }

  // Remove old columns if they exist
  const oldColumnsToRemove = ['targetMarkets', 'targetClientVersions', 'targetAccountIds'];

  for (const columnName of oldColumnsToRemove) {
    const [result] = await connection.execute(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'g_ingame_popup_notices'
      AND COLUMN_NAME = ?
    `, [columnName]);

    if (result[0].count > 0) {
      await connection.execute(`ALTER TABLE g_ingame_popup_notices DROP COLUMN ${columnName}`);
      console.log(`✅ Removed column: ${columnName}`);
    }
  }

  console.log('✅ Migration completed successfully');
};

exports.down = async function(connection) {
  console.log('Reverting ingame popup notice targeting migration...');

  // Drop columns individually if they exist
  const columnsToCheck = ['targetChannels', 'targetChannelsInverted', 'targetSubchannels', 'targetSubchannelsInverted', 'targetPlatformsInverted', 'targetWorldsInverted', 'targetUserIds', 'targetUserIdsInverted'];

  for (const columnName of columnsToCheck) {
    const [result] = await connection.execute(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'g_ingame_popup_notices'
      AND COLUMN_NAME = ?
    `, [columnName]);

    if (result[0].count > 0) {
      await connection.execute(`ALTER TABLE g_ingame_popup_notices DROP COLUMN ${columnName}`);
      console.log(`✅ Dropped column: ${columnName}`);
    }
  }

  console.log('✅ Revert completed successfully');
};

