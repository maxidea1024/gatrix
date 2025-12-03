/**
 * Migration: Add unique constraint to banner name
 * - Banner name must be unique (identifier style)
 */

exports.up = async function(connection) {
  console.log('Adding unique constraint to g_banners name column...');

  // Add unique constraint to name column
  await connection.execute(`
    ALTER TABLE g_banners
    ADD CONSTRAINT unique_banner_name UNIQUE (name)
  `);

  console.log('✅ Unique constraint added to g_banners name column');
};

exports.down = async function(connection) {
  console.log('Removing unique constraint from g_banners name column...');

  await connection.execute(`
    ALTER TABLE g_banners
    DROP INDEX unique_banner_name
  `);

  console.log('✅ Unique constraint removed from g_banners name column');
};

