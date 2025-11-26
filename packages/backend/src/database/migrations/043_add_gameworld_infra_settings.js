/*
  Migration: Add infraSettings JSON column to g_game_worlds

  This adds a JSON column for infrastructure settings that can be passed to game servers via SDK.
  Used for server-specific configurations like connection settings, resource limits, etc.
*/

module.exports = {
  up: async (connection) => {
    console.log('Adding infraSettings column to g_game_worlds...');

    // Check if column already exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'g_game_worlds'
      AND COLUMN_NAME = 'infraSettings'
    `);

    if (columns.length === 0) {
      // Add infraSettings column after customPayload
      await connection.execute(`
        ALTER TABLE g_game_worlds
        ADD COLUMN infraSettings JSON NULL COMMENT 'Infrastructure settings for game server configuration (passed to SDK)'
        AFTER customPayload
      `);
      console.log('✓ Added infraSettings column to g_game_worlds');
    } else {
      console.log('✓ infraSettings column already exists in g_game_worlds');
    }
  },

  down: async (connection) => {
    console.log('Removing infraSettings column from g_game_worlds...');

    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'g_game_worlds'
      AND COLUMN_NAME = 'infraSettings'
    `);

    if (columns.length > 0) {
      await connection.execute(`
        ALTER TABLE g_game_worlds
        DROP COLUMN infraSettings
      `);
      console.log('✓ Removed infraSettings column from g_game_worlds');
    } else {
      console.log('✓ infraSettings column does not exist in g_game_worlds');
    }
  }
};

