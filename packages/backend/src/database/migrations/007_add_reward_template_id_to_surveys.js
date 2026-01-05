
exports.up = async function (connection) {
    console.log('Adding rewardTemplateId to g_surveys...');
    await connection.execute(`
    ALTER TABLE g_surveys 
    ADD COLUMN rewardTemplateId VARCHAR(26) NULL AFTER participationRewards,
    ADD INDEX idx_survey_reward_template (rewardTemplateId)
  `);
    console.log('✓ rewardTemplateId added to g_surveys');
};

exports.down = async function (connection) {
    console.log('Removing rewardTemplateId from g_surveys...');
    await connection.execute(`
    ALTER TABLE g_surveys 
    DROP INDEX idx_survey_reward_template,
    DROP COLUMN rewardTemplateId
  `);
    console.log('✓ rewardTemplateId removed from g_surveys');
};
