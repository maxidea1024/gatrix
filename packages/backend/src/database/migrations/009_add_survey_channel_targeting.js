/**
 * Migration: Add channel and inverted targeting fields to surveys table
 * 
 * Adds:
 * - targetChannelSubchannels: JSON array of channel/subchannel selections
 * - targetChannelSubchannelsInverted: Boolean for inverted mode
 * - targetPlatformsInverted: Boolean for inverted mode
 * - targetWorldsInverted: Boolean for inverted mode
 * 
 * Removes old fields (no longer used):
 * - targetMarkets
 * - targetClientVersions
 * - targetAccountIds
 */

exports.up = async function(connection) {
  console.log('Adding channel targeting and inverted fields to g_surveys table...');

  // First, add new columns
  await connection.execute(`
    ALTER TABLE g_surveys
    ADD COLUMN targetChannelSubchannels JSON NULL COMMENT 'Target channel/subchannel selections (e.g., [{"channel": "ch1", "subchannels": ["*"]}])',
    ADD COLUMN targetChannelSubchannelsInverted BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Inverted mode for channel/subchannel targeting',
    ADD COLUMN targetPlatformsInverted BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Inverted mode for platform targeting',
    ADD COLUMN targetWorldsInverted BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Inverted mode for world targeting'
  `);

  // Then, drop old columns if they exist
  const [columns] = await connection.execute(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'g_surveys'
    AND COLUMN_NAME IN ('targetMarkets', 'targetClientVersions', 'targetAccountIds')
  `);

  const existingColumns = columns.map(col => col.COLUMN_NAME);

  if (existingColumns.includes('targetMarkets')) {
    await connection.execute('ALTER TABLE g_surveys DROP COLUMN targetMarkets');
  }
  if (existingColumns.includes('targetClientVersions')) {
    await connection.execute('ALTER TABLE g_surveys DROP COLUMN targetClientVersions');
  }
  if (existingColumns.includes('targetAccountIds')) {
    await connection.execute('ALTER TABLE g_surveys DROP COLUMN targetAccountIds');
  }

  console.log('✅ Successfully added channel targeting and inverted fields to g_surveys table');
};

exports.down = async function(connection) {
  console.log('Removing channel targeting and inverted fields from g_surveys table...');

  // First, drop new columns
  const [columns] = await connection.execute(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'g_surveys'
    AND COLUMN_NAME IN ('targetChannelSubchannels', 'targetChannelSubchannelsInverted', 'targetPlatformsInverted', 'targetWorldsInverted')
  `);

  const existingColumns = columns.map(col => col.COLUMN_NAME);

  if (existingColumns.includes('targetChannelSubchannels')) {
    await connection.execute('ALTER TABLE g_surveys DROP COLUMN targetChannelSubchannels');
  }
  if (existingColumns.includes('targetChannelSubchannelsInverted')) {
    await connection.execute('ALTER TABLE g_surveys DROP COLUMN targetChannelSubchannelsInverted');
  }
  if (existingColumns.includes('targetPlatformsInverted')) {
    await connection.execute('ALTER TABLE g_surveys DROP COLUMN targetPlatformsInverted');
  }
  if (existingColumns.includes('targetWorldsInverted')) {
    await connection.execute('ALTER TABLE g_surveys DROP COLUMN targetWorldsInverted');
  }

  // Then, add back old columns
  await connection.execute(`
    ALTER TABLE g_surveys
    ADD COLUMN targetMarkets JSON NULL COMMENT 'Target markets (e.g., ["kr", "global"])',
    ADD COLUMN targetClientVersions JSON NULL COMMENT 'Target client versions',
    ADD COLUMN targetAccountIds JSON NULL COMMENT 'Target account IDs for specific users'
  `);

  console.log('✅ Successfully removed channel targeting and inverted fields from g_surveys table');
};

