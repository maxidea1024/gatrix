-- Uptime Monitor Enhancements
-- Adds HTTP verification config, threshold settings, response capture, and muting
-- Idempotent: uses procedures to skip columns that already exist

DROP PROCEDURE IF EXISTS _argus_011_migrate;

DELIMITER //
CREATE PROCEDURE _argus_011_migrate()
BEGIN
  -- uptimeMonitors: add HTTP configuration and threshold columns
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_uptimeMonitors' AND COLUMN_NAME = 'timeout_ms') THEN
    ALTER TABLE g_argus_uptimeMonitors ADD COLUMN timeout_ms INT DEFAULT 10000 AFTER interval_seconds;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_uptimeMonitors' AND COLUMN_NAME = 'headers') THEN
    ALTER TABLE g_argus_uptimeMonitors ADD COLUMN headers JSON DEFAULT NULL AFTER timeout_ms;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_uptimeMonitors' AND COLUMN_NAME = 'body') THEN
    ALTER TABLE g_argus_uptimeMonitors ADD COLUMN body TEXT DEFAULT NULL AFTER headers;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_uptimeMonitors' AND COLUMN_NAME = 'expected_status_codes') THEN
    ALTER TABLE g_argus_uptimeMonitors ADD COLUMN expected_status_codes JSON DEFAULT NULL AFTER body;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_uptimeMonitors' AND COLUMN_NAME = 'downtime_threshold') THEN
    ALTER TABLE g_argus_uptimeMonitors ADD COLUMN downtime_threshold INT DEFAULT 3 AFTER expected_status_codes;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_uptimeMonitors' AND COLUMN_NAME = 'recovery_threshold') THEN
    ALTER TABLE g_argus_uptimeMonitors ADD COLUMN recovery_threshold INT DEFAULT 1 AFTER downtime_threshold;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_uptimeMonitors' AND COLUMN_NAME = 'consecutive_failures') THEN
    ALTER TABLE g_argus_uptimeMonitors ADD COLUMN consecutive_failures INT DEFAULT 0 AFTER recovery_threshold;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_uptimeMonitors' AND COLUMN_NAME = 'consecutive_successes') THEN
    ALTER TABLE g_argus_uptimeMonitors ADD COLUMN consecutive_successes INT DEFAULT 0 AFTER consecutive_failures;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_uptimeMonitors' AND COLUMN_NAME = 'is_muted') THEN
    ALTER TABLE g_argus_uptimeMonitors ADD COLUMN is_muted TINYINT(1) DEFAULT 0 AFTER consecutive_successes;
  END IF;

  -- uptimeCheckins: add HTTP response details
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_uptimeCheckins' AND COLUMN_NAME = 'status_code') THEN
    ALTER TABLE g_argus_uptimeCheckins ADD COLUMN status_code INT NULL AFTER response_ms;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_uptimeCheckins' AND COLUMN_NAME = 'error_message') THEN
    ALTER TABLE g_argus_uptimeCheckins ADD COLUMN error_message VARCHAR(512) NULL AFTER status_code;
  END IF;
END //
DELIMITER ;

CALL _argus_011_migrate();
DROP PROCEDURE IF EXISTS _argus_011_migrate;

-- Uptime response capture table (mirrors Sentry's UptimeResponseCapture)
CREATE TABLE IF NOT EXISTS g_argus_uptimeResponseCaptures (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  monitor_id BIGINT NOT NULL,
  checkin_id BIGINT NULL,
  status_code INT NULL,
  response_headers TEXT NULL,
  response_body MEDIUMTEXT NULL,
  captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_monitor_time (monitor_id, captured_at),
  FOREIGN KEY (monitor_id) REFERENCES g_argus_uptimeMonitors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
