/**
 * 031 - AI Settings
 * Create g_ai_settings table to store per-org AI configuration
 */

exports.up = async function (connection) {
  console.log('[031] Creating g_ai_settings table...');

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_ai_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      orgId VARCHAR(26) NOT NULL UNIQUE,
      enabled TINYINT(1) NOT NULL DEFAULT 0,
      provider VARCHAR(50) NOT NULL DEFAULT 'openai',
      model VARCHAR(100) NOT NULL DEFAULT 'gpt-4o-mini',
      apiKey VARCHAR(500) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  console.log('[031] ??g_ai_settings table created');
};

exports.down = async function (connection) {
  await connection.execute(`DROP TABLE IF EXISTS g_ai_settings`);
};
