const name = 'Add isMaintenance field to game worlds table';

async function up(connection) {
  // Add isMaintenance column
  await connection.execute(`
    ALTER TABLE g_game_worlds 
    ADD COLUMN isMaintenance BOOLEAN NOT NULL DEFAULT FALSE COMMENT '점검 상태' AFTER isVisible
  `);

  // Add index for maintenance status
  await connection.execute(`
    ALTER TABLE g_game_worlds 
    ADD INDEX idx_is_maintenance (isMaintenance)
  `);
}

async function down(connection) {
  // Drop the index first
  await connection.execute(`
    ALTER TABLE g_game_worlds 
    DROP INDEX idx_is_maintenance
  `);

  // Drop the isMaintenance column
  await connection.execute(`
    ALTER TABLE g_game_worlds 
    DROP COLUMN isMaintenance
  `);
}

module.exports = { name, up, down };
