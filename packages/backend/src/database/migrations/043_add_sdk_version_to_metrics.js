/**
 * Migration: Add sdkVersion column to feature metrics tables
 */

exports.up = async function (connection) {
    console.log('Adding sdkVersion column to feature metrics tables...');

    // 1. g_feature_metrics
    const [metricsColumns] = await connection.execute(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'g_feature_metrics' 
    AND COLUMN_NAME = 'sdkVersion'
  `);

    if (metricsColumns.length === 0) {
        await connection.execute(`
      ALTER TABLE g_feature_metrics 
      ADD COLUMN sdkVersion VARCHAR(50) NULL COMMENT 'SDK version' AFTER appName
    `);

        // Update unique key
        try {
            await connection.execute(`ALTER TABLE g_feature_metrics DROP INDEX unique_env_app_flag_bucket`);
        } catch (e) {
            console.log('Note: unique_env_app_flag_bucket index may not exist');
        }

        await connection.execute(`
      ALTER TABLE g_feature_metrics 
      ADD UNIQUE KEY unique_env_app_sdk_flag_bucket (environment, appName, sdkVersion, flagName, metricsBucket)
    `);
        console.log('✓ sdkVersion added to g_feature_metrics');
    }

    // 2. g_feature_variant_metrics
    const [variantColumns] = await connection.execute(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'g_feature_variant_metrics' 
    AND COLUMN_NAME = 'sdkVersion'
  `);

    if (variantColumns.length === 0) {
        await connection.execute(`
      ALTER TABLE g_feature_variant_metrics 
      ADD COLUMN sdkVersion VARCHAR(50) NULL COMMENT 'SDK version' AFTER appName
    `);

        // Update unique key
        try {
            await connection.execute(`ALTER TABLE g_feature_variant_metrics DROP INDEX unique_env_app_flag_bucket_variant`);
        } catch (e) {
            console.log('Note: unique_env_app_flag_bucket_variant index may not exist');
        }

        await connection.execute(`
      ALTER TABLE g_feature_variant_metrics 
      ADD UNIQUE KEY unique_env_app_sdk_flag_bucket_variant (environment, appName, sdkVersion, flagName, metricsBucket, variantName)
    `);
        console.log('✓ sdkVersion added to g_feature_variant_metrics');
    }
};

exports.down = async function (connection) {
    // Rollback logic
    try {
        await connection.execute(`ALTER TABLE g_feature_metrics DROP INDEX unique_env_app_sdk_flag_bucket`);
        await connection.execute(`ALTER TABLE g_feature_metrics ADD UNIQUE KEY unique_env_app_flag_bucket (environment, appName, flagName, metricsBucket)`);
        await connection.execute(`ALTER TABLE g_feature_metrics DROP COLUMN sdkVersion`);
    } catch (e) { console.error('Error rolling back metrics:', e); }

    try {
        await connection.execute(`ALTER TABLE g_feature_variant_metrics DROP INDEX unique_env_app_sdk_flag_bucket_variant`);
        await connection.execute(`ALTER TABLE g_feature_variant_metrics ADD UNIQUE KEY unique_env_app_flag_bucket_variant (environment, appName, flagName, metricsBucket, variantName)`);
        await connection.execute(`ALTER TABLE g_feature_variant_metrics DROP COLUMN sdkVersion`);
    } catch (e) { console.error('Error rolling back variant metrics:', e); }
};
