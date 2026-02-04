/**
 * Migration: Add appName column to feature metrics tables
 *
 * This adds application name tracking to feature flag metrics,
 * allowing filtering by application in the metrics UI.
 */

exports.up = async function (connection) {
  console.log('Adding appName column to feature metrics tables...');

  // Check if appName column already exists in g_feature_metrics
  const [metricsColumns] = await connection.execute(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'g_feature_metrics' 
    AND COLUMN_NAME = 'appName'
  `);

  if (metricsColumns.length === 0) {
    // Add appName column to g_feature_metrics table
    await connection.execute(`
      ALTER TABLE g_feature_metrics 
      ADD COLUMN appName VARCHAR(100) NULL COMMENT 'Application name' AFTER environment
    `);
    console.log('✓ appName column added to g_feature_metrics');

    // Add index
    await connection.execute(`
      ALTER TABLE g_feature_metrics ADD INDEX idx_app_name (appName)
    `);
    console.log('✓ appName index added to g_feature_metrics');

    // Update unique key to include appName
    try {
      await connection.execute(`
        ALTER TABLE g_feature_metrics DROP INDEX unique_env_flag_bucket
      `);
    } catch (e) {
      console.log('Note: unique_env_flag_bucket index may not exist, continuing...');
    }
    await connection.execute(`
      ALTER TABLE g_feature_metrics 
      ADD UNIQUE KEY unique_env_app_flag_bucket (environment, appName, flagName, metricsBucket)
    `);
    console.log('✓ Updated unique key to include appName');
  } else {
    console.log('✓ appName column already exists in g_feature_metrics');
  }

  // Check if appName column already exists in g_feature_variant_metrics
  const [variantColumns] = await connection.execute(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'g_feature_variant_metrics' 
    AND COLUMN_NAME = 'appName'
  `);

  if (variantColumns.length === 0) {
    // Add appName column to g_feature_variant_metrics table
    await connection.execute(`
      ALTER TABLE g_feature_variant_metrics 
      ADD COLUMN appName VARCHAR(100) NULL COMMENT 'Application name' AFTER environment
    `);
    console.log('✓ appName column added to g_feature_variant_metrics');

    // Add index
    await connection.execute(`
      ALTER TABLE g_feature_variant_metrics ADD INDEX idx_app_name (appName)
    `);
    console.log('✓ appName index added to g_feature_variant_metrics');

    // Update unique key in variant metrics to include appName
    try {
      await connection.execute(`
        ALTER TABLE g_feature_variant_metrics DROP INDEX unique_env_flag_bucket_variant
      `);
    } catch (e) {
      console.log('Note: unique_env_flag_bucket_variant index may not exist, continuing...');
    }
    await connection.execute(`
      ALTER TABLE g_feature_variant_metrics 
      ADD UNIQUE KEY unique_env_app_flag_bucket_variant (environment, appName, flagName, metricsBucket, variantName)
    `);
    console.log('✓ Updated unique key in g_feature_variant_metrics to include appName');
  } else {
    console.log('✓ appName column already exists in g_feature_variant_metrics');
  }

  console.log('🎉 Migration completed: appName support added to feature metrics');
};

exports.down = async function (connection) {
  console.log('Removing appName column from feature metrics tables...');

  // Restore original unique key in g_feature_metrics
  try {
    await connection.execute(`
      ALTER TABLE g_feature_metrics DROP INDEX unique_env_app_flag_bucket
    `);
  } catch (e) {
    // Ignore if index doesn't exist
  }
  await connection.execute(`
    ALTER TABLE g_feature_metrics 
    ADD UNIQUE KEY unique_env_flag_bucket (environment, flagName, metricsBucket)
  `);

  // Drop appName column and index from g_feature_metrics
  try {
    await connection.execute(`
      ALTER TABLE g_feature_metrics DROP INDEX idx_app_name
    `);
  } catch (e) {
    // Ignore if index doesn't exist
  }
  await connection.execute(`
    ALTER TABLE g_feature_metrics DROP COLUMN appName
  `);
  console.log('✓ appName column removed from g_feature_metrics');

  // Restore original unique key in g_feature_variant_metrics
  try {
    await connection.execute(`
      ALTER TABLE g_feature_variant_metrics DROP INDEX unique_env_app_flag_bucket_variant
    `);
  } catch (e) {
    // Ignore if index doesn't exist
  }
  await connection.execute(`
    ALTER TABLE g_feature_variant_metrics 
    ADD UNIQUE KEY unique_env_flag_bucket_variant (environment, flagName, metricsBucket, variantName)
  `);

  // Drop appName column and index from g_feature_variant_metrics
  try {
    await connection.execute(`
      ALTER TABLE g_feature_variant_metrics DROP INDEX idx_app_name
    `);
  } catch (e) {
    // Ignore if index doesn't exist
  }
  await connection.execute(`
    ALTER TABLE g_feature_variant_metrics DROP COLUMN appName
  `);
  console.log('✓ appName column removed from g_feature_variant_metrics');

  console.log('✓ Rollback completed');
};
