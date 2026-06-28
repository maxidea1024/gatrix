exports.up = async function (connection) {
  console.log('[080] Adding external_url and external_key columns to g_argus_issues...');

  // Check if external_url column already exists
  const [urlCols] = await connection.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_issues' AND COLUMN_NAME = 'external_url'`
  );

  if (urlCols.length === 0) {
    await connection.execute(`
      ALTER TABLE g_argus_issues
      ADD COLUMN external_url VARCHAR(512) DEFAULT NULL AFTER updated_at
    `);
    console.log('[080] ✓ external_url column added');
  } else {
    console.log('[080] ✓ external_url column already exists');
  }

  // Check if external_key column already exists
  const [keyCols] = await connection.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_issues' AND COLUMN_NAME = 'external_key'`
  );

  if (keyCols.length === 0) {
    await connection.execute(`
      ALTER TABLE g_argus_issues
      ADD COLUMN external_key VARCHAR(100) DEFAULT NULL AFTER external_url
    `);
    console.log('[080] ✓ external_key column added');
  } else {
    console.log('[080] ✓ external_key column already exists');
  }
};

exports.down = async function (connection) {
  await connection.execute(`ALTER TABLE g_argus_issues DROP COLUMN IF EXISTS external_key`);
  await connection.execute(`ALTER TABLE g_argus_issues DROP COLUMN IF EXISTS external_url`);
};
