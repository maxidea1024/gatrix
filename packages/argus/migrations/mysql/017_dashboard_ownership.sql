-- Add ownership and sharing columns to dashboards table (idempotent)

-- owner_user_id: who created/owns this dashboard
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_dashboards' AND COLUMN_NAME = 'owner_user_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE g_argus_dashboards ADD COLUMN owner_user_id VARCHAR(128) DEFAULT NULL AFTER project_id', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- visibility: 'personal' | 'team' | 'project' (default 'project' for backwards compat)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_dashboards' AND COLUMN_NAME = 'visibility');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE g_argus_dashboards ADD COLUMN visibility VARCHAR(16) DEFAULT ''project'' AFTER owner_user_id', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- shared_with: JSON array of user IDs or team IDs
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_dashboards' AND COLUMN_NAME = 'shared_with');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE g_argus_dashboards ADD COLUMN shared_with JSON DEFAULT NULL AFTER visibility', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index on owner for personal dashboard queries
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_dashboards' AND INDEX_NAME = 'idx_owner');
SET @sql = IF(@idx_exists = 0, 'CREATE INDEX idx_owner ON g_argus_dashboards (owner_user_id)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
