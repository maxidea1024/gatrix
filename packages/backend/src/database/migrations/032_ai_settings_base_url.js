/**
 * 032 - AI Settings: Add apiBaseUrl column
 * Allows custom API endpoint for OpenAI-compatible providers (e.g., Groq)
 */

exports.up = async function (connection) {
  console.log('[032] Adding apiBaseUrl to g_ai_settings...');

  await connection.execute(`
    ALTER TABLE g_ai_settings
    ADD COLUMN apiBaseUrl VARCHAR(500) NULL AFTER apiKey
  `);

  console.log('[032] ??apiBaseUrl column added');
};

exports.down = async function (connection) {
  await connection.execute(`
    ALTER TABLE g_ai_settings
    DROP COLUMN apiBaseUrl
  `);
};
