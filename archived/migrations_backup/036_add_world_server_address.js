/**
 * Migration: Add worldServerAddress to game worlds
 *
 * Adds support for specifying the world server address for each game world.
 * This allows clients to connect to the appropriate game server.
 */

async function up(connection) {
  console.log('Adding worldServerAddress to g_game_worlds...');

  // Check if column already exists
  const [columns] = await connection.execute(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'g_game_worlds'
    AND COLUMN_NAME = 'worldServerAddress'
  `);

  if (columns.length === 0) {
    // Add worldServerAddress column
    await connection.execute(`
      ALTER TABLE g_game_worlds
      ADD COLUMN worldServerAddress VARCHAR(255) NULL COMMENT 'World server address for client connection'
      AFTER customPayload
    `);
    console.log('✓ Added worldServerAddress column to g_game_worlds');
  } else {
    console.log('✓ worldServerAddress column already exists in g_game_worlds');
  }
}

async function down(connection) {
  console.log('Removing worldServerAddress from g_game_worlds...');

  await connection.execute(`
    ALTER TABLE g_game_worlds
    DROP COLUMN worldServerAddress
  `);

  console.log('✓ Removed worldServerAddress column from g_game_worlds');
}

module.exports = { up, down };
