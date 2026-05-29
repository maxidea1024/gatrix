"use strict";

exports.name = "063_quick_links";

exports.up = async function (connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS g_user_quick_links (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      userId VARCHAR(36) NOT NULL,
      title VARCHAR(100) NOT NULL,
      url VARCHAR(2048) NOT NULL,
      description VARCHAR(255) DEFAULT NULL,
      iconName VARCHAR(50) DEFAULT 'Link',
      color VARCHAR(20) DEFAULT NULL,
      sortOrder INT DEFAULT 0,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_quick_links_userId (userId),
      FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
};

exports.down = async function (connection) {
  await connection.query(`DROP TABLE IF EXISTS g_user_quick_links;`);
};
