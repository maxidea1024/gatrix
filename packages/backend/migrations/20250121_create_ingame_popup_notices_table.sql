-- Create g_ingame_popup_notices table for in-game popup notice system
-- This table stores popup notices that appear in the game client

CREATE TABLE IF NOT EXISTS g_ingame_popup_notices (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique identifier',
  
  -- Basic fields
  isActive BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether the notice is active',
  content TEXT NOT NULL COMMENT 'Plain text content of the popup notice',
  
  -- Targeting fields (JSON arrays for multiple selections)
  targetWorlds JSON NULL COMMENT 'Target game world IDs (array of strings)',
  targetMarkets JSON NULL COMMENT 'Target markets (array of strings)',
  targetPlatforms JSON NULL COMMENT 'Target platforms (array of strings)',
  targetClientVersions JSON NULL COMMENT 'Target client versions (array of strings)',
  targetAccountIds JSON NULL COMMENT 'Target account IDs (array of strings)',
  
  -- Display settings
  displayPriority INT NOT NULL DEFAULT 100 COMMENT 'Display priority (lower number = higher priority)',
  showOnce BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether to show only once per user',
  
  -- Date range
  startDate TIMESTAMP NOT NULL COMMENT 'Start date and time for the notice',
  endDate TIMESTAMP NOT NULL COMMENT 'End date and time for the notice',
  
  -- Message template
  messageTemplateId BIGINT UNSIGNED NULL COMMENT 'Reference to message template (if using template)',
  useTemplate BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether to use message template',
  
  -- Metadata
  description TEXT NULL COMMENT 'Internal description/memo for admins',
  
  -- Audit fields
  createdBy INT NOT NULL COMMENT 'User ID who created the notice',
  updatedBy INT NULL COMMENT 'User ID who last updated the notice',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes for performance
  INDEX idx_ingame_popup_notices_active (isActive),
  INDEX idx_ingame_popup_notices_dates (startDate, endDate),
  INDEX idx_ingame_popup_notices_priority (displayPriority),
  INDEX idx_ingame_popup_notices_template (messageTemplateId),
  INDEX idx_ingame_popup_notices_created_by (createdBy),
  INDEX idx_ingame_popup_notices_updated_by (updatedBy),
  
  -- Foreign key constraints
  CONSTRAINT fk_ingame_popup_notices_creator FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ingame_popup_notices_updater FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
  CONSTRAINT fk_ingame_popup_notices_template FOREIGN KEY (messageTemplateId) REFERENCES g_message_templates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='In-game popup notice system';

