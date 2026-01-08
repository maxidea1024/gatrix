
exports.up = async function (connection) {
    console.log('Adding target fields to g_surveys table...');

    // Use a single ALTER TABLE statement to add all columns
    // Note: We are relying on the migration system's transaction to roll back if this fails
    await connection.execute(`
    ALTER TABLE g_surveys
    ADD COLUMN targetPlatforms JSON NULL COMMENT 'Target platforms',
    ADD COLUMN targetPlatformsInverted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN targetChannels JSON NULL COMMENT 'Target channels',
    ADD COLUMN targetChannelsInverted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN targetSubchannels JSON NULL COMMENT 'Target subchannels',
    ADD COLUMN targetSubchannelsInverted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN targetWorlds JSON NULL COMMENT 'Target game worlds',
    ADD COLUMN targetWorldsInverted BOOLEAN NOT NULL DEFAULT FALSE
  `);

    console.log('✓ Added target fields to g_surveys table');
};

exports.down = async function (connection) {
    console.log('Removing target fields from g_surveys table...');

    try {
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
        console.log('✓ Removed target fields from g_surveys table');
    } catch (error) {
        console.warn('Error rolling back 009_add_target_fields_to_surveys (ignoring):', error.message);
    }
};
