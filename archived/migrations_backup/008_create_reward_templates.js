/**
 * Create Reward Item Templates table
 * Stores reusable reward item templates with tags
 */

exports.up = async function (connection) {
  console.log('Creating reward item templates table...');

  // Create reward item templates table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_reward_item_templates (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      name VARCHAR(255) NOT NULL COMMENT 'Template name',
      description TEXT NULL COMMENT 'Template description',
      
      -- Participation rewards (JSON array)
      -- Example: [{"rewardType": "1", "itemId": "100", "quantity": 1000}]
      rewardItems JSON NOT NULL COMMENT 'Reward items configuration',
      
      -- Tags (JSON array)
      -- Example: ["event", "promotion", "seasonal"]
      tags JSON NULL COMMENT 'Template tags for categorization',
      
      -- Audit fields
      createdBy INT NULL COMMENT 'User ID who created this template',
      updatedBy INT NULL COMMENT 'User ID who last updated this template',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_name (name),
      INDEX idx_created_at (createdAt),
      INDEX idx_updated_at (updatedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('✅ Reward item templates table created successfully');
};

exports.down = async function (connection) {
  console.log('Dropping reward item templates table...');

  await connection.execute(`
    DROP TABLE IF EXISTS g_reward_item_templates
  `);

  console.log('✅ Reward item templates table dropped successfully');
};
