/**
 * Migration: Add planningDataUploads table
 * Tracks planning data upload history with hash, uploader info, and timestamps
 */

exports.up = async function (connection) {
  console.log('Creating planningDataUploads table...');

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS planningDataUploads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      environment VARCHAR(100) NOT NULL,
      uploadHash VARCHAR(64) NOT NULL COMMENT 'SHA-256 hash of all content',
      filesUploaded JSON NOT NULL COMMENT 'Array of file names',
      fileHashes JSON NOT NULL COMMENT 'Per-file hashes for diff tracking',
      filesCount INT NOT NULL,
      totalSize BIGINT NOT NULL,
      uploadedBy INT NULL,
      uploaderName VARCHAR(255) NULL COMMENT 'Display name or token name',
      uploadSource VARCHAR(50) NOT NULL DEFAULT 'web' COMMENT 'web or cli',
      uploadComment TEXT NULL COMMENT 'Optional comment from uploader',
      changedFiles JSON NULL COMMENT 'Files that changed compared to previous upload',
      fileDiffs JSON NULL COMMENT 'Detailed diff for each changed file',
      uploadedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_environment (environment),
      INDEX idx_environment_uploaded_at (environment, uploadedAt),
      CONSTRAINT fk_planning_uploads_user FOREIGN KEY (uploadedBy) REFERENCES g_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('✓ planningDataUploads table created');
};

exports.down = async function (connection) {
  console.log('Dropping planningDataUploads table...');
  await connection.execute('DROP TABLE IF EXISTS planningDataUploads');
  console.log('✓ planningDataUploads table dropped');
};
