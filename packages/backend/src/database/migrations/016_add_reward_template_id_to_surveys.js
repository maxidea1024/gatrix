// Migration: Add rewardTemplateId to g_surveys table
// Purpose: Support reward template references in surveys
// This allows surveys to reference a reward template instead of storing rewards directly

module.exports = {
  up: async (connection) => {
    try {
      // Add rewardTemplateId column to g_surveys table
      await connection.execute(`
        ALTER TABLE g_surveys
        ADD COLUMN rewardTemplateId VARCHAR(26) NULL COMMENT 'Reference to reward template (g_reward_templates.id)'
        AFTER participationRewards
      `);

      // Add index for rewardTemplateId
      await connection.execute(`
        ALTER TABLE g_surveys
        ADD INDEX idx_reward_template_id (rewardTemplateId)
      `);

      // Add foreign key constraint
      await connection.execute(`
        ALTER TABLE g_surveys
        ADD CONSTRAINT fk_surveys_reward_template_id
        FOREIGN KEY (rewardTemplateId) REFERENCES g_reward_templates(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
      `);

      console.log('✓ Added rewardTemplateId column to g_surveys table');
      return true;
    } catch (error) {
      console.error('✗ Failed to add rewardTemplateId to g_surveys:', error.message);
      throw error;
    }
  },

  down: async (connection) => {
    try {
      // Drop foreign key constraint
      await connection.execute(`
        ALTER TABLE g_surveys
        DROP FOREIGN KEY fk_surveys_reward_template_id
      `);

      // Drop index
      await connection.execute(`
        ALTER TABLE g_surveys
        DROP INDEX idx_reward_template_id
      `);

      // Drop column
      await connection.execute(`
        ALTER TABLE g_surveys
        DROP COLUMN rewardTemplateId
      `);

      console.log('✓ Removed rewardTemplateId column from g_surveys table');
      return true;
    } catch (error) {
      console.error('✗ Failed to remove rewardTemplateId from g_surveys:', error.message);
      throw error;
    }
  }
};

