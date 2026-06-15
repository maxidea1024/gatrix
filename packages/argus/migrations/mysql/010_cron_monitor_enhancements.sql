-- Cron Monitor Enhancements
-- Adds timezone, threshold settings, muting, and timeout tracking
-- Idempotent: uses procedures to skip columns/indexes that already exist

DROP PROCEDURE IF EXISTS _argus_010_migrate;

DELIMITER //
CREATE PROCEDURE _argus_010_migrate()
BEGIN
  -- cronMonitors: add configuration columns
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_cronMonitors' AND COLUMN_NAME = 'timezone') THEN
    ALTER TABLE g_argus_cronMonitors ADD COLUMN timezone VARCHAR(64) DEFAULT 'UTC' AFTER environment;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_cronMonitors' AND COLUMN_NAME = 'failure_issue_threshold') THEN
    ALTER TABLE g_argus_cronMonitors ADD COLUMN failure_issue_threshold INT DEFAULT 1 AFTER timezone;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_cronMonitors' AND COLUMN_NAME = 'recovery_threshold') THEN
    ALTER TABLE g_argus_cronMonitors ADD COLUMN recovery_threshold INT DEFAULT 1 AFTER failure_issue_threshold;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_cronMonitors' AND COLUMN_NAME = 'is_muted') THEN
    ALTER TABLE g_argus_cronMonitors ADD COLUMN is_muted TINYINT(1) DEFAULT 0 AFTER recovery_threshold;
  END IF;

  -- cronCheckins: add timeout and tracing columns
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_cronCheckins' AND COLUMN_NAME = 'timeout_at') THEN
    ALTER TABLE g_argus_cronCheckins ADD COLUMN timeout_at TIMESTAMP NULL AFTER expected_time;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_cronCheckins' AND COLUMN_NAME = 'date_in_progress') THEN
    ALTER TABLE g_argus_cronCheckins ADD COLUMN date_in_progress TIMESTAMP NULL AFTER timeout_at;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_cronCheckins' AND COLUMN_NAME = 'trace_id') THEN
    ALTER TABLE g_argus_cronCheckins ADD COLUMN trace_id VARCHAR(64) NULL AFTER date_in_progress;
  END IF;

  -- Index for supervisor timeout detection queries
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_cronCheckins' AND INDEX_NAME = 'idx_status_timeout') THEN
    ALTER TABLE g_argus_cronCheckins ADD INDEX idx_status_timeout (status, timeout_at);
  END IF;
END //
DELIMITER ;

CALL _argus_010_migrate();
DROP PROCEDURE IF EXISTS _argus_010_migrate;
