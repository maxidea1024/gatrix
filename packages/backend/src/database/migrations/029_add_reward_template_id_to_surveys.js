/**
 * Migration 029: Add missing targeting and reward fields to surveys table
 *
 * This migration adds all missing columns to the g_surveys table:
 * - rewardTemplateId: Link to reward templates
 * - targetPlatforms, targetPlatformsInverted: Platform targeting
 * - targetChannels, targetChannelsInverted: Channel targeting
 * - targetSubchannels, targetSubchannelsInverted: Subchannel targeting
 * - targetWorlds, targetWorldsInverted: World targeting
 */

exports.up = async function(connection) {
  console.log('Adding missing columns to g_surveys table...');

  // List of columns to add with their definitions
  const columnsToAdd = [
    { name: 'rewardTemplateId', definition: 'VARCHAR(26) NULL COMMENT "Reward template ID"' },
    { name: 'targetPlatforms', definition: 'JSON NULL COMMENT "Target platforms"' },
    { name: 'targetPlatformsInverted', definition: 'BOOLEAN DEFAULT FALSE COMMENT "Invert target platforms"' },
    { name: 'targetChannels', definition: 'JSON NULL COMMENT "Target channels"' },
    { name: 'targetChannelsInverted', definition: 'BOOLEAN DEFAULT FALSE COMMENT "Invert target channels"' },
    { name: 'targetSubchannels', definition: 'JSON NULL COMMENT "Target subchannels"' },
    { name: 'targetSubchannelsInverted', definition: 'BOOLEAN DEFAULT FALSE COMMENT "Invert target subchannels"' },
    { name: 'targetWorlds', definition: 'JSON NULL COMMENT "Target worlds"' },
    { name: 'targetWorldsInverted', definition: 'BOOLEAN DEFAULT FALSE COMMENT "Invert target worlds"' },
  ];

  // Check which columns already exist
  const [existingColumns] = await connection.execute(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'g_surveys'
  `);

  const existingColumnNames = existingColumns.map(col => col.COLUMN_NAME);
  const columnsToAddFiltered = columnsToAdd.filter(col => !existingColumnNames.includes(col.name));

  if (columnsToAddFiltered.length === 0) {
    console.log('✅ All required columns already exist in g_surveys table');
    return;
  }

  // Build ALTER TABLE statement
  const alterStatements = columnsToAddFiltered.map(col => `ADD COLUMN ${col.name} ${col.definition}`).join(', ');

  await connection.execute(`
    ALTER TABLE g_surveys
    ${alterStatements}
  `);

  console.log(`✅ Added ${columnsToAddFiltered.length} missing columns to g_surveys table successfully`);
};

exports.down = async function(connection) {
  console.log('Removing added columns from g_surveys table...');

  const columnsToRemove = [
    'rewardTemplateId',
    'targetPlatforms',
    'targetPlatformsInverted',
    'targetChannels',
    'targetChannelsInverted',
    'targetSubchannels',
    'targetSubchannelsInverted',
    'targetWorlds',
    'targetWorldsInverted',
  ];

  // Check which columns exist
  const [existingColumns] = await connection.execute(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'g_surveys'
  `);

  const existingColumnNames = existingColumns.map(col => col.COLUMN_NAME);
  const columnsToRemoveFiltered = columnsToRemove.filter(col => existingColumnNames.includes(col));

  if (columnsToRemoveFiltered.length === 0) {
    console.log('✅ No columns to remove from g_surveys table');
    return;
  }

  // Build ALTER TABLE statement
  const dropStatements = columnsToRemoveFiltered.map(col => `DROP COLUMN ${col}`).join(', ');

  await connection.execute(`
    ALTER TABLE g_surveys
    ${dropStatements}
  `);

  console.log(`✅ Removed ${columnsToRemoveFiltered.length} columns from g_surveys table successfully`);
};

