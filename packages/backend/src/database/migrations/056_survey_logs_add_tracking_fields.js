/**
 * 056 - Add tracking fields to survey logs
 * Adds userName, worldId, platform, channel, and subchannel for advanced filtering.
 */

exports.up = async function (connection) {
  console.log('[056] Adding tracking columns and indexes to g_survey_logs...');

  await connection.execute(`
    ALTER TABLE g_survey_logs
      ADD COLUMN userName VARCHAR(200) NULL AFTER characterId,
      ADD COLUMN worldId VARCHAR(100) NULL AFTER userName,
      ADD COLUMN platform VARCHAR(50) NULL AFTER worldId,
      ADD COLUMN channel VARCHAR(50) NULL AFTER platform,
      ADD COLUMN subchannel VARCHAR(100) NULL AFTER channel;
  `);

  await connection.execute(`
    ALTER TABLE g_survey_logs
      ADD INDEX idx_env_survey_created (environmentId, surveyId, createdAt),
      ADD INDEX idx_env_action_created (environmentId, action, createdAt),
      ADD INDEX idx_env_account (environmentId, accountId),
      ADD INDEX idx_env_world (environmentId, worldId),
      ADD INDEX idx_env_platform (environmentId, platform),
      ADD INDEX idx_env_channel (environmentId, channel),
      ADD INDEX idx_env_subchannel (environmentId, subchannel)
  `);
};

exports.down = async function (connection) {
  console.log('[056] Removing tracking columns and indexes from g_survey_logs...');
  
  await connection.execute(`
    ALTER TABLE g_survey_logs
      DROP INDEX idx_env_survey_created,
      DROP INDEX idx_env_action_created,
      DROP INDEX idx_env_account,
      DROP INDEX idx_env_world,
      DROP INDEX idx_env_platform,
      DROP INDEX idx_env_channel,
      DROP INDEX idx_env_subchannel;
  `);

  await connection.execute(`
    ALTER TABLE g_survey_logs
      DROP COLUMN userName,
      DROP COLUMN worldId,
      DROP COLUMN platform,
      DROP COLUMN channel,
      DROP COLUMN subchannel;
  `);
};
