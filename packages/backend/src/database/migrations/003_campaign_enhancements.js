const mysql = require('mysql2/promise');

exports.up = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix'
  });

  console.log('Adding campaign enhancements...');

  // 1. Add priority field to campaigns
  await connection.execute(`
    ALTER TABLE g_remote_config_campaigns 
    ADD COLUMN priority INT NOT NULL DEFAULT 0 COMMENT 'Higher number = higher priority'
  `);

  // 2. Add index for priority
  await connection.execute(`
    ALTER TABLE g_remote_config_campaigns 
    ADD INDEX idx_priority (priority)
  `);

  // 3. Add status field to track campaign state
  await connection.execute(`
    ALTER TABLE g_remote_config_campaigns 
    ADD COLUMN status ENUM('draft', 'scheduled', 'running', 'completed', 'paused') NOT NULL DEFAULT 'draft'
  `);

  // 4. Add index for status
  await connection.execute(`
    ALTER TABLE g_remote_config_campaigns 
    ADD INDEX idx_status (status)
  `);

  // 5. Add updatedBy field to campaigns
  await connection.execute(`
    ALTER TABLE g_remote_config_campaigns 
    ADD COLUMN updatedBy INT NULL,
    ADD FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL
  `);

  // 6. Add priority field to campaign configs for ordering
  await connection.execute(`
    ALTER TABLE g_remote_config_campaign_configs 
    ADD COLUMN priority INT NOT NULL DEFAULT 0 COMMENT 'Order within campaign'
  `);

  // 7. Create campaign evaluation cache table for performance
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_campaign_cache (
      id INT AUTO_INCREMENT PRIMARY KEY,
      configId INT NOT NULL,
      userId VARCHAR(255) NOT NULL,
      userContext JSON NOT NULL,
      evaluatedValue TEXT,
      campaignId INT,
      evaluatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expiresAt TIMESTAMP NOT NULL,
      
      INDEX idx_config_user (configId, userId),
      INDEX idx_expires (expiresAt),
      INDEX idx_campaign (campaignId),
      FOREIGN KEY (configId) REFERENCES g_remote_configs(id) ON DELETE CASCADE,
      FOREIGN KEY (campaignId) REFERENCES g_remote_config_campaigns(id) ON DELETE CASCADE
    )
  `);

  console.log('✅ Campaign enhancements added successfully');
  await connection.end();
};

exports.down = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix'
  });

  console.log('Rolling back campaign enhancements...');

  // Drop cache table
  await connection.execute('DROP TABLE IF EXISTS g_remote_config_campaign_cache');

  // Remove added columns
  await connection.execute('ALTER TABLE g_remote_config_campaign_configs DROP COLUMN priority');
  await connection.execute('ALTER TABLE g_remote_config_campaigns DROP FOREIGN KEY g_remote_config_campaigns_ibfk_2');
  await connection.execute('ALTER TABLE g_remote_config_campaigns DROP COLUMN updatedBy');
  await connection.execute('ALTER TABLE g_remote_config_campaigns DROP INDEX idx_status');
  await connection.execute('ALTER TABLE g_remote_config_campaigns DROP COLUMN status');
  await connection.execute('ALTER TABLE g_remote_config_campaigns DROP INDEX idx_priority');
  await connection.execute('ALTER TABLE g_remote_config_campaigns DROP COLUMN priority');

  console.log('✅ Campaign enhancements rolled back successfully');
  await connection.end();
};
