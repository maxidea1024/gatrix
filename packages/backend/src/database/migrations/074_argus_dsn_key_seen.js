exports.up = async function (connection) {
  console.log('[074] Adding first_seen, last_seen to g_argus_dsnKeys...');

  // Check if table exists first
  const [tables] = await connection.execute(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_dsnKeys'`
  );

  if (tables.length === 0) {
    console.log('[074] g_argus_dsnKeys table does not exist, skipping');
    return;
  }

  // Check if first_seen already exists
  const [cols] = await connection.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_dsnKeys' AND COLUMN_NAME = 'first_seen'`
  );

  if (cols.length === 0) {
    await connection.execute(`
      ALTER TABLE g_argus_dsnKeys
        ADD COLUMN first_seen TIMESTAMP NULL DEFAULT NULL,
        ADD COLUMN last_seen TIMESTAMP NULL DEFAULT NULL
    `);
    console.log('[074] ✓ first_seen, last_seen columns added');
  } else {
    console.log('[074] ✓ columns already exist, skipping');
  }
};

exports.down = async function (connection) {
  await connection.execute(`
    ALTER TABLE g_argus_dsnKeys
      DROP COLUMN first_seen,
      DROP COLUMN last_seen
  `);
};
