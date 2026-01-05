/**
 * Migration: Add unique constraint to banner name
 * - Banner name must be unique (identifier style)
 * - First fix any duplicate names by appending bannerId suffix
 */

exports.up = async function(connection) {
  console.log('Checking for duplicate banner names...');

  // Find all duplicate names
  const [duplicates] = await connection.execute(`
    SELECT name, COUNT(*) as cnt
    FROM g_banners
    GROUP BY name
    HAVING COUNT(*) > 1
  `);

  if (duplicates.length > 0) {
    console.log(`Found ${duplicates.length} duplicate name(s), fixing...`);

    for (const dup of duplicates) {
      // Get all banners with this duplicate name (except the first one)
      const [banners] = await connection.execute(`
        SELECT bannerId, name FROM g_banners
        WHERE name = ?
        ORDER BY createdAt ASC
      `, [dup.name]);

      // Skip the first one (keep original name), rename the rest
      for (let i = 1; i < banners.length; i++) {
        const newName = `${banners[i].name}_${banners[i].bannerId.substring(0, 8).toLowerCase()}`;
        await connection.execute(`
          UPDATE g_banners SET name = ? WHERE bannerId = ?
        `, [newName, banners[i].bannerId]);
        console.log(`  Renamed duplicate: ${banners[i].name} -> ${newName}`);
      }
    }
  }

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

