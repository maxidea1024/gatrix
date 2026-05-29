/**
 * 055 - Survey Logs
 * Stores survey participation and survey mail sent records.
 */

exports.up = async function (connection) {
  console.log('[055] Creating survey logs table...');

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_survey_logs (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      surveyId CHAR(26) NOT NULL,
      action ENUM('JOINED', 'SENT') NOT NULL,
      accountId VARCHAR(100) NOT NULL,
      characterId VARCHAR(100) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_env_survey (environmentId, surveyId),
      INDEX idx_created_at (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

exports.down = async function (connection) {
  console.log('[055] Dropping survey logs table...');
  await connection.execute(`DROP TABLE IF EXISTS g_survey_logs`);
};
