/**
 * 030 - AI Chats
 * Create g_ai_chats table to store AI chat conversations per user
 */

exports.up = async function (connection) {
  console.log('[030] Creating g_ai_chats table...');

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_ai_chats (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      userId VARCHAR(26) NOT NULL,
      orgId VARCHAR(26) NOT NULL,
      title VARCHAR(255) NULL,
      messages JSON NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_ai_chats_userId (userId),
      INDEX idx_ai_chats_orgId (orgId)
    )
  `);

  console.log('[030] ??g_ai_chats table created');
};

exports.down = async function (connection) {
  await connection.execute(`DROP TABLE IF EXISTS g_ai_chats`);
};
