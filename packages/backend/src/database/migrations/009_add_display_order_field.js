const name = 'Add displayOrder field to game worlds table';

async function up(connection) {
  // Add displayOrder column
  await connection.execute(`
    ALTER TABLE g_game_worlds 
    ADD COLUMN displayOrder INT NOT NULL DEFAULT 0 COMMENT '표시 순서' AFTER isMaintenance
  `);

  // Add index for display order
  await connection.execute(`
    ALTER TABLE g_game_worlds 
    ADD INDEX idx_display_order (displayOrder)
  `);

  // Update existing records with incremental order
  await connection.execute(`
    UPDATE g_game_worlds 
    SET displayOrder = id * 10
    ORDER BY id
  `);
}

async function down(connection) {
  // Drop the index first
  await connection.execute(`
    ALTER TABLE g_game_worlds 
    DROP INDEX idx_display_order
  `);

  // Drop the displayOrder column
  await connection.execute(`
    ALTER TABLE g_game_worlds 
    DROP COLUMN displayOrder
  `);
}

module.exports = { name, up, down };
