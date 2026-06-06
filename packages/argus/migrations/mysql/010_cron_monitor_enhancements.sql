-- Cron Monitor Enhancements
-- Adds timezone, threshold settings, muting, and timeout tracking

-- cronMonitors: add configuration columns (Sentry parity)
ALTER TABLE g_argus_cronMonitors
  ADD COLUMN timezone VARCHAR(64) DEFAULT 'UTC' AFTER environment,
  ADD COLUMN failure_issue_threshold INT DEFAULT 1 AFTER timezone,
  ADD COLUMN recovery_threshold INT DEFAULT 1 AFTER failure_issue_threshold,
  ADD COLUMN is_muted TINYINT(1) DEFAULT 0 AFTER recovery_threshold;

-- cronCheckins: add timeout and tracing columns
ALTER TABLE g_argus_cronCheckins
  ADD COLUMN timeout_at TIMESTAMP NULL AFTER expected_time,
  ADD COLUMN date_in_progress TIMESTAMP NULL AFTER timeout_at,
  ADD COLUMN trace_id VARCHAR(64) NULL AFTER date_in_progress;

-- Index for supervisor timeout detection queries
ALTER TABLE g_argus_cronCheckins
  ADD INDEX idx_status_timeout (status, timeout_at);
