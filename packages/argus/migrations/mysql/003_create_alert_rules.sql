-- Alert Rules table for Argus
CREATE TABLE IF NOT EXISTS `g_argus_alert_rules` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `conditions` JSON NOT NULL COMMENT 'Array of conditions: [{type, value, interval}]',
  `actions` JSON NOT NULL COMMENT 'Array of actions: [{type, target_url, channel}]',
  `frequency` INT UNSIGNED NOT NULL DEFAULT 60 COMMENT 'Min seconds between alerts',
  `environment` VARCHAR(100) DEFAULT NULL COMMENT 'Optional environment filter',
  `level` VARCHAR(20) DEFAULT NULL COMMENT 'Optional level filter',
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `last_triggered_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_project_enabled` (`project_id`, `enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Alert history table
CREATE TABLE IF NOT EXISTS `g_argus_alert_history` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `rule_id` INT UNSIGNED NOT NULL,
  `project_id` INT UNSIGNED NOT NULL,
  `issue_id` INT UNSIGNED DEFAULT NULL,
  `message` TEXT,
  `triggered_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_rule_triggered` (`rule_id`, `triggered_at`),
  KEY `idx_project_triggered` (`project_id`, `triggered_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
