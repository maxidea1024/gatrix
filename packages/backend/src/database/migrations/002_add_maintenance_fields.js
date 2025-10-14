
exports.up = async function() {
  console.log('Running migration: Add maintenance fields to game worlds and client versions...');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate'
  });

  try {
    // Add maintenance fields to g_game_worlds table
    console.log('Adding maintenance fields to g_game_worlds table...');

    // Check if columns exist and add them if they don't
    const gameWorldColumns = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'g_game_worlds'
      AND COLUMN_NAME IN ('maintenanceStartDate', 'maintenanceEndDate', 'maintenanceMessage', 'supportsMultiLanguage')
    `);

    const existingColumns = gameWorldColumns[0].map(row => row.COLUMN_NAME);

    if (!existingColumns.includes('maintenanceStartDate')) {
      await connection.execute(`ALTER TABLE g_game_worlds ADD COLUMN maintenanceStartDate DATETIME NULL COMMENT '점검 시작일시'`);
    }
    if (!existingColumns.includes('maintenanceEndDate')) {
      await connection.execute(`ALTER TABLE g_game_worlds ADD COLUMN maintenanceEndDate DATETIME NULL COMMENT '점검 종료일시'`);
    }
    if (!existingColumns.includes('maintenanceMessage')) {
      await connection.execute(`ALTER TABLE g_game_worlds ADD COLUMN maintenanceMessage TEXT NULL COMMENT '점검 메시지'`);
    }
    if (!existingColumns.includes('supportsMultiLanguage')) {
      await connection.execute(`ALTER TABLE g_game_worlds ADD COLUMN supportsMultiLanguage BOOLEAN NOT NULL DEFAULT FALSE COMMENT '다국어 지원 여부'`);
    }
    console.log('✓ Added maintenance fields to g_game_worlds');

    // Create game world maintenance locales table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS g_game_world_maintenance_locales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        gameWorldId INT NOT NULL COMMENT '게임월드 ID',
        lang ENUM('ko', 'en', 'zh') NOT NULL COMMENT '언어 코드',
        message TEXT NOT NULL COMMENT '점검 메시지',
        createdBy INT NULL COMMENT '생성자 ID',
        updatedBy INT NULL COMMENT '수정자 ID',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
        FOREIGN KEY (gameWorldId) REFERENCES g_game_worlds(id) ON DELETE CASCADE,
        FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
        FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
        UNIQUE KEY unique_game_world_lang (gameWorldId, lang)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='게임월드 점검 메시지 다국어 테이블'
    `);
    console.log('✓ Created g_game_world_maintenance_locales table');

    // Add maintenance fields to g_client_versions table
    console.log('Adding maintenance fields to g_client_versions table...');

    // Check if columns exist and add them if they don't
    const clientVersionColumns = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'g_client_versions'
      AND COLUMN_NAME IN ('maintenanceStartDate', 'maintenanceEndDate', 'maintenanceMessage', 'supportsMultiLanguage')
    `);

    const existingClientColumns = clientVersionColumns[0].map(row => row.COLUMN_NAME);

    if (!existingClientColumns.includes('maintenanceStartDate')) {
      await connection.execute(`ALTER TABLE g_client_versions ADD COLUMN maintenanceStartDate DATETIME NULL COMMENT '점검 시작일시'`);
    }
    if (!existingClientColumns.includes('maintenanceEndDate')) {
      await connection.execute(`ALTER TABLE g_client_versions ADD COLUMN maintenanceEndDate DATETIME NULL COMMENT '점검 종료일시'`);
    }
    if (!existingClientColumns.includes('maintenanceMessage')) {
      await connection.execute(`ALTER TABLE g_client_versions ADD COLUMN maintenanceMessage TEXT NULL COMMENT '점검 메시지'`);
    }
    if (!existingClientColumns.includes('supportsMultiLanguage')) {
      await connection.execute(`ALTER TABLE g_client_versions ADD COLUMN supportsMultiLanguage BOOLEAN NOT NULL DEFAULT FALSE COMMENT '다국어 지원 여부'`);
    }
    console.log('✓ Added maintenance fields to g_client_versions');

    // Create client version maintenance locales table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS g_client_version_maintenance_locales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        clientVersionId INT NOT NULL COMMENT '클라이언트 버전 ID',
        lang ENUM('ko', 'en', 'zh') NOT NULL COMMENT '언어 코드',
        message TEXT NOT NULL COMMENT '점검 메시지',
        createdBy INT NULL COMMENT '생성자 ID',
        updatedBy INT NULL COMMENT '수정자 ID',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시',
        FOREIGN KEY (clientVersionId) REFERENCES g_client_versions(id) ON DELETE CASCADE,
        FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
        FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
        UNIQUE KEY unique_client_version_lang (clientVersionId, lang)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='클라이언트 버전 점검 메시지 다국어 테이블'
    `);
    console.log('✓ Created g_client_version_maintenance_locales table');

    console.log('✅ Migration completed successfully: Add maintenance fields');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
  }
};

exports.down = async function() {
  console.log('Rolling back migration: Add maintenance fields...');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate'
  });

  try {
    // Drop maintenance locale tables
    await connection.execute('DROP TABLE IF EXISTS g_client_version_maintenance_locales');
    console.log('✓ Dropped g_client_version_maintenance_locales table');
    
    await connection.execute('DROP TABLE IF EXISTS g_game_world_maintenance_locales');
    console.log('✓ Dropped g_game_world_maintenance_locales table');

    // Remove maintenance fields from g_client_versions
    await connection.execute(`
      ALTER TABLE g_client_versions 
      DROP COLUMN IF EXISTS maintenanceStartDate,
      DROP COLUMN IF EXISTS maintenanceEndDate,
      DROP COLUMN IF EXISTS maintenanceMessage,
      DROP COLUMN IF EXISTS supportsMultiLanguage
    `);
    console.log('✓ Removed maintenance fields from g_client_versions');

    // Remove maintenance fields from g_game_worlds
    await connection.execute(`
      ALTER TABLE g_game_worlds 
      DROP COLUMN IF EXISTS maintenanceStartDate,
      DROP COLUMN IF EXISTS maintenanceEndDate,
      DROP COLUMN IF EXISTS maintenanceMessage,
      DROP COLUMN IF EXISTS supportsMultiLanguage
    `);
    console.log('✓ Removed maintenance fields from g_game_worlds');

    console.log('✅ Migration rollback completed successfully');
    
  } catch (error) {
    console.error('❌ Migration rollback failed:', error);
    throw error;
  } finally {
  }
};
