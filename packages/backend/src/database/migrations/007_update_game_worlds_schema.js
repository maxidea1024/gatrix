const name = 'Update game worlds schema - remove connectionUrl and rename shareId to worldId';

async function up(connection) {
  // First, rename shareId column to worldId
  await connection.execute(`
    ALTER TABLE g_game_worlds 
    CHANGE COLUMN shareId worldId VARCHAR(100) NOT NULL COMMENT '월드 ID'
  `);

  // Drop the connectionUrl column
  await connection.execute(`
    ALTER TABLE g_game_worlds 
    DROP COLUMN connectionUrl
  `);

  // Update the index name
  await connection.execute(`
    ALTER TABLE g_game_worlds 
    DROP INDEX idx_share_id
  `);

  await connection.execute(`
    ALTER TABLE g_game_worlds 
    ADD INDEX idx_world_id (worldId)
  `);
}

async function down(connection) {
  // Add back the connectionUrl column
  await connection.execute(`
    ALTER TABLE g_game_worlds 
    ADD COLUMN connectionUrl VARCHAR(500) NOT NULL COMMENT '접속 주소' AFTER worldId
  `);

  // Rename worldId back to shareId
  await connection.execute(`
    ALTER TABLE g_game_worlds 
    CHANGE COLUMN worldId shareId VARCHAR(100) NOT NULL COMMENT '공유 ID'
  `);

  // Update the index name back
  await connection.execute(`
    ALTER TABLE g_game_worlds 
    DROP INDEX idx_world_id
  `);

  await connection.execute(`
    ALTER TABLE g_game_worlds 
    ADD INDEX idx_share_id (shareId)
  `);
}

module.exports = { name, up, down };
