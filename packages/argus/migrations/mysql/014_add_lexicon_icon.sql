-- Add icon column to lexicon events table (idempotent)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_lexicon_events' AND COLUMN_NAME = 'icon');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE g_argus_lexicon_events ADD COLUMN icon VARCHAR(50) NULL AFTER display_name', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
