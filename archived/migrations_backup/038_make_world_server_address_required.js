/**
 * Migration: Make worldServerAddress required (NOT NULL)
 *
 * Changes worldServerAddress from nullable to NOT NULL with a default value.
 * This ensures all game worlds have a valid server address.
 */

async function up(connection) {
  console.log('Making worldServerAddress required in g_game_worlds...');

  // First, update any NULL values to a default placeholder
  const [result] = await connection.execute(`
    UPDATE g_game_worlds
    SET worldServerAddress = '0.0.0.0:0'
    WHERE worldServerAddress IS NULL
  `);

  if (result.affectedRows > 0) {
    console.log(`✓ Updated ${result.affectedRows} rows with default worldServerAddress`);
  }

  // Check if column exists and is nullable
  const [columns] = await connection.execute(`
    SELECT COLUMN_NAME, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'g_game_worlds'
    AND COLUMN_NAME = 'worldServerAddress'
  `);

  if (columns.length > 0 && columns[0].IS_NULLABLE === 'YES') {
    // Modify column to NOT NULL
    await connection.execute(`
      ALTER TABLE g_game_worlds
      MODIFY COLUMN worldServerAddress VARCHAR(255) NOT NULL COMMENT 'World server address for client connection (ip:port format)'
    `);
    console.log('✓ Changed worldServerAddress to NOT NULL in g_game_worlds');
  } else if (columns.length > 0) {
    console.log('✓ worldServerAddress is already NOT NULL in g_game_worlds');
  } else {
    console.log('⚠ worldServerAddress column does not exist in g_game_worlds');
  }
}

async function down(connection) {
  console.log('Making worldServerAddress nullable in g_game_worlds...');

  await connection.execute(`
    ALTER TABLE g_game_worlds
    MODIFY COLUMN worldServerAddress VARCHAR(255) NULL COMMENT 'World server address for client connection'
  `);

  console.log('✓ Changed worldServerAddress to NULL in g_game_worlds');
}

module.exports = { up, down };
