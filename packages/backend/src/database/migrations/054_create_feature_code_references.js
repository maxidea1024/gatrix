/**
 * Migration: Create g_feature_code_references table
 * Stores code reference data from gatrix-flag-code-refs scanner tool
 */
exports.up = async function (connection) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_feature_code_references (
      id VARCHAR(26) NOT NULL PRIMARY KEY,
      flagName VARCHAR(255) NOT NULL,
      filePath VARCHAR(1024) NOT NULL,
      lineNumber INT NOT NULL,
      columnNumber INT DEFAULT NULL,
      codeSnippet TEXT DEFAULT NULL,
      functionName VARCHAR(255) DEFAULT NULL,
      receiver VARCHAR(255) DEFAULT NULL,
      language VARCHAR(50) DEFAULT NULL,
      confidence INT DEFAULT 0,
      detectionStrategy VARCHAR(100) DEFAULT NULL,
      codeUrl VARCHAR(2048) DEFAULT NULL,
      repository VARCHAR(512) DEFAULT NULL,
      branch VARCHAR(255) DEFAULT NULL,
      commitHash VARCHAR(64) DEFAULT NULL,
      scanId VARCHAR(64) DEFAULT NULL,
      scanTime DATETIME DEFAULT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_flagName (flagName),
      INDEX idx_repository (repository),
      INDEX idx_scanId (scanId),
      INDEX idx_scanTime (scanTime)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

exports.down = async function (connection) {
  await connection.execute(`DROP TABLE IF EXISTS g_feature_code_references`);
};
