/**
 * Create Banners table for banner management system
 * Supports sequences, frames, actions, effects, and transitions
 */

exports.up = async function (connection) {
  console.log('Creating banners table...');

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_banners (
      bannerId VARCHAR(26) PRIMARY KEY COMMENT 'ULID based unique ID',
      name VARCHAR(255) NOT NULL COMMENT 'Internal identifier name',
      description TEXT NULL COMMENT 'Operator description',
      width INT NOT NULL DEFAULT 1024 COMMENT 'Rendering width (px)',
      height INT NOT NULL DEFAULT 512 COMMENT 'Rendering height (px)',
      metadata JSON NULL COMMENT 'Extended settings JSON',
      playbackSpeed DECIMAL(3,2) NOT NULL DEFAULT 1.00 COMMENT 'Overall banner playback speed',
      sequences JSON NOT NULL COMMENT 'Sequence list (JSON Array)',
      version INT NOT NULL DEFAULT 1 COMMENT 'Version for cache management',
      status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft' COMMENT 'Banner status',
      createdBy INT NULL COMMENT 'Creator User ID',
      updatedBy INT NULL COMMENT 'Updater User ID',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_name (name),
      INDEX idx_status (status),
      INDEX idx_created_at (createdAt),
      INDEX idx_updated_at (updatedAt),
      CONSTRAINT fk_banners_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_banners_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('Banners table created successfully');
};

exports.down = async function (connection) {
  console.log('Dropping banners table...');

  await connection.execute('DROP TABLE IF EXISTS g_banners');

  console.log('Banners table dropped successfully');
};
