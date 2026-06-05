-- Argus MySQL Schema for Uptime Monitors

CREATE TABLE IF NOT EXISTS g_argus_uptimeMonitors (
  id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  project_id          VARCHAR(64) NOT NULL,
  name                VARCHAR(255) NOT NULL,
  url                 VARCHAR(1024) NOT NULL,
  method              VARCHAR(16) DEFAULT 'GET',
  interval_seconds    INT DEFAULT 60,
  status              VARCHAR(32) DEFAULT 'up',
  uptime_percent      DECIMAL(5,2) DEFAULT 100.00,
  avg_response_ms     INT DEFAULT 0,
  environment         VARCHAR(64) DEFAULT 'production',
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_project_status (project_id, status)
);

CREATE TABLE IF NOT EXISTS g_argus_uptimeCheckins (
  id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  monitor_id          BIGINT NOT NULL,
  status              VARCHAR(32) NOT NULL,
  response_ms         INT NOT NULL,
  checked_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_monitor_checked (monitor_id, checked_at DESC),
  FOREIGN KEY (monitor_id) REFERENCES g_argus_uptimeMonitors(id) ON DELETE CASCADE
);
