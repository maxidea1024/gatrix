/**
 * Fix reward templates schema
 * Add name and description columns, and add rewardItems column
 */

exports.up = async function (connection) {
  console.log('Fixing reward templates schema...');

  // Check if name column exists
  const [columns] = await connection.execute(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'g_reward_templates'
    AND COLUMN_NAME = 'name'
  `);

  if (columns.length === 0) {
    // Add name and description columns
    await connection.execute(`
      ALTER TABLE g_reward_templates
      ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT '' AFTER id,
      ADD COLUMN description TEXT NULL AFTER name,
      ADD COLUMN rewardItems JSON NOT NULL AFTER description,
      ADD COLUMN tags JSON NULL AFTER rewardItems,
      ADD COLUMN createdBy INT NULL AFTER tags,
      ADD COLUMN updatedBy INT NULL AFTER createdBy,
      ADD INDEX idx_name (name),
      ADD INDEX idx_created_at (createdAt),
      ADD INDEX idx_updated_at (updatedAt)
    `);

    console.log('✅ Reward templates schema fixed successfully');
  } else {
    console.log('✅ Reward templates schema already has name column');
  }
};

exports.down = async function (connection) {
  console.log('Reverting reward templates schema...');

  // Check if name column exists
  const [columns] = await connection.execute(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'g_reward_templates'
    AND COLUMN_NAME = 'name'
  `);

  if (columns.length > 0) {
    // Drop added columns
    await connection.execute(`
      ALTER TABLE g_reward_templates
      DROP COLUMN IF EXISTS name,
      DROP COLUMN IF EXISTS description,
      DROP COLUMN IF EXISTS rewardItems,
      DROP COLUMN IF EXISTS tags,
      DROP COLUMN IF EXISTS createdBy,
      DROP COLUMN IF EXISTS updatedBy,
      DROP INDEX IF EXISTS idx_name,
      DROP INDEX IF EXISTS idx_created_at,
      DROP INDEX IF EXISTS idx_updated_at
    `);

    console.log('✅ Reward templates schema reverted successfully');
  }
};
