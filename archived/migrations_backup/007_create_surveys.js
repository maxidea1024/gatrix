/**
 * Migration: Create surveys table
 *
 * Surveys table: Stores survey information
 * Survey config: Uses g_vars table for global configuration
 */

exports.up = async function(connection) {
  console.log('Creating surveys table...');

  // 1. Surveys table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_surveys (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      platformSurveyId VARCHAR(191) NOT NULL UNIQUE COMMENT 'SDO platform survey ID',
      surveyTitle VARCHAR(500) NOT NULL COMMENT 'Survey title',
      surveyContent TEXT NULL COMMENT 'Survey description/content',
      
      -- Trigger conditions (JSON array)
      -- Example: [{"type": "userLevel", "value": 10}, {"type": "joinDays", "value": 7}]
      triggerConditions JSON NOT NULL COMMENT 'Survey trigger conditions',
      
      -- Participation rewards (JSON array)
      -- Example: [{"rewardType": "GOLD", "itemId": "gold_001", "quantity": 1000}]
      participationRewards JSON NULL COMMENT 'Rewards for survey participation',
      
      -- Reward mail settings
      rewardMailTitle VARCHAR(500) NULL COMMENT 'Reward mail title',
      rewardMailContent TEXT NULL COMMENT 'Reward mail content',
      
      -- Status
      isActive BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Survey active status',
      
      -- Audit fields
      createdBy INT NULL COMMENT 'User ID who created this survey',
      updatedBy INT NULL COMMENT 'User ID who last updated this survey',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_platform_survey_id (platformSurveyId),
      INDEX idx_is_active (isActive),
      INDEX idx_created_at (createdAt),
      INDEX idx_updated_at (updatedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Insert default survey config into g_vars
  await connection.execute(`
    INSERT IGNORE INTO g_vars
    (varKey, varValue, description, createdBy)
    VALUES
    ('survey.baseSurveyUrl', 'https://survey.dw.sdo.com', 'Base URL for surveys', 1),
    ('survey.baseJoinedUrl', 'https://survey.dw.sdo.com/survey/joined', 'Base URL for joined survey callback', 1),
    ('survey.linkCaption', '参与调查', 'Survey link caption text', 1),
    ('survey.joinedSecretKey', '123', 'Secret key for survey joined verification', 1)
  `);

  console.log('Surveys table created successfully!');
};

exports.down = async function(connection) {
  console.log('Dropping surveys table...');

  await connection.execute('DROP TABLE IF EXISTS g_surveys');

  // Remove survey config from g_vars
  await connection.execute(`
    DELETE FROM g_vars WHERE varKey IN (
      'survey.baseSurveyUrl',
      'survey.baseJoinedUrl',
      'survey.linkCaption',
      'survey.joinedSecretKey'
    )
  `);

  console.log('Surveys table dropped successfully!');
};

