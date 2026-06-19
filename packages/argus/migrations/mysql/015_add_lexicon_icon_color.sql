-- Add icon_color column to lexicon events table (idempotent)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_lexicon_events' AND COLUMN_NAME = 'icon_color');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE g_argus_lexicon_events ADD COLUMN icon_color VARCHAR(20) NULL AFTER icon', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
