/**
 * Migration: Add 'edge' and 'all' token types to g_api_access_tokens
 *
 * This migration extends the tokenType ENUM to include:
 * - 'edge': Token for Edge server to Backend communication
 * - 'all': Token that works with both client and server SDKs
 */

exports.up = async function(connection) {
  console.log('Adding edge and all token types to g_api_access_tokens...');

  try {
    // Modify the tokenType ENUM to include 'edge' and 'all'
    await connection.execute(`
      ALTER TABLE g_api_access_tokens 
      MODIFY COLUMN tokenType ENUM('client', 'server', 'edge', 'all') NOT NULL
    `);
    console.log('✅ tokenType ENUM extended with edge and all types');
  } catch (error) {
    console.log('⚠️ Error modifying tokenType:', error.message);
    throw error;
  }
};

exports.down = async function(connection) {
  console.log('Reverting tokenType ENUM...');

  try {
    // First, update any 'edge' or 'all' tokens to 'server' (as a fallback)
    await connection.execute(`
      UPDATE g_api_access_tokens SET tokenType = 'server' WHERE tokenType IN ('edge', 'all')
    `);

    // Revert the ENUM back to original
    await connection.execute(`
      ALTER TABLE g_api_access_tokens 
      MODIFY COLUMN tokenType ENUM('client', 'server') NOT NULL
    `);
    console.log('✅ tokenType ENUM reverted');
  } catch (error) {
    console.log('⚠️ Error reverting tokenType:', error.message);
    throw error;
  }
};

