/**
 * Migration: Add feature variant metrics table
 * Separates variant counts from JSON field to a proper relational table
 */

exports.up = async function (connection) {
  console.log('Creating g_feature_variant_metrics table...');

  // Create new table for variant metrics
  await connection.execute(`
        CREATE TABLE IF NOT EXISTS g_feature_variant_metrics (
            id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
            environment VARCHAR(100) NOT NULL COMMENT 'Environment name',
            flagName VARCHAR(255) NOT NULL COMMENT 'Flag identifier',
            metricsBucket DATETIME NOT NULL COMMENT 'Hourly bucket timestamp',
            variantName VARCHAR(100) NOT NULL COMMENT 'Variant name',
            count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Evaluation count',
            createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Created timestamp',
            UNIQUE KEY idx_variant_metrics_unique (environment, flagName, metricsBucket, variantName),
            INDEX idx_variant_metrics_query (environment, flagName, metricsBucket)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Feature flag variant metrics'
    `);
  console.log('✓ g_feature_variant_metrics table created');

  // Remove variantCounts column from g_feature_metrics
  await connection.execute(`
        ALTER TABLE g_feature_metrics DROP COLUMN variantCounts
    `);
  console.log('✓ variantCounts column removed from g_feature_metrics');
};

exports.down = async function (connection) {
  console.log('Rolling back variant metrics table...');

  // Re-add variantCounts column
  await connection.execute(`
        ALTER TABLE g_feature_metrics ADD COLUMN variantCounts JSON NULL COMMENT 'Variant distribution {variantName: count}'
    `);
  console.log('✓ variantCounts column restored');

  // Drop the new table
  await connection.execute('DROP TABLE IF EXISTS g_feature_variant_metrics');
  console.log('✓ g_feature_variant_metrics table dropped');
};
