module.exports.up = async function (connection) {
  console.log('[073] Adding is_favorite column to g_argus_saved_queries table...');
  try {
    await connection.execute(`
      ALTER TABLE g_argus_saved_queries
      ADD COLUMN is_favorite TINYINT(1) NOT NULL DEFAULT 0
    `);
    console.log('[073] ✓ Added is_favorite column');
  } catch (err) {
    // Ignore if column already exists
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('[073] is_favorite column already exists.');
    } else {
      throw err;
    }
  }
};

module.exports.down = async function (connection) {
  console.log('[073] Removing is_favorite column from g_argus_saved_queries table...');
  await connection.execute(`
    ALTER TABLE g_argus_saved_queries
    DROP COLUMN is_favorite
  `);
};
