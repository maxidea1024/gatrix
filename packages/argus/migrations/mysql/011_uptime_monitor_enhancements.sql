-- Uptime Monitor Enhancements
-- Adds HTTP verification config, threshold settings, response capture, and muting

-- uptimeMonitors: add HTTP configuration and threshold columns
ALTER TABLE g_argus_uptimeMonitors
  ADD COLUMN timeout_ms INT DEFAULT 10000 AFTER interval_seconds,
  ADD COLUMN headers JSON DEFAULT NULL AFTER timeout_ms,
  ADD COLUMN body TEXT DEFAULT NULL AFTER headers,
  ADD COLUMN expected_status_codes JSON DEFAULT NULL AFTER body,
  ADD COLUMN downtime_threshold INT DEFAULT 3 AFTER expected_status_codes,
  ADD COLUMN recovery_threshold INT DEFAULT 1 AFTER downtime_threshold,
  ADD COLUMN consecutive_failures INT DEFAULT 0 AFTER recovery_threshold,
  ADD COLUMN consecutive_successes INT DEFAULT 0 AFTER consecutive_failures,
  ADD COLUMN is_muted TINYINT(1) DEFAULT 0 AFTER consecutive_successes;

-- uptimeCheckins: add HTTP response details
ALTER TABLE g_argus_uptimeCheckins
  ADD COLUMN status_code INT NULL AFTER response_ms,
  ADD COLUMN error_message VARCHAR(512) NULL AFTER status_code;

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
