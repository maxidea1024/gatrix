/**
 * 002 - Application Tables (Operations & Game Management)
 * Game worlds, client versions, whitelists, tags, vars, message templates,
 * jobs, service notices, popup notices, surveys, coupons, store products,
 * banners, monitoring, maintenance, server lifecycle, planning data
 * All IDs use ULID (CHAR(26))
 */

exports.up = async function (connection) {
    console.log('[002] Creating application tables...');

    // Tags
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_tags (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      name VARCHAR(100) NOT NULL UNIQUE,
      color VARCHAR(7) NOT NULL DEFAULT '#607D8B',
      description TEXT NULL,
      projectId CHAR(26) NULL,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_name (name),
      INDEX idx_project_id (projectId),
      CONSTRAINT fk_tags_project FOREIGN KEY (projectId) REFERENCES g_projects(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Tag assignments
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_tag_assignments (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      tagId CHAR(26) NOT NULL,
      entityType VARCHAR(50) NOT NULL,
      entityId CHAR(26) NOT NULL,
      createdBy CHAR(26) NOT NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_ta_tag FOREIGN KEY (tagId) REFERENCES g_tags(id) ON DELETE CASCADE,
      UNIQUE KEY unique_assignment (tagId, entityType, entityId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Game worlds
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_game_worlds (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      worldId VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      isVisible BOOLEAN NOT NULL DEFAULT TRUE,
      isMaintenance BOOLEAN NOT NULL DEFAULT FALSE,
      displayOrder INT NOT NULL DEFAULT 0,
      tags JSON NULL,
      maintenanceStartDate DATETIME NULL,
      maintenanceEndDate DATETIME NULL,
      maintenanceMessage TEXT NULL,
      maintenanceMessageTemplateId CHAR(26) NULL,
      supportsMultiLanguage BOOLEAN NOT NULL DEFAULT FALSE,
      forceDisconnect BOOLEAN NOT NULL DEFAULT FALSE,
      gracePeriodMinutes INT NOT NULL DEFAULT 0,
      customPayload JSON NULL,
      infraSettings JSON NULL,
      infraSettingsRaw TEXT NULL,
      worldServerAddress VARCHAR(255) NOT NULL,
      createdBy CHAR(26) NOT NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_world_id (worldId),
      INDEX idx_environment_id (environmentId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Client versions
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_client_versions (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      platform VARCHAR(100) NOT NULL,
      clientVersion VARCHAR(50) NOT NULL,
      clientStatus VARCHAR(50) NOT NULL,
      gameServerAddress VARCHAR(500) NOT NULL,
      gameServerAddressForWhiteList VARCHAR(500) NULL,
      patchAddress VARCHAR(500) NOT NULL,
      patchAddressForWhiteList VARCHAR(500) NULL,
      guestModeAllowed BOOLEAN NOT NULL DEFAULT FALSE,
      externalClickLink VARCHAR(500) NULL,
      memo TEXT NULL,
      customPayload TEXT NULL,
      maintenanceStartDate DATETIME NULL,
      maintenanceEndDate DATETIME NULL,
      maintenanceMessage TEXT NULL,
      supportsMultiLanguage BOOLEAN NOT NULL DEFAULT FALSE,
      messageTemplateId CHAR(26) NULL,
      createdBy CHAR(26) NOT NULL,
      updatedBy CHAR(26) NULL,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL,
      INDEX idx_environment_id (environmentId),
      UNIQUE KEY unique_env_platform_version (environmentId, platform, clientVersion)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Account whitelist
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_account_whitelist (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      accountId VARCHAR(32) NOT NULL,
      ipAddress VARCHAR(45) NULL,
      startDate DATETIME NULL,
      endDate DATETIME NULL,
      purpose TEXT NULL,
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      tags JSON NULL,
      createdBy CHAR(26) NOT NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_env_account_id (environmentId, accountId),
      INDEX idx_environment_id (environmentId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // IP whitelist
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_ip_whitelist (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      ipAddress VARCHAR(45) NOT NULL,
      purpose VARCHAR(500) NOT NULL,
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      startDate DATETIME NULL,
      endDate DATETIME NULL,
      tags JSON NULL,
      createdBy CHAR(26) NOT NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_environment_id (environmentId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Variables (KV)
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_vars (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      varKey VARCHAR(255) NOT NULL,
      varValue TEXT NULL,
      valueType VARCHAR(50) NOT NULL DEFAULT 'string',
      description TEXT NULL,
      isSystemDefined BOOLEAN NOT NULL DEFAULT FALSE,
      isCopyable BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy CHAR(26) NOT NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_env_varkey (environmentId, varKey)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Message templates
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_message_templates (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      name VARCHAR(191) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'maintenance',
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      supportsMultiLanguage BOOLEAN NOT NULL DEFAULT FALSE,
      defaultMessage TEXT NULL,
      subject VARCHAR(500) NULL,
      content TEXT NULL,
      variables JSON NULL,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_name (name),
      INDEX idx_type (type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Message template locales
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_message_template_locales (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      templateId CHAR(26) NOT NULL,
      lang VARCHAR(10) NOT NULL,
      message TEXT NOT NULL,
      createdBy CHAR(26) NOT NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (templateId) REFERENCES g_message_templates(id) ON DELETE CASCADE,
      INDEX idx_template (templateId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Job types
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_job_types (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      name VARCHAR(100) NOT NULL,
      displayName VARCHAR(200) NOT NULL,
      description TEXT NULL,
      jobSchema JSON NULL,
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Jobs
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_jobs (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      name VARCHAR(255) NOT NULL,
      memo TEXT NULL,
      jobTypeId CHAR(26) NOT NULL,
      jobDataMap JSON NULL,
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_jobs_type FOREIGN KEY (jobTypeId) REFERENCES g_job_types(id) ON DELETE RESTRICT,
      INDEX idx_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Job executions
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_job_executions (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      jobId CHAR(26) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      startedAt TIMESTAMP NULL,
      completedAt TIMESTAMP NULL,
      result JSON NULL,
      error TEXT NULL,
      logs TEXT NULL,
      triggeredBy VARCHAR(50) NOT NULL DEFAULT 'schedule',
      triggeredByUserId CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_je_job FOREIGN KEY (jobId) REFERENCES g_jobs(id) ON DELETE CASCADE,
      INDEX idx_job_status (jobId, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Service notices
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_service_notices (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      isPinned BOOLEAN NOT NULL DEFAULT FALSE,
      category ENUM('maintenance', 'event', 'notice', 'promotion', 'other') NOT NULL,
      platforms JSON NOT NULL,
      channels JSON NULL,
      subchannels JSON NULL,
      startDate DATETIME NULL,
      endDate DATETIME NULL,
      tabTitle VARCHAR(200) NULL,
      title VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      description TEXT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_environment_id (environmentId),
      INDEX idx_is_active (isActive)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Ingame popup notices
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_ingame_popup_notices (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      content TEXT NOT NULL,
      targetWorlds JSON NULL,
      targetWorldsInverted BOOLEAN NOT NULL DEFAULT FALSE,
      targetPlatforms JSON NULL,
      targetPlatformsInverted BOOLEAN NOT NULL DEFAULT FALSE,
      targetChannels JSON NULL,
      targetChannelsInverted BOOLEAN NOT NULL DEFAULT FALSE,
      targetSubchannels JSON NULL,
      targetSubchannelsInverted BOOLEAN NOT NULL DEFAULT FALSE,
      targetMarkets JSON NULL,
      targetClientVersions JSON NULL,
      targetAccountIds JSON NULL,
      targetUserIds VARCHAR(1000) NULL,
      targetUserIdsInverted BOOLEAN NOT NULL DEFAULT FALSE,
      displayPriority INT NOT NULL DEFAULT 100,
      showOnce BOOLEAN NOT NULL DEFAULT FALSE,
      startDate TIMESTAMP NULL,
      endDate TIMESTAMP NULL,
      messageTemplateId CHAR(26) NULL,
      useTemplate BOOLEAN NOT NULL DEFAULT FALSE,
      description TEXT NULL,
      createdBy CHAR(26) NOT NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_environment_id (environmentId),
      INDEX idx_active (isActive)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Surveys
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_surveys (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      platformSurveyId VARCHAR(191) NOT NULL,
      surveyTitle VARCHAR(500) NOT NULL,
      surveyContent TEXT NULL,
      triggerConditions JSON NOT NULL,
      participationRewards JSON NULL,
      rewardMailTitle VARCHAR(500) NULL,
      rewardMailContent TEXT NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_env_platform_survey (environmentId, platformSurveyId),
      INDEX idx_environment_id (environmentId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Coupon settings
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_coupon_settings (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      code VARCHAR(64) NULL,
      type ENUM('SPECIAL','NORMAL') NOT NULL,
      name VARCHAR(128) NOT NULL,
      description VARCHAR(128) NULL,
      tags JSON NULL,
      maxTotalUses BIGINT NULL,
      perUserLimit INT NOT NULL DEFAULT 1,
      usageLimitType ENUM('USER','CHARACTER') NOT NULL DEFAULT 'USER',
      rewardTemplateId CHAR(26) NULL,
      rewardData JSON NULL,
      rewardEmailTitle VARCHAR(255) NULL,
      rewardEmailBody TEXT NULL,
      startsAt DATETIME NULL,
      expiresAt DATETIME NOT NULL,
      status ENUM('ACTIVE','DISABLED','DELETED') NOT NULL DEFAULT 'ACTIVE',
      codePattern VARCHAR(32) NULL,
      generationJobId CHAR(26) NULL,
      generationStatus ENUM('PENDING','IN_PROGRESS','COMPLETED','FAILED') NULL,
      generatedCount INT NOT NULL DEFAULT 0,
      issuedCount INT NOT NULL DEFAULT 0,
      usedCount INT NOT NULL DEFAULT 0,
      targetPlatformsInverted BOOLEAN NOT NULL DEFAULT FALSE,
      targetChannelsInverted BOOLEAN NOT NULL DEFAULT FALSE,
      targetWorldsInverted BOOLEAN NOT NULL DEFAULT FALSE,
      targetUserIdsInverted BOOLEAN NOT NULL DEFAULT FALSE,
      disabledBy VARCHAR(64) NULL,
      disabledAt DATETIME NULL,
      disabledReason TEXT NULL,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_type (type),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Coupon target tables
    const couponTargets = ['worlds', 'platforms', 'channels', 'subchannels', 'users'];
    const couponTargetCol = { worlds: 'gameWorldId VARCHAR(64)', platforms: 'platform VARCHAR(32)', channels: 'channel VARCHAR(64)', subchannels: 'subchannel VARCHAR(64)', users: 'userId VARCHAR(64)' };
    const couponTargetUniq = { worlds: 'gameWorldId', platforms: 'platform', channels: 'channel', subchannels: 'subchannel', users: 'userId' };
    for (const t of couponTargets) {
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS g_coupon_target_${t} (
        id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
        settingId CHAR(26) NOT NULL,
        ${couponTargetCol[t]} NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_setting_${t} (settingId, ${couponTargetUniq[t]}),
        INDEX idx_setting (settingId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    }

    // Issued coupons
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_coupons (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      settingId CHAR(26) NOT NULL,
      code VARCHAR(32) NOT NULL,
      status ENUM('ISSUED','USED','REVOKED') NOT NULL DEFAULT 'ISSUED',
      issuedBatchJobId CHAR(26) NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      usedAt DATETIME NULL,
      INDEX idx_setting_status (settingId, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Coupon uses
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_coupon_uses (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      settingId CHAR(26) NOT NULL,
      issuedCouponId CHAR(26) NULL,
      userId VARCHAR(64) NOT NULL,
      characterId VARCHAR(64) NULL,
      userName VARCHAR(128) NOT NULL DEFAULT '',
      sequence INT NOT NULL,
      usedAt DATETIME NOT NULL,
      userIp VARCHAR(45) NULL,
      gameWorldId VARCHAR(64) NULL,
      platform VARCHAR(32) NULL,
      channel VARCHAR(64) NULL,
      subchannel VARCHAR(64) NULL,
      UNIQUE KEY uniq_setting_user_seq (settingId, userId, sequence),
      INDEX idx_setting_usedAt (settingId, usedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Coupon logs
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_coupon_logs (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      settingId CHAR(26) NOT NULL,
      issuedCouponId CHAR(26) NULL,
      userId VARCHAR(64) NULL,
      action ENUM('USE','INVALID','EXPIRED','FAILED') NOT NULL,
      detail TEXT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_setting_createdAt (settingId, createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Coupon batch jobs
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_coupon_batch_jobs (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      settingId CHAR(26) NOT NULL,
      totalCount BIGINT NOT NULL,
      issuedCount BIGINT NOT NULL DEFAULT 0,
      status ENUM('PENDING','RUNNING','DONE','FAILED') NOT NULL DEFAULT 'PENDING',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_setting (settingId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Reward templates
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_reward_templates (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      rewardItems JSON NOT NULL,
      tags JSON NULL,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_env (environmentId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Reward items
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_reward_items (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      rewardTemplateId CHAR(26) NOT NULL,
      itemType VARCHAR(64) NOT NULL,
      itemId VARCHAR(64) NULL,
      amount BIGINT NOT NULL,
      data JSON NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_template (rewardTemplateId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Store products
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_store_products (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      isActive TINYINT(1) NOT NULL DEFAULT 1,
      productId VARCHAR(255) NOT NULL,
      cmsProductId INT NULL,
      productName VARCHAR(255) NOT NULL,
      nameKo VARCHAR(255) NULL,
      nameEn VARCHAR(255) NULL,
      nameZh VARCHAR(255) NULL,
      store VARCHAR(50) NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'USD',
      saleStartAt DATETIME NULL,
      saleEndAt DATETIME NULL,
      description TEXT NULL,
      descriptionKo TEXT NULL,
      descriptionEn TEXT NULL,
      descriptionZh TEXT NULL,
      metadata JSON NULL,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_environment_id (environmentId),
      UNIQUE KEY uk_env_cms_product_id (environmentId, cmsProductId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Banners
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_banners (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      width INT NOT NULL DEFAULT 1024,
      height INT NOT NULL DEFAULT 512,
      metadata JSON NULL,
      playbackSpeed DECIMAL(3,2) NOT NULL DEFAULT 1.00,
      shuffle TINYINT(1) NOT NULL DEFAULT 0,
      sequences JSON NOT NULL,
      version INT NOT NULL DEFAULT 1,
      status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_environment_id (environmentId),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Server lifecycle events
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_server_lifecycle_events (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      instanceId VARCHAR(127) NOT NULL,
      serviceType VARCHAR(63) NOT NULL,
      serviceGroup VARCHAR(63),
      hostname VARCHAR(255),
      internalAddress VARCHAR(255),
      externalAddress VARCHAR(255),
      ports JSON,
      cloudProvider VARCHAR(63),
      cloudRegion VARCHAR(63),
      cloudZone VARCHAR(63),
      labels JSON,
      appVersion VARCHAR(63),
      sdkVersion VARCHAR(63),
      eventType VARCHAR(31) NOT NULL,
      instanceStatus VARCHAR(31) NOT NULL,
      uptimeSeconds INT UNSIGNED DEFAULT 0,
      heartbeatCount INT UNSIGNED DEFAULT 0,
      lastHeartbeatAt TIMESTAMP NULL,
      errorMessage TEXT,
      errorStack LONGTEXT,
      metadata JSON,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_environment_id (environmentId),
      INDEX idx_instanceId (instanceId),
      INDEX idx_createdAt (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Monitoring alerts
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_monitoring_alerts (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      alertName VARCHAR(255) NOT NULL,
      alertSeverity VARCHAR(32) NOT NULL,
      alertStatus VARCHAR(32) NOT NULL,
      alertMessage TEXT NULL,
      alertLabels JSON NULL,
      alertAnnotations JSON NULL,
      startsAt DATETIME NULL,
      endsAt DATETIME NULL,
      generatorUrl TEXT NULL,
      fingerprint VARCHAR(128) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_severity (alertSeverity),
      INDEX idx_status (alertStatus)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Service maintenance
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_service_maintenance (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      serviceType VARCHAR(50) NOT NULL UNIQUE,
      isInMaintenance BOOLEAN NOT NULL DEFAULT FALSE,
      maintenanceStartDate DATETIME NULL,
      maintenanceEndDate DATETIME NULL,
      maintenanceMessage TEXT NULL,
      supportsMultiLanguage BOOLEAN NOT NULL DEFAULT FALSE,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_service_type (serviceType)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Service maintenance locales
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_service_maintenance_locales (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      serviceMaintenanceId CHAR(26) NOT NULL,
      lang ENUM('ko', 'en', 'zh') NOT NULL,
      message TEXT NOT NULL,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (serviceMaintenanceId) REFERENCES g_service_maintenance(id) ON DELETE CASCADE,
      UNIQUE KEY unique_service_lang (serviceMaintenanceId, lang)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Game world maintenance locales
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_game_world_maintenance_locales (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      gameWorldId CHAR(26) NOT NULL,
      lang ENUM('ko', 'en', 'zh') NOT NULL,
      message TEXT NOT NULL,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (gameWorldId) REFERENCES g_game_worlds(id) ON DELETE CASCADE,
      UNIQUE KEY unique_gw_lang (gameWorldId, lang)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Client version maintenance locales
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_client_version_maintenance_locales (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      clientVersionId CHAR(26) NOT NULL,
      lang ENUM('ko', 'en', 'zh') NOT NULL,
      message TEXT NOT NULL,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (clientVersionId) REFERENCES g_client_versions(id) ON DELETE CASCADE,
      UNIQUE KEY unique_cv_lang (clientVersionId, lang)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Crashes
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_crashes (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      chash VARCHAR(32) NOT NULL,
      branch VARCHAR(50) NOT NULL,
      environmentId CHAR(26) NOT NULL,
      platform VARCHAR(50) NOT NULL,
      marketType VARCHAR(50) NULL,
      isEditor BOOLEAN DEFAULT FALSE,
      firstLine VARCHAR(200) NULL,
      stackFilePath VARCHAR(500) NULL,
      crashesCount INT UNSIGNED DEFAULT 1,
      firstCrashEventId CHAR(26) NULL,
      lastCrashEventId CHAR(26) NULL,
      firstCrashAt TIMESTAMP NOT NULL,
      lastCrashAt TIMESTAMP NOT NULL,
      crashesState TINYINT UNSIGNED DEFAULT 0,
      assignee VARCHAR(100) NULL,
      jiraTicket VARCHAR(200) NULL,
      maxAppVersion VARCHAR(50) NULL,
      maxResVersion VARCHAR(50) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_chash_branch (chash, branch),
      INDEX idx_environment_id (environmentId),
      INDEX idx_state (crashesState)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Crash events
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_crash_events (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      crashId CHAR(26) NOT NULL,
      platform VARCHAR(50) NOT NULL,
      marketType VARCHAR(50) NULL,
      branch VARCHAR(50) NOT NULL,
      environmentId CHAR(26) NOT NULL,
      isEditor BOOLEAN DEFAULT FALSE,
      appVersion VARCHAR(50) NULL,
      resVersion VARCHAR(50) NULL,
      accountId VARCHAR(100) NULL,
      characterId VARCHAR(100) NULL,
      gameUserId VARCHAR(100) NULL,
      userName VARCHAR(100) NULL,
      gameServerId VARCHAR(100) NULL,
      userMessage VARCHAR(255) NULL,
      logFilePath VARCHAR(500) NULL,
      crashEventIp VARCHAR(45) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_crashId (crashId),
      FOREIGN KEY (crashId) REFERENCES g_crashes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Crash retention settings
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_crash_retention_settings (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      crashEventsRetentionDays INT DEFAULT 90,
      crashesRetentionDays INT DEFAULT 365,
      stackFilesRetentionDays INT DEFAULT 365,
      logFilesRetentionDays INT DEFAULT 30,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      updatedBy CHAR(26) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Planning data uploads
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_planning_data_uploads (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      fileName VARCHAR(255) NOT NULL,
      fileSize BIGINT NOT NULL,
      status ENUM('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
      uploadedBy CHAR(26) NULL,
      metadata JSON NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_environment_id (environmentId),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Network traffic
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_feature_network_traffic (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      direction ENUM('inbound', 'outbound') NOT NULL DEFAULT 'inbound',
      protocol VARCHAR(20) NOT NULL DEFAULT 'HTTP',
      method VARCHAR(10) NULL,
      path VARCHAR(500) NULL,
      statusCode INT NULL,
      requestSize BIGINT NOT NULL DEFAULT 0,
      responseSize BIGINT NOT NULL DEFAULT 0,
      durationMs INT NULL,
      sourceIp VARCHAR(45) NULL,
      timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_environment_id (environmentId),
      INDEX idx_timestamp (timestamp)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    // Reward item templates
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_reward_item_templates (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      rewardItems JSON NOT NULL,
      tags JSON NULL,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

    
  // API Access Tokens (SDK/Client/Server tokens with single environment scoping)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_api_access_tokens (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      tokenName VARCHAR(255) NOT NULL,
      description TEXT NULL,
      tokenValue VARCHAR(255) NOT NULL UNIQUE,
      tokenType ENUM('client', 'server', 'edge', 'all') NOT NULL DEFAULT 'server',
      environmentId CHAR(26) NULL COMMENT 'Single environment FK - token determines env scope',
      projectId CHAR(26) NULL COMMENT 'Project scope',
      expiresAt TIMESTAMP NULL,
      lastUsedAt TIMESTAMP NULL,
      usageCount BIGINT DEFAULT 0,
      createdBy CHAR(26) NOT NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_api_token_env FOREIGN KEY (environmentId) REFERENCES g_environments(id) ON DELETE SET NULL,
      CONSTRAINT fk_api_token_project FOREIGN KEY (projectId) REFERENCES g_projects(id) ON DELETE SET NULL,
      CONSTRAINT fk_api_token_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id),
      CONSTRAINT fk_api_token_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id),
      INDEX idx_token_type (tokenType),
      INDEX idx_environment_id (environmentId),
      INDEX idx_project_id (projectId),
      INDEX idx_created_by (createdBy),
      INDEX idx_created_at (createdAt),
      INDEX idx_last_used_at (lastUsedAt),
      INDEX idx_expires_at (expiresAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[002] ??Application tables completed');
};

exports.down = async function (connection) {
    const tables = [
    'g_api_access_tokens',
        'g_reward_item_templates', 'g_feature_network_traffic', 'g_planning_data_uploads',
        'g_crash_retention_settings', 'g_crash_events', 'g_crashes',
        'g_client_version_maintenance_locales', 'g_game_world_maintenance_locales',
        'g_service_maintenance_locales', 'g_service_maintenance',
        'g_monitoring_alerts', 'g_server_lifecycle_events', 'g_banners',
        'g_store_products', 'g_reward_items', 'g_reward_templates',
        'g_coupon_batch_jobs', 'g_coupon_logs', 'g_coupon_uses', 'g_coupons',
        'g_coupon_target_users', 'g_coupon_target_subchannels', 'g_coupon_target_channels',
        'g_coupon_target_platforms', 'g_coupon_target_worlds', 'g_coupon_settings',
        'g_surveys', 'g_ingame_popup_notices', 'g_service_notices',
        'g_job_executions', 'g_jobs', 'g_job_types',
        'g_message_template_locales', 'g_message_templates',
        'g_vars', 'g_ip_whitelist', 'g_account_whitelist',
        'g_client_versions', 'g_game_worlds',
        'g_tag_assignments', 'g_tags',
    ];
    for (const t of tables) {
        await connection.execute(`DROP TABLE IF EXISTS ${t}`);
    }
};
