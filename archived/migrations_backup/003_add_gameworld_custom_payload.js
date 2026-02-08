/*
  Migration: Add customPayload JSON column to g_game_worlds
  Purpose: Add support for custom payload configuration in game worlds
  This migration adds the customPayload column if it doesn't already exist.
*/

module.exports = {
  up: async (connection) => {
    try {
      // Check if customPayload column already exists
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'g_game_worlds'
        AND COLUMN_NAME = 'customPayload'
      `);

      if (columns.length === 0) {
        // Column doesn't exist, add it
        console.log('Adding customPayload column to g_game_worlds table...');
        await connection.execute(`
          ALTER TABLE g_game_worlds
          ADD COLUMN customPayload JSON NULL COMMENT 'Custom payload for game world configuration'
        `);
        console.log('✓ Successfully added customPayload column to g_game_worlds');
      } else {
        console.log('✓ customPayload column already exists in g_game_worlds');
      }
    } catch (error) {
      console.error('Error in migration 003_add_gameworld_custom_payload:', error);
      throw error;
    }
  },

  down: async (connection) => {
    try {
      // Check if customPayload column exists
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'g_game_worlds'
        AND COLUMN_NAME = 'customPayload'
      `);

      if (columns.length > 0) {
        // Column exists, remove it
        console.log('Removing customPayload column from g_game_worlds table...');
        await connection.execute(`
          ALTER TABLE g_game_worlds DROP COLUMN customPayload
        `);
        console.log('✓ Successfully removed customPayload column from g_game_worlds');
      } else {
        console.log('✓ customPayload column does not exist in g_game_worlds');
      }
    } catch (error) {
      console.error('Error rolling back migration 003_add_gameworld_custom_payload:', error);
      throw error;
    }
  },
};
