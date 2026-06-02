-- Create tables that were missing from previous migrations.
-- These tables are used by integrations, commits, ownership, issue activity, and dashboards routes.

CREATE TABLE IF NOT EXISTS g_argus_integrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  repo_url VARCHAR(512) NOT NULL,
  default_branch VARCHAR(100) DEFAULT 'main',
  access_token VARCHAR(512) DEFAULT NULL,
  enabled TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS g_argus_commits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  commit_hash VARCHAR(64) NOT NULL,
  author_name VARCHAR(255) DEFAULT NULL,
  author_email VARCHAR(255) DEFAULT NULL,
  message TEXT DEFAULT NULL,
  timestamp DATETIME DEFAULT NULL,
  release_version VARCHAR(255) DEFAULT NULL,
  files_changed JSON DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_project_commit (project_id, commit_hash),
  INDEX idx_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS g_argus_ownership_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  match_type VARCHAR(50) NOT NULL,
  match_pattern VARCHAR(512) NOT NULL,
  owners JSON NOT NULL,
  priority INT DEFAULT 0,
  auto_assign TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS g_argus_issue_activity (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  issue_id BIGINT NOT NULL,
  user_name VARCHAR(255) DEFAULT NULL,
  action VARCHAR(50) NOT NULL,
  data JSON DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_project_issue (project_id, issue_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS g_argus_dashboards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  widgets_config JSON DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
