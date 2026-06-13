-- Argus MySQL Schema

CREATE TABLE IF NOT EXISTS g_argus_projects (
  id                      BIGINT AUTO_INCREMENT PRIMARY KEY,
  gatrix_project_id       VARCHAR(64) NOT NULL,
  name                    VARCHAR(255) NOT NULL,
  slug                    VARCHAR(128) NOT NULL,
  platform                VARCHAR(64) DEFAULT 'javascript',
  settings                JSON,
  error_quota_daily       INT DEFAULT 0,
  transaction_sample_rate DECIMAL(5,4) DEFAULT 1.0,
  session_sample_rate     DECIMAL(5,4) DEFAULT 1.0,
  retention_days          INT DEFAULT 90,
  metrics_group_limit     INT DEFAULT 10,
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_gatrix_project (gatrix_project_id),
  UNIQUE KEY uk_slug (slug)
);

CREATE TABLE IF NOT EXISTS g_argus_dsnKeys (
  id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  project_id          VARCHAR(64) NOT NULL,
  label               VARCHAR(255) DEFAULT 'Default',
  public_key          VARCHAR(64) NOT NULL,
  secret_key          VARCHAR(64) NOT NULL,
  is_active           TINYINT(1) DEFAULT 1,
  rate_limit_window   INT DEFAULT 60,
  rate_limit_count    INT DEFAULT 1000,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_public_key (public_key),
  INDEX idx_project_id (project_id)
);

CREATE TABLE IF NOT EXISTS g_argus_issues (
  id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  project_id          VARCHAR(64) NOT NULL,
  short_id            INT NOT NULL,
  title               VARCHAR(512) NOT NULL,
  culprit             VARCHAR(512),
  type                VARCHAR(64) DEFAULT 'error',
  level               VARCHAR(16) DEFAULT 'error',
  platform            VARCHAR(64),
  primary_hash        VARCHAR(64) NOT NULL,
  fingerprint         JSON,
  first_seen          TIMESTAMP NOT NULL,
  last_seen           TIMESTAMP NOT NULL,
  times_seen          BIGINT DEFAULT 1,
  num_users           INT DEFAULT 0,
  status              VARCHAR(32) DEFAULT 'unresolved',
  substatus           VARCHAR(32),
  resolved_at         TIMESTAMP NULL,
  resolved_by         INT NULL,
  assigned_to         VARCHAR(255) DEFAULT NULL,
  first_release       VARCHAR(255),
  last_release        VARCHAR(255),
  priority            VARCHAR(16) DEFAULT 'medium',
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_project_hash (project_id, primary_hash),
  INDEX idx_project_status (project_id, status),
  INDEX idx_project_last_seen (project_id, last_seen DESC),
  INDEX idx_project_times_seen (project_id, times_seen DESC)
);

CREATE TABLE IF NOT EXISTS g_argus_releases (
  id                    BIGINT AUTO_INCREMENT PRIMARY KEY,
  project_id            VARCHAR(64) NOT NULL,
  version               VARCHAR(255) NOT NULL,
  short_version         VARCHAR(128),
  total_errors          INT DEFAULT 0,
  new_issues            INT DEFAULT 0,
  crash_free_sessions   DECIMAL(7,4),
  crash_free_users      DECIMAL(7,4),
  total_sessions        BIGINT DEFAULT 0,
  total_users           INT DEFAULT 0,
  commit_count          INT DEFAULT 0,
  deploy_count          INT DEFAULT 0,
  ref                   VARCHAR(255),
  url                   VARCHAR(512),
  date_released         TIMESTAMP NULL,
  date_deployed         TIMESTAMP NULL,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_project_version (project_id, version),
  INDEX idx_project_released (project_id, date_released DESC)
);

CREATE TABLE IF NOT EXISTS g_argus_releaseCommits (
  id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  release_id          BIGINT NOT NULL,
  commit_hash         VARCHAR(64) NOT NULL,
  author_name         VARCHAR(255),
  author_email        VARCHAR(255),
  message             TEXT,
  date_added          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  files_changed       JSON,
  FOREIGN KEY (release_id) REFERENCES g_argus_releases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS g_argus_sourceMaps (
  id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  project_id          VARCHAR(64) NOT NULL,
  release_id          BIGINT NULL,
  name                VARCHAR(512) NOT NULL,
  debug_id            VARCHAR(64),
  storage_key         VARCHAR(1024) NOT NULL,
  file_size           BIGINT DEFAULT 0,
  file_hash           VARCHAR(64),
  artifact_type       VARCHAR(32) DEFAULT 'source_map',
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_project_release (project_id, release_id),
  INDEX idx_debug_id (debug_id)
);

CREATE TABLE IF NOT EXISTS g_argus_cronMonitors (
  id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  project_id          VARCHAR(64) NOT NULL,
  name                VARCHAR(255) NOT NULL,
  slug                VARCHAR(128) NOT NULL,
  status              VARCHAR(32) DEFAULT 'active',
  type                VARCHAR(32) DEFAULT 'cron_job',
  schedule_type       VARCHAR(16) NOT NULL,
  schedule_value      VARCHAR(128) NOT NULL,
  schedule_unit       VARCHAR(16),
  checkin_margin      INT DEFAULT 5,
  max_runtime         INT DEFAULT 30,
  last_checkin_at     TIMESTAMP NULL,
  next_checkin_at     TIMESTAMP NULL,
  last_status         VARCHAR(32),
  environment         VARCHAR(64) DEFAULT 'production',
  owner_id            INT NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_project_slug (project_id, slug)
);

CREATE TABLE IF NOT EXISTS g_argus_cronCheckins (
  id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  monitor_id          BIGINT NOT NULL,
  checkin_id          VARCHAR(64) NOT NULL,
  status              VARCHAR(32) NOT NULL,
  duration            INT NULL,
  environment         VARCHAR(64),
  expected_time       TIMESTAMP NULL,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_checkin_id (checkin_id),
  INDEX idx_monitor_status (monitor_id, status),
  FOREIGN KEY (monitor_id) REFERENCES g_argus_cronMonitors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS g_argus_environments (
  id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  project_id          VARCHAR(64) NOT NULL,
  name                VARCHAR(64) NOT NULL,
  is_hidden           TINYINT(1) DEFAULT 0,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_project_name (project_id, name)
);

CREATE TABLE IF NOT EXISTS g_argus_fingerprintRules (
  id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  project_id          VARCHAR(64) NOT NULL,
  matchers            JSON NOT NULL,
  fingerprint         JSON NOT NULL,
  is_active           TINYINT(1) DEFAULT 1,
  priority            INT DEFAULT 0,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_project_id (project_id)
);
