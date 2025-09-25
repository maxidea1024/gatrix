/*
  Migration: Add customPayload JSON column to g_game_worlds
*/

module.exports = {
  up: async (connection) => {
    // Add customPayload JSON column (nullable). We keep DB default as NULL and enforce default {} in application layer.
    await connection.execute(`
      ALTER TABLE g_game_worlds
      ADD COLUMN customPayload JSON NULL AFTER supportsMultiLanguage
    `);
  },

  down: async (connection) => {
    await connection.execute(`
      ALTER TABLE g_game_worlds
      DROP COLUMN customPayload
    `);
  }
};

