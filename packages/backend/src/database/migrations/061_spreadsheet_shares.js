"use strict";

exports.name = "061_spreadsheet_shares";

exports.up = async function (connection) {
  // Drop and recreate in case it was created with wrong column sizes
  await connection.query(`DROP TABLE IF EXISTS g_spreadsheet_shares;`);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS g_spreadsheet_shares (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      spreadsheetId VARCHAR(36) NOT NULL,
      shareType ENUM('user', 'org', 'public') NOT NULL,
      targetId VARCHAR(255) DEFAULT NULL,
      permission ENUM('viewer', 'editor') NOT NULL DEFAULT 'viewer',
      shareToken VARCHAR(64) DEFAULT NULL,
      createdBy VARCHAR(36) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_share (spreadsheetId, shareType, targetId),
      UNIQUE KEY uq_token (shareToken),
      INDEX idx_target_user (shareType, targetId),
      INDEX idx_spreadsheet (spreadsheetId),
      FOREIGN KEY (spreadsheetId) REFERENCES g_spreadsheets(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
};

exports.down = async function (connection) {
  await connection.query("DROP TABLE IF EXISTS g_spreadsheet_shares;");
};
