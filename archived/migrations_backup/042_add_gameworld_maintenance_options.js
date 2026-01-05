/*
  Migration: Add forceDisconnect and gracePeriodMinutes to g_game_worlds

  This adds the same maintenance options available in service maintenance to game world maintenance:
  - forceDisconnect: Whether to force disconnect existing players when maintenance starts
  - gracePeriodMinutes: Grace period in minutes before disconnecting players
*/

module.exports = {
  up: async (connection) => {
    console.log('Adding forceDisconnect and gracePeriodMinutes to g_game_worlds...');

    // Check if columns already exist
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'g_game_worlds'
      AND COLUMN_NAME IN ('forceDisconnect', 'gracePeriodMinutes')
    `);

    const existingColumns = columns.map(row => row.COLUMN_NAME);

    // Add forceDisconnect column if not exists
    if (!existingColumns.includes('forceDisconnect')) {
      await connection.execute(`
        ALTER TABLE g_game_worlds
        ADD COLUMN forceDisconnect BOOLEAN NOT NULL DEFAULT FALSE
        COMMENT 'Force disconnect existing players when maintenance starts'
        AFTER maintenanceMessage
      `);
      console.log('✓ Added forceDisconnect column');
    } else {
      console.log('→ forceDisconnect column already exists');
    }

    // Add gracePeriodMinutes column if not exists
    if (!existingColumns.includes('gracePeriodMinutes')) {
      await connection.execute(`
        ALTER TABLE g_game_worlds
        ADD COLUMN gracePeriodMinutes INT NOT NULL DEFAULT 5
        COMMENT 'Grace period in minutes before disconnecting players'
        AFTER forceDisconnect
      `);
      console.log('✓ Added gracePeriodMinutes column');
    } else {
      console.log('→ gracePeriodMinutes column already exists');
    }

    console.log('✓ Migration completed: Add forceDisconnect and gracePeriodMinutes to g_game_worlds');
  },

  down: async (connection) => {
    console.log('Removing forceDisconnect and gracePeriodMinutes from g_game_worlds...');

    await connection.execute(`
      ALTER TABLE g_game_worlds
      DROP COLUMN IF EXISTS gracePeriodMinutes,
      DROP COLUMN IF EXISTS forceDisconnect
    `);

    console.log('✓ Migration rolled back: Removed forceDisconnect and gracePeriodMinutes from g_game_worlds');
  }
};

