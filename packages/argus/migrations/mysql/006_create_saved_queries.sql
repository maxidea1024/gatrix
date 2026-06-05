-- Saved queries for all Argus explore pages (Discover, Logs, Traces, Metrics)
CREATE TABLE IF NOT EXISTS `g_argus_saved_queries` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `project_id`   VARCHAR(64) NOT NULL,
  `name`         VARCHAR(255) NOT NULL,
  `description`  TEXT,
  `query_type`   ENUM('discover','logs','traces','metrics') NOT NULL DEFAULT 'discover',
  `query_config` JSON NOT NULL,
  `display_type` VARCHAR(50) DEFAULT 'table',
  `is_global`    TINYINT(1) DEFAULT 0,
  `created_by`   VARCHAR(100) NOT NULL DEFAULT 'system',
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_project_type` (`project_id`, `query_type`),
  INDEX `idx_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
