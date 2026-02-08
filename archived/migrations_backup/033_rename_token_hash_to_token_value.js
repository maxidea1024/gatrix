/**
 * Migration 033: Rename tokenHash column to tokenValue in g_api_access_tokens table
 *
 * This migration renames the tokenHash column to tokenValue for better naming consistency.
 */

exports.up = async function (connection) {
  console.log('Renaming tokenHash column to tokenValue in g_api_access_tokens table...');

  try {
    // Check if tokenHash column exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'g_api_access_tokens'
      AND COLUMN_NAME = 'tokenHash'
    `);

    if (columns.length > 0) {
      await connection.execute(`
        ALTER TABLE g_api_access_tokens 
        RENAME COLUMN tokenHash TO tokenValue
      `);
      console.log('✅ tokenHash column renamed to tokenValue successfully');
    } else {
      console.log('✅ tokenHash column does not exist (already renamed or never existed)');
    }
  } catch (error) {
    console.log('⚠️ Error during migration:', error.message);
  }
};

exports.down = async function (connection) {
  console.log('Reverting: Renaming tokenValue column back to tokenHash...');

  try {
    // Check if tokenValue column exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'g_api_access_tokens'
      AND COLUMN_NAME = 'tokenValue'
    `);

    if (columns.length > 0) {
      await connection.execute(`
        ALTER TABLE g_api_access_tokens 
        RENAME COLUMN tokenValue TO tokenHash
      `);
      console.log('✅ tokenValue column renamed back to tokenHash successfully');
    }
  } catch (error) {
    console.log('⚠️ Error during revert:', error.message);
  }
};
