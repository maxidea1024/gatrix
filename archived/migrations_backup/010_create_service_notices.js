/**
 * Migration: Create service notices table
 */

exports.up = async function(connection) {
  console.log('Creating service notices table...');

  // Create service notices table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_service_notices (
      id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Auto-increment ID',
      isActive BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Active status',
      category ENUM('maintenance', 'event', 'notice', 'promotion', 'other') NOT NULL COMMENT 'Notice category',
      platforms JSON NOT NULL COMMENT 'Target platforms (pc, pc-wegame, ios, android, harmonyos)',
      startDate DATETIME NULL COMMENT 'Start date/time (UTC)',
      endDate DATETIME NOT NULL COMMENT 'End date/time (UTC)',
      tabTitle VARCHAR(200) NULL COMMENT 'Optional tab title (used in list views)',
      title VARCHAR(500) NOT NULL COMMENT 'Notice title',
      content TEXT NOT NULL COMMENT 'Notice content (rich text HTML)',
      description TEXT NULL COMMENT 'Optional description',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Created timestamp',
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Updated timestamp',

      INDEX idx_service_notices_is_active (isActive),
      INDEX idx_service_notices_category (category),
      INDEX idx_service_notices_start_date (startDate),
      INDEX idx_service_notices_end_date (endDate),
      INDEX idx_service_notices_created_at (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('✅ Created g_service_notices table');
};

exports.down = async function(connection) {
  console.log('Dropping service notices table...');

  await connection.execute('DROP TABLE IF EXISTS g_service_notices');

  console.log('✅ Dropped g_service_notices table');
};

