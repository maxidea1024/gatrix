/*
  Migration: Add maintenanceMessageTemplateId to g_game_worlds and g_client_versions
*/

module.exports = {
  up: async (connection) => {
    console.log('Adding maintenanceMessageTemplateId to g_game_worlds...');
    
    // Check if column exists in g_game_worlds
    const gameWorldColumns = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'g_game_worlds'
      AND COLUMN_NAME = 'maintenanceMessageTemplateId'
    `);

    if (gameWorldColumns[0].length === 0) {
      await connection.execute(`
        ALTER TABLE g_game_worlds
        ADD COLUMN maintenanceMessageTemplateId BIGINT UNSIGNED NULL COMMENT 'Message template ID for maintenance' AFTER maintenanceMessage
      `);
      console.log('✓ Added maintenanceMessageTemplateId to g_game_worlds');
    } else {
      console.log('✓ maintenanceMessageTemplateId already exists in g_game_worlds');
    }

    console.log('Adding maintenanceMessageTemplateId to g_client_versions...');
    
    // Check if column exists in g_client_versions
    const clientVersionColumns = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'g_client_versions'
      AND COLUMN_NAME = 'maintenanceMessageTemplateId'
    `);

    if (clientVersionColumns[0].length === 0) {
      await connection.execute(`
        ALTER TABLE g_client_versions
        ADD COLUMN maintenanceMessageTemplateId BIGINT UNSIGNED NULL COMMENT 'Message template ID for maintenance' AFTER maintenanceMessage
      `);
      console.log('✓ Added maintenanceMessageTemplateId to g_client_versions');
    } else {
      console.log('✓ maintenanceMessageTemplateId already exists in g_client_versions');
    }
  },

  down: async (connection) => {
    console.log('Removing maintenanceMessageTemplateId from g_game_worlds...');
    await connection.execute(`
      ALTER TABLE g_game_worlds
      DROP COLUMN IF EXISTS maintenanceMessageTemplateId
    `);

    console.log('Removing maintenanceMessageTemplateId from g_client_versions...');
    await connection.execute(`
      ALTER TABLE g_client_versions
      DROP COLUMN IF EXISTS maintenanceMessageTemplateId
    `);
  }
};

