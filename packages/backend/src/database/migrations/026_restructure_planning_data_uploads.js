// Migration: Restructure g_planning_data_uploads table to match PlanningDataService usage
// The original schema had: id, environmentId, fileName, fileSize, status, uploadedBy, metadata, createdAt, updatedAt
// The service now uses: uploadHash, filesUploaded, fileHashes, filesCount, totalSize, uploaderName, uploadSource, uploadComment, changedFiles, fileDiffs, uploadedAt
exports.name = '026_restructure_planning_data_uploads';

exports.up = async function (connection) {
  // Drop old columns that are no longer used
  const [columns] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_planning_data_uploads'`
  );
  const existingColumns = columns.map(c => c.COLUMN_NAME);

  // Remove old columns if they exist
  const oldColumns = ['fileName', 'fileSize', 'status', 'metadata'];
  for (const col of oldColumns) {
    if (existingColumns.includes(col)) {
      await connection.execute(`ALTER TABLE g_planning_data_uploads DROP COLUMN \`${col}\``);
    }
  }

  // Drop old index if exists
  const [indexes] = await connection.query(
    `SHOW INDEX FROM g_planning_data_uploads WHERE Key_name = 'idx_status'`
  );
  if (indexes.length > 0) {
    await connection.execute(`ALTER TABLE g_planning_data_uploads DROP INDEX idx_status`);
  }

  // Add new columns
  const newColumns = {
    uploadHash: "VARCHAR(64) NOT NULL DEFAULT ''",
    filesUploaded: 'JSON NULL',
    fileHashes: 'JSON NULL',
    filesCount: 'INT NOT NULL DEFAULT 0',
    totalSize: 'BIGINT NOT NULL DEFAULT 0',
    uploaderName: 'VARCHAR(255) NULL',
    uploadSource: "VARCHAR(50) NOT NULL DEFAULT 'web'",
    uploadComment: 'TEXT NULL',
    changedFiles: 'JSON NULL',
    fileDiffs: 'JSON NULL',
    uploadedAt: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
  };

  for (const [col, definition] of Object.entries(newColumns)) {
    if (!existingColumns.includes(col)) {
      await connection.execute(
        `ALTER TABLE g_planning_data_uploads ADD COLUMN \`${col}\` ${definition}`
      );
    }
  }

  // Modify uploadedBy to allow longer values (was CHAR(26), now VARCHAR(255))
  if (existingColumns.includes('uploadedBy')) {
    await connection.execute(
      `ALTER TABLE g_planning_data_uploads MODIFY COLUMN uploadedBy VARCHAR(255) NULL`
    );
  }

  // Add index on uploadedAt
  const [uploadedAtIdx] = await connection.query(
    `SHOW INDEX FROM g_planning_data_uploads WHERE Key_name = 'idx_uploaded_at'`
  );
  if (uploadedAtIdx.length === 0) {
    await connection.execute(
      `ALTER TABLE g_planning_data_uploads ADD INDEX idx_uploaded_at (uploadedAt)`
    );
  }

  console.log('[026] ??g_planning_data_uploads restructured');
};

exports.down = async function (connection) {
  // Reverse: drop new columns, re-add old columns
  const newColumns = [
    'uploadHash', 'filesUploaded', 'fileHashes', 'filesCount', 'totalSize',
    'uploaderName', 'uploadSource', 'uploadComment', 'changedFiles', 'fileDiffs', 'uploadedAt'
  ];

  for (const col of newColumns) {
    try {
      await connection.execute(`ALTER TABLE g_planning_data_uploads DROP COLUMN \`${col}\``);
    } catch (e) {
      // Column may not exist
    }
  }

  // Re-add original columns
  await connection.execute(
    `ALTER TABLE g_planning_data_uploads ADD COLUMN fileName VARCHAR(255) NOT NULL DEFAULT ''`
  );
  await connection.execute(
    `ALTER TABLE g_planning_data_uploads ADD COLUMN fileSize BIGINT NOT NULL DEFAULT 0`
  );
  await connection.execute(
    `ALTER TABLE g_planning_data_uploads ADD COLUMN status ENUM('pending','processing','completed','failed') NOT NULL DEFAULT 'pending'`
  );
  await connection.execute(
    `ALTER TABLE g_planning_data_uploads ADD COLUMN metadata JSON NULL`
  );
  await connection.execute(
    `ALTER TABLE g_planning_data_uploads ADD INDEX idx_status (status)`
  );

  // Revert uploadedBy
  await connection.execute(
    `ALTER TABLE g_planning_data_uploads MODIFY COLUMN uploadedBy CHAR(26) NULL`
  );

  console.log('[026] ??g_planning_data_uploads reverted');
};
