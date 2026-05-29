/**
 * Migration: Add rewardTemplateId column to g_surveys table
 */
exports.up = async function (connection) {
  console.log('[035] Adding rewardTemplateId column to g_surveys...');

  await connection.execute(`
    ALTER TABLE g_surveys
    ADD COLUMN rewardTemplateId VARCHAR(50) NULL DEFAULT NULL
    COMMENT 'Optional reward template ID. If set, participationRewards is ignored and the template rewards are used instead.'
    AFTER participationRewards
  `);

  console.log('[035] ??rewardTemplateId column added');
};

exports.down = async function (connection) {
  await connection.execute(`
    ALTER TABLE g_surveys
    DROP COLUMN rewardTemplateId
  `);
};
