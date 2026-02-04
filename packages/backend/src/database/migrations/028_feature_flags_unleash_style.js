/**
 * Migration 028: Finalize Unleash-style schema
 *
 * This migration removes the 'environment' column from g_feature_segments
 * to make segments global (shared across all environments).
 *
 * Previous steps (manually applied):
 * - g_feature_flags: Already converted to global (no environment column)
 * - g_feature_flag_environments: Already exists (per-env settings)
 * - g_feature_strategies: Already has environment column
 * - g_feature_variants: Already has environment column
 *
 * Remaining work:
 * - g_feature_segments: Remove environment column, make segmentName unique globally
 */

exports.up = async function (connection) {
  console.log('Finalizing Unleash-style schema - making segments global...');

  // Check if environment column still exists on g_feature_segments
  const [cols] = await connection.execute(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_feature_segments' AND COLUMN_NAME = 'environment'"
  );

  if (cols.length === 0) {
    console.log('Segments already global (no environment column). Nothing to do.');
    return;
  }

  // Step 1: Check for duplicate segment names across environments
  const [duplicates] = await connection.execute(`
        SELECT segmentName, COUNT(*) as cnt
        FROM g_feature_segments
        GROUP BY segmentName
        HAVING COUNT(*) > 1
    `);

  if (duplicates.length > 0) {
    console.log(
      `Found ${duplicates.length} duplicate segment names across environments. Deduplicating...`
    );

    // For each duplicate, keep the first one (by createdAt) and update references
    for (const dup of duplicates) {
      const [instances] = await connection.execute(
        'SELECT id, environment FROM g_feature_segments WHERE segmentName = ? ORDER BY createdAt ASC',
        [dup.segmentName]
      );

      const keepId = instances[0].id;
      const deleteIds = instances.slice(1).map((i) => i.id);

      // Update junction table references
      for (const deleteId of deleteIds) {
        await connection.execute(
          'UPDATE g_feature_flag_segments SET segmentId = ? WHERE segmentId = ?',
          [keepId, deleteId]
        );
      }

      // Delete duplicate segments
      for (const deleteId of deleteIds) {
        await connection.execute('DELETE FROM g_feature_segments WHERE id = ?', [deleteId]);
      }

      console.log(
        `  Deduplicated segment "${dup.segmentName}": kept ${keepId}, removed ${deleteIds.length} duplicates`
      );
    }
  }

  // Step 2: Drop the environment index if exists
  try {
    await connection.execute('ALTER TABLE g_feature_segments DROP INDEX idx_environment');
    console.log('✓ Dropped idx_environment index');
  } catch (e) {
    // Index might not exist
  }

  // Step 3: Remove environment column
  await connection.execute('ALTER TABLE g_feature_segments DROP COLUMN environment');
  console.log('✓ Removed environment column from g_feature_segments');

  // Step 4: Add UNIQUE constraint on segmentName (if not exists)
  try {
    await connection.execute(
      'ALTER TABLE g_feature_segments ADD UNIQUE INDEX idx_segment_name_unique (segmentName)'
    );
    console.log('✓ Added unique constraint on segmentName');
  } catch (e) {
    console.log('  Unique constraint already exists or failed:', e.message);
  }

  console.log('Segments are now global!');
};

exports.down = async function (connection) {
  console.log('Rolling back: Adding environment column back to segments...');

  // Check if environment column already exists
  const [cols] = await connection.execute(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_feature_segments' AND COLUMN_NAME = 'environment'"
  );

  if (cols.length > 0) {
    console.log('Environment column already exists. Nothing to do.');
    return;
  }

  // Add environment column back
  await connection.execute(`
        ALTER TABLE g_feature_segments 
        ADD COLUMN environment VARCHAR(100) NOT NULL DEFAULT 'development' COMMENT 'Environment name' AFTER id
    `);

  // Add index
  await connection.execute(
    'ALTER TABLE g_feature_segments ADD INDEX idx_environment (environment)'
  );

  // Drop unique constraint on segmentName
  try {
    await connection.execute('ALTER TABLE g_feature_segments DROP INDEX idx_segment_name_unique');
  } catch (e) {
    // might not exist
  }

  console.log('Rollback complete');
};
