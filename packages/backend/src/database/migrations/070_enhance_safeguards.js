/**
 * Enhance Safeguards
 * - Add displayName column (optional friendly name)
 * - Add timeRangeMinutes column (replaces string-based timeRange with numeric minutes)
 * - Add labelFilters column (JSON for metric label filtering)
 * - Migrate existing timeRange values to timeRangeMinutes
 * - Drop old timeRange column
 */

exports.up = async function (connection) {
    console.log('Enhancing safeguards table...');

    // 1. Add displayName column
    await connection.execute(`
    ALTER TABLE g_release_flow_safeguards
    ADD COLUMN displayName VARCHAR(255) NULL
    COMMENT 'Optional display name (shown instead of metricName when set)'
    AFTER metricName
  `);
    console.log('✓ Added displayName column');

    // 2. Add timeRangeMinutes column
    await connection.execute(`
    ALTER TABLE g_release_flow_safeguards
    ADD COLUMN timeRangeMinutes INT NOT NULL DEFAULT 60
    COMMENT 'Time range in minutes for metric evaluation'
    AFTER timeRange
  `);
    console.log('✓ Added timeRangeMinutes column');

    // 3. Add labelFilters column (JSON for label-based filtering)
    await connection.execute(`
    ALTER TABLE g_release_flow_safeguards
    ADD COLUMN labelFilters JSON NULL
    COMMENT 'Label filters for metric query (e.g. { "method": "GET", "status": "500" })'
    AFTER timeRangeMinutes
  `);
    console.log('✓ Added labelFilters column');

    // 4. Migrate existing timeRange string values to minutes
    await connection.execute(`
    UPDATE g_release_flow_safeguards
    SET timeRangeMinutes = CASE timeRange
      WHEN 'hour' THEN 60
      WHEN 'day' THEN 1440
      WHEN 'week' THEN 10080
      WHEN 'month' THEN 43200
      ELSE 60
    END
  `);
    console.log('✓ Migrated timeRange values to timeRangeMinutes');

    // 5. Drop old timeRange column
    await connection.execute(`
    ALTER TABLE g_release_flow_safeguards
    DROP COLUMN timeRange
  `);
    console.log('✓ Dropped old timeRange column');

    console.log('Safeguards enhancement completed!');
};

exports.down = async function (connection) {
    console.log('Reverting safeguards enhancement...');

    // Re-add timeRange column
    await connection.execute(`
    ALTER TABLE g_release_flow_safeguards
    ADD COLUMN timeRange VARCHAR(50) NOT NULL DEFAULT 'hour'
    COMMENT 'hour, day, week, month'
    AFTER threshold
  `);

    // Migrate back from minutes to string
    await connection.execute(`
    UPDATE g_release_flow_safeguards
    SET timeRange = CASE
      WHEN timeRangeMinutes <= 60 THEN 'hour'
      WHEN timeRangeMinutes <= 1440 THEN 'day'
      WHEN timeRangeMinutes <= 10080 THEN 'week'
      ELSE 'month'
    END
  `);

    // Drop new columns
    await connection.execute(`
    ALTER TABLE g_release_flow_safeguards
    DROP COLUMN IF EXISTS labelFilters,
    DROP COLUMN IF EXISTS timeRangeMinutes,
    DROP COLUMN IF EXISTS displayName
  `);

    console.log('Safeguards enhancement reverted!');
};
