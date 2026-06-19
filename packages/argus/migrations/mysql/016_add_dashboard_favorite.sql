-- Add favorite flag to dashboards table (idempotent)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_dashboards' AND COLUMN_NAME = 'is_favorite');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE g_argus_dashboards ADD COLUMN is_favorite TINYINT(1) DEFAULT 0 AFTER widgets_config', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
