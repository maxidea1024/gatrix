/**
 * 058 - Survey Templates & Responses
 * 
 * 1. g_survey_templates: Stores self-authored survey form definitions (questions JSON).
 * 2. g_survey_responses: Stores individual user responses for CUSTOM surveys.
 * 3. ALTER g_surveys: Add surveyType (SDO|CUSTOM) and templateId FK columns.
 */

exports.up = async function (connection) {
  console.log('[058] Creating survey templates table...');

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_survey_templates (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      title VARCHAR(500) NOT NULL,
      description TEXT NULL,
      questions JSON NOT NULL COMMENT 'Array of question block objects',
      settings JSON NULL COMMENT 'Form settings (shuffle, progressBar, theme)',
      locales JSON NULL COMMENT 'Per-locale UI strings (submitButton, nextButton, thankYou)',
      version INT NOT NULL DEFAULT 1,
      isPublished TINYINT(1) NOT NULL DEFAULT 0,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_env (environmentId),
      INDEX idx_published (environmentId, isPublished)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[058] Creating survey responses table...');

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_survey_responses (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      surveyId CHAR(26) NOT NULL COMMENT 'FK to g_surveys.id',
      templateId CHAR(26) NOT NULL COMMENT 'FK to g_survey_templates.id',
      templateVersion INT NOT NULL DEFAULT 1,
      accountId VARCHAR(100) NOT NULL,
      characterId VARCHAR(100) NULL,
      worldId VARCHAR(50) NULL,
      locale VARCHAR(10) NULL COMMENT 'Language used when responding',
      answers JSON NOT NULL COMMENT 'Map of questionId -> answer value',
      completedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_env_survey (environmentId, surveyId),
      INDEX idx_account (accountId),
      UNIQUE KEY uq_survey_account (surveyId, accountId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[058] Adding surveyType and templateId columns to g_surveys...');

  // Check if columns already exist before adding
  const [cols] = await connection.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_surveys' AND COLUMN_NAME = 'surveyType'`
  );

  if (cols.length === 0) {
    await connection.execute(`
      ALTER TABLE g_surveys
        ADD COLUMN surveyType VARCHAR(10) NOT NULL DEFAULT 'SDO' COMMENT 'SDO or CUSTOM' AFTER platformSurveyId,
        ADD COLUMN templateId CHAR(26) NULL COMMENT 'FK to g_survey_templates.id (only for CUSTOM)' AFTER surveyType
    `);
  }

  console.log('[058] Migration complete.');
};

exports.down = async function (connection) {
  console.log('[058] Rolling back survey templates migration...');

  // Remove columns from g_surveys
  const [cols] = await connection.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_surveys' AND COLUMN_NAME = 'surveyType'`
  );
  if (cols.length > 0) {
    await connection.execute(`ALTER TABLE g_surveys DROP COLUMN surveyType, DROP COLUMN templateId`);
  }

  await connection.execute(`DROP TABLE IF EXISTS g_survey_responses`);
  await connection.execute(`DROP TABLE IF EXISTS g_survey_templates`);

  console.log('[058] Rollback complete.');
};
