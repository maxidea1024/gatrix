/*
  Migration: Add infraSettingsRaw TEXT column for JSON5 source editing

  - infraSettings (JSON): Parsed JSON object for API responses (no parsing overhead)
  - infraSettingsRaw (TEXT): Original JSON5 string for editing (preserves comments, trailing commas)
*/

module.exports = {
  up: async (connection) => {
    console.log('Adding infraSettingsRaw column to g_game_worlds...');

    // Check if column already exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'g_game_worlds'
      AND COLUMN_NAME = 'infraSettingsRaw'
    `);

    if (columns.length === 0) {
      await connection.execute(`
        ALTER TABLE g_game_worlds
        ADD COLUMN infraSettingsRaw TEXT NULL COMMENT 'Original JSON5 source for editing (preserves comments, trailing commas)'
        AFTER infraSettings
      `);
      console.log('✓ Added infraSettingsRaw column to g_game_worlds');
    } else {
      console.log('✓ infraSettingsRaw column already exists in g_game_worlds');
    }
  },

  down: async (connection) => {
    console.log('Removing infraSettingsRaw column from g_game_worlds...');

    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'g_game_worlds'
      AND COLUMN_NAME = 'infraSettingsRaw'
    `);

    if (columns.length > 0) {
      await connection.execute(`
        ALTER TABLE g_game_worlds
        DROP COLUMN infraSettingsRaw
      `);
      console.log('✓ Removed infraSettingsRaw column from g_game_worlds');
    } else {
      console.log('✓ infraSettingsRaw column does not exist');
    }
  },
};
