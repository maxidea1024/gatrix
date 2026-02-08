/**
 * Migration: Update worldServerAddress comment to reflect URL or host:port format
 *
 * This migration only updates the column comment to avoid referring strictly to ip:port.
 */

async function up(connection) {
  console.log(
    'Updating worldServerAddress comment in g_game_worlds to allow URL or host:port format...'
  );

  await connection.execute(`
    ALTER TABLE g_game_worlds
    MODIFY COLUMN worldServerAddress VARCHAR(255) NOT NULL COMMENT 'World server address for client connection (URL or host:port format)'
  `);

  console.log('\u2713 Updated worldServerAddress comment in g_game_worlds');
}

async function down(connection) {
  console.log('Reverting worldServerAddress comment in g_game_worlds to previous description...');

  await connection.execute(`
    ALTER TABLE g_game_worlds
    MODIFY COLUMN worldServerAddress VARCHAR(255) NOT NULL COMMENT 'World server address for client connection (ip:port format)'
  `);

  console.log('\u2713 Reverted worldServerAddress comment in g_game_worlds');
}

module.exports = { up, down };
