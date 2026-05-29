/**
 * 006 - Fix missing columns in feature flag tables
 * Columns accidentally omitted when migration 003 was rewritten for RBAC redesign.
 * Brings the schema in line with what existed on main after migrations 021-071.
 *
 * g_feature_flags:
 *   + valueType, enabledValue, disabledValue, validationRules, useFixedWeightVariants
 *   ~ isStale -> stale (rename to match model)
 *
 * g_feature_flag_environments:
 *   + enabledValue, disabledValue, overrideEnabledValue, overrideDisabledValue
 *
 * g_feature_strategies:
 *   + title
 *   ~ createdBy: allow NULL (for system-driven release flow progression)
 *
 * g_feature_context_fields:
 *   + displayName, validationRules
 *   ~ fieldType ENUM expanded (datetime, array, country, countryCode3, languageCode, localeCode, timezone)
 *   - legalValues dropped (migrated into validationRules)
 *
 * g_feature_metrics:
 *   + appName, sdkVersion
 *   ~ unique key updated
 *
 * g_feature_variant_metrics:
 *   + appName, sdkVersion
 *   ~ unique key updated
 *
 * g_feature_network_traffic:
 *   restructured to match code expectations (appName, endpoint, trafficBucket, requestCount)
 */

exports.up = async function (connection) {
  console.log('[006] Adding missing columns to feature flag tables...');

  // Helper: check if column exists
  async function hasColumn(table, column) {
    const [cols] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    return cols.length > 0;
  }

  // ?€?€ g_feature_flags ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
  if (!(await hasColumn('g_feature_flags', 'valueType'))) {
    await connection.execute(`
            ALTER TABLE g_feature_flags
              ADD COLUMN valueType ENUM('boolean','string','number','json') NOT NULL DEFAULT 'boolean' AFTER tags,
              ADD COLUMN enabledValue TEXT NULL AFTER valueType,
              ADD COLUMN disabledValue TEXT NULL AFTER enabledValue,
              ADD COLUMN validationRules JSON NULL AFTER disabledValue,
              ADD COLUMN useFixedWeightVariants BOOLEAN NOT NULL DEFAULT FALSE AFTER validationRules
        `);
    console.log('  ??g_feature_flags: added valueType, enabledValue, disabledValue, validationRules, useFixedWeightVariants');
  }

  // Rename isStale -> stale to match model code
  if (await hasColumn('g_feature_flags', 'isStale')) {
    await connection.execute(`ALTER TABLE g_feature_flags CHANGE isStale stale BOOLEAN NOT NULL DEFAULT FALSE`);
    console.log('  ??g_feature_flags: renamed isStale -> stale');
  }

  // ?€?€ g_feature_flag_environments ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
  if (!(await hasColumn('g_feature_flag_environments', 'enabledValue'))) {
    await connection.execute(`
            ALTER TABLE g_feature_flag_environments
              ADD COLUMN enabledValue TEXT NULL AFTER isEnabled,
              ADD COLUMN disabledValue TEXT NULL AFTER enabledValue,
              ADD COLUMN overrideEnabledValue BOOLEAN NOT NULL DEFAULT FALSE AFTER disabledValue,
              ADD COLUMN overrideDisabledValue BOOLEAN NOT NULL DEFAULT FALSE AFTER overrideEnabledValue
        `);
    console.log('  ??g_feature_flag_environments: added enabledValue, disabledValue, overrideEnabledValue, overrideDisabledValue');
  }

  // ?€?€ g_feature_strategies ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
  if (!(await hasColumn('g_feature_strategies', 'title'))) {
    await connection.execute(`
            ALTER TABLE g_feature_strategies
              ADD COLUMN title VARCHAR(500) NULL AFTER strategyName
        `);
    console.log('  ??g_feature_strategies: added title');
  }

  // Allow NULL for createdBy (needed for system-driven release flow progression)
  try {
    await connection.execute(`ALTER TABLE g_feature_strategies DROP FOREIGN KEY fk_fs_created_by`);
  } catch (e) {
    // constraint might have a different name or not exist
  }
  try {
    await connection.execute(`
            ALTER TABLE g_feature_strategies
              MODIFY COLUMN createdBy CHAR(26) NULL
        `);
    console.log('  ??g_feature_strategies: createdBy now nullable');
  } catch (e) {
    console.log('  - g_feature_strategies: createdBy modify skipped:', e.message);
  }

  // ?€?€ g_feature_context_fields ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
  if (!(await hasColumn('g_feature_context_fields', 'displayName'))) {
    await connection.execute(`
            ALTER TABLE g_feature_context_fields
              ADD COLUMN displayName VARCHAR(500) NULL AFTER fieldName
        `);
    console.log('  ??g_feature_context_fields: added displayName');
  }

  // Expand fieldType ENUM
  await connection.execute(`
        ALTER TABLE g_feature_context_fields
          MODIFY COLUMN fieldType ENUM('string','number','boolean','date','semver','datetime','array','country','countryCode3','languageCode','localeCode','timezone') NOT NULL
    `);
  console.log('  ??g_feature_context_fields: expanded fieldType ENUM');

  // Add validationRules
  if (!(await hasColumn('g_feature_context_fields', 'validationRules'))) {
    await connection.execute(`
            ALTER TABLE g_feature_context_fields
              ADD COLUMN validationRules JSON NULL AFTER description
        `);
    console.log('  ??g_feature_context_fields: added validationRules');
  }

  // Migrate legalValues into validationRules then drop legalValues
  if (await hasColumn('g_feature_context_fields', 'legalValues')) {
    const [rows] = await connection.execute(
      `SELECT id, legalValues FROM g_feature_context_fields WHERE legalValues IS NOT NULL AND legalValues != '[]' AND legalValues != 'null'`
    );
    for (const row of rows) {
      try {
        const legalValues = typeof row.legalValues === 'string' ? JSON.parse(row.legalValues) : row.legalValues;
        if (Array.isArray(legalValues) && legalValues.length > 0) {
          const vr = JSON.stringify({ legalValues });
          await connection.execute(
            `UPDATE g_feature_context_fields SET validationRules = ? WHERE id = ?`,
            [vr, row.id]
          );
        }
      } catch (e) {
        // skip invalid JSON
      }
    }
    await connection.execute(`ALTER TABLE g_feature_context_fields DROP COLUMN legalValues`);
    console.log('  ??g_feature_context_fields: migrated legalValues -> validationRules, dropped legalValues');
  }

  // ?€?€ g_feature_metrics ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
  if (!(await hasColumn('g_feature_metrics', 'appName'))) {
    await connection.execute(`
            ALTER TABLE g_feature_metrics
              ADD COLUMN appName VARCHAR(100) NULL COMMENT 'Application name' AFTER environmentId
        `);

    // Update unique key
    try { await connection.execute(`ALTER TABLE g_feature_metrics DROP INDEX unique_env_flag_bucket`); } catch (e) { /* ignore */ }

    console.log('  ??g_feature_metrics: added appName');
  }

  if (!(await hasColumn('g_feature_metrics', 'sdkVersion'))) {
    await connection.execute(`
            ALTER TABLE g_feature_metrics
              ADD COLUMN sdkVersion VARCHAR(50) NULL COMMENT 'SDK version' AFTER appName
        `);

    // Update unique key (drop old one, add new with sdkVersion)
    try { await connection.execute(`ALTER TABLE g_feature_metrics DROP INDEX unique_env_app_flag_bucket`); } catch (e) { /* ignore */ }
    await connection.execute(`
            ALTER TABLE g_feature_metrics
              ADD UNIQUE KEY unique_env_app_sdk_flag_bucket (environmentId, appName, sdkVersion, flagName, metricsBucket)
        `);
    console.log('  ??g_feature_metrics: added sdkVersion, updated unique key');
  }

  // ?€?€ g_feature_variant_metrics ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
  if (!(await hasColumn('g_feature_variant_metrics', 'appName'))) {
    await connection.execute(`
            ALTER TABLE g_feature_variant_metrics
              ADD COLUMN appName VARCHAR(100) NULL COMMENT 'Application name' AFTER environmentId
        `);

    try { await connection.execute(`ALTER TABLE g_feature_variant_metrics DROP INDEX unique_env_flag_bucket_variant`); } catch (e) { /* ignore */ }

    console.log('  ??g_feature_variant_metrics: added appName');
  }

  if (!(await hasColumn('g_feature_variant_metrics', 'sdkVersion'))) {
    await connection.execute(`
            ALTER TABLE g_feature_variant_metrics
              ADD COLUMN sdkVersion VARCHAR(50) NULL COMMENT 'SDK version' AFTER appName
        `);

    try { await connection.execute(`ALTER TABLE g_feature_variant_metrics DROP INDEX unique_env_app_flag_bucket_variant`); } catch (e) { /* ignore */ }
    await connection.execute(`
            ALTER TABLE g_feature_variant_metrics
              ADD UNIQUE KEY unique_env_app_sdk_flag_bucket_variant (environmentId, appName, sdkVersion, flagName, metricsBucket, variantName)
        `);
    console.log('  ??g_feature_variant_metrics: added sdkVersion, updated unique key');
  }

  // ?€?€ g_feature_network_traffic ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
  // The 002 migration created this table with a completely different schema
  // (direction, protocol, method, path, statusCode, etc.)
  // The code expects: appName, endpoint, trafficBucket, requestCount
  // Rebuild the table to match the code expectations
  if (!(await hasColumn('g_feature_network_traffic', 'appName'))) {
    // Drop and recreate with the correct schema
    await connection.execute(`DROP TABLE IF EXISTS g_feature_network_traffic`);
    await connection.execute(`
            CREATE TABLE g_feature_network_traffic (
              id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
              environmentId CHAR(26) NOT NULL,
              appName VARCHAR(255) NOT NULL DEFAULT 'unknown',
              endpoint ENUM('features', 'segments') NOT NULL,
              trafficBucket DATETIME NOT NULL COMMENT '1-hour bucket',
              requestCount INT UNSIGNED NOT NULL DEFAULT 1,
              createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY uk_traffic (environmentId, appName, endpoint, trafficBucket),
              INDEX idx_bucket (trafficBucket),
              INDEX idx_env_bucket (environmentId, trafficBucket)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    console.log('  ??g_feature_network_traffic: rebuilt with correct schema');
  }

  console.log('[006] ??All missing columns added successfully');
};

exports.down = async function (connection) {
  // Helper: check if column exists
  async function hasColumn(table, column) {
    const [cols] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    return cols.length > 0;
  }

  // g_feature_flags
  await connection.execute(`
        ALTER TABLE g_feature_flags
          DROP COLUMN IF EXISTS valueType,
          DROP COLUMN IF EXISTS enabledValue,
          DROP COLUMN IF EXISTS disabledValue,
          DROP COLUMN IF EXISTS validationRules,
          DROP COLUMN IF EXISTS useFixedWeightVariants
    `);
  if (await hasColumn('g_feature_flags', 'stale')) {
    await connection.execute(`ALTER TABLE g_feature_flags CHANGE stale isStale BOOLEAN NOT NULL DEFAULT FALSE`);
  }

  // g_feature_flag_environments
  await connection.execute(`
        ALTER TABLE g_feature_flag_environments
          DROP COLUMN IF EXISTS enabledValue,
          DROP COLUMN IF EXISTS disabledValue,
          DROP COLUMN IF EXISTS overrideEnabledValue,
          DROP COLUMN IF EXISTS overrideDisabledValue
    `);

  // g_feature_strategies
  await connection.execute(`ALTER TABLE g_feature_strategies DROP COLUMN IF EXISTS title`);
  try {
    await connection.execute(`ALTER TABLE g_feature_strategies MODIFY COLUMN createdBy CHAR(26) NOT NULL`);
  } catch (e) { /* might fail if null data exists */ }

  // g_feature_context_fields
  await connection.execute(`ALTER TABLE g_feature_context_fields DROP COLUMN IF EXISTS displayName`);
  await connection.execute(`ALTER TABLE g_feature_context_fields DROP COLUMN IF EXISTS validationRules`);
  try {
    await connection.execute(`
            ALTER TABLE g_feature_context_fields
              ADD COLUMN legalValues JSON NULL AFTER description
        `);
  } catch (e) { /* ignore */ }
  try {
    await connection.execute(`
            ALTER TABLE g_feature_context_fields
              MODIFY COLUMN fieldType ENUM('string','number','boolean','date','semver','datetime') NOT NULL
        `);
  } catch (e) { /* ignore */ }

  // g_feature_metrics
  await connection.execute(`ALTER TABLE g_feature_metrics DROP COLUMN IF EXISTS sdkVersion`);
  await connection.execute(`ALTER TABLE g_feature_metrics DROP COLUMN IF EXISTS appName`);

  // g_feature_variant_metrics
  await connection.execute(`ALTER TABLE g_feature_variant_metrics DROP COLUMN IF EXISTS sdkVersion`);
  await connection.execute(`ALTER TABLE g_feature_variant_metrics DROP COLUMN IF EXISTS appName`);
};
