exports.up = async function (connection) {
  console.log('[081] Fixing g_argus_issue_activity column types (INT → VARCHAR for ULID project/issue IDs)...');

  // Check current column type for project_id
  const [projCols] = await connection.execute(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_issue_activity' AND COLUMN_NAME = 'project_id'`
  );

  if (projCols.length > 0 && projCols[0].COLUMN_TYPE === 'int') {
    await connection.execute(`
      ALTER TABLE g_argus_issue_activity
      MODIFY COLUMN project_id VARCHAR(30) NOT NULL
    `);
    console.log('[081] ✓ project_id changed to VARCHAR(30)');
  } else {
    console.log('[081] ✓ project_id already correct');
  }

  // Check current column type for issue_id
  const [issueCols] = await connection.execute(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_argus_issue_activity' AND COLUMN_NAME = 'issue_id'`
  );

  if (issueCols.length > 0 && issueCols[0].COLUMN_TYPE === 'int') {
    await connection.execute(`
      ALTER TABLE g_argus_issue_activity
      MODIFY COLUMN issue_id VARCHAR(30) NOT NULL
    `);
    console.log('[081] ✓ issue_id changed to VARCHAR(30)');
  } else {
    console.log('[081] ✓ issue_id already correct');
  }
};

exports.down = async function (connection) {
  await connection.execute(`
    ALTER TABLE g_argus_issue_activity
    MODIFY COLUMN project_id INT NOT NULL,
    MODIFY COLUMN issue_id INT NOT NULL
  `);
};
