-- Source map artifacts for Argus
-- Stores metadata for uploaded source maps

CREATE TABLE IF NOT EXISTS `g_argus_sourcemap_releases` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_id` VARCHAR(64) NOT NULL,
  `release` VARCHAR(200) NOT NULL,
  `dist` VARCHAR(100) DEFAULT '',
  `file_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_project_release_dist` (`project_id`, `release`, `dist`),
  KEY `idx_project_id` (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `g_argus_sourcemap_files` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `release_id` INT UNSIGNED NOT NULL,
  `project_id` VARCHAR(64) NOT NULL,
  `file_path` VARCHAR(500) NOT NULL COMMENT 'Original file path (e.g., ~/static/js/main.abc123.js)',
  `file_name` VARCHAR(255) NOT NULL COMMENT 'File name only',
  `sourcemap_path` VARCHAR(500) NOT NULL COMMENT 'Stored path on disk',
  `file_size` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_release_id` (`release_id`),
  KEY `idx_project_file` (`project_id`, `file_path`(255)),
  CONSTRAINT `fk_sourcemap_files_release` FOREIGN KEY (`release_id`)
    REFERENCES `g_argus_sourcemap_releases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
