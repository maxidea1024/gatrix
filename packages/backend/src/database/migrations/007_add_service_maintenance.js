/*
  Migration: Add service maintenance table for Service Discovery
  
  This table manages maintenance status for service types (e.g., 'world', 'auth', 'lobby')
*/

module.exports = {
  up: async (connection) => {
    console.log('Creating g_service_maintenance table...');
    
    // Create service maintenance table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS g_service_maintenance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        serviceType VARCHAR(50) NOT NULL UNIQUE COMMENT 'Service type (e.g., world, auth, lobby, chat)',
        isInMaintenance BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Maintenance status',
        maintenanceStartDate DATETIME NULL COMMENT 'Maintenance start time',
        maintenanceEndDate DATETIME NULL COMMENT 'Maintenance end time',
        maintenanceMessage TEXT NULL COMMENT 'Default maintenance message',
        supportsMultiLanguage BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Multi-language support flag',
        createdBy INT NULL COMMENT 'Creator user ID',
        updatedBy INT NULL COMMENT 'Updater user ID',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Creation timestamp',
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Update timestamp',
        INDEX idx_service_type (serviceType),
        INDEX idx_maintenance_status (isInMaintenance),
        FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
        FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Service maintenance status table'
    `);
    console.log('✓ Created g_service_maintenance table');

    // Create service maintenance locales table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS g_service_maintenance_locales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        serviceMaintenanceId INT NOT NULL COMMENT 'Service maintenance ID',
        lang ENUM('ko', 'en', 'zh') NOT NULL COMMENT 'Language code',
        message TEXT NOT NULL COMMENT 'Localized maintenance message',
        createdBy INT NULL COMMENT 'Creator user ID',
        updatedBy INT NULL COMMENT 'Updater user ID',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Creation timestamp',
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Update timestamp',
        FOREIGN KEY (serviceMaintenanceId) REFERENCES g_service_maintenance(id) ON DELETE CASCADE,
        FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
        FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
        UNIQUE KEY unique_service_lang (serviceMaintenanceId, lang)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Service maintenance localized messages table'
    `);
    console.log('✓ Created g_service_maintenance_locales table');

    console.log('Service maintenance tables created successfully!');
  },

  down: async (connection) => {
    console.log('Rolling back service maintenance tables...');
    
    // Drop tables in reverse order
    await connection.execute('DROP TABLE IF EXISTS g_service_maintenance_locales');
    console.log('✓ Dropped g_service_maintenance_locales table');
    
    await connection.execute('DROP TABLE IF EXISTS g_service_maintenance');
    console.log('✓ Dropped g_service_maintenance table');

    console.log('Service maintenance tables rolled back successfully!');
  }
};

