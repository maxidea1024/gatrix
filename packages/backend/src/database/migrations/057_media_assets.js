// Migration: Create g_media_assets table for uploaded image reference management
exports.name = '057_media_assets';

exports.up = async function (connection) {
  const [tables] = await connection.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_media_assets'`
  );
  if (tables.length > 0) {
    console.log('[057] g_media_assets table already exists, skipping');
    return;
  }

  await connection.execute(`
    CREATE TABLE g_media_assets (
      id          VARCHAR(26) NOT NULL PRIMARY KEY,
      hash        VARCHAR(64) NOT NULL         COMMENT 'SHA-256 hex digest of file content',
      storageKey  VARCHAR(512) NOT NULL         COMMENT 'S3 object key (e.g. media/banners/01J....jpg)',
      cdnUrl      VARCHAR(1024) NOT NULL        COMMENT 'Full CDN URL for serving',
      fileName    VARCHAR(255) NOT NULL         COMMENT 'Original uploaded filename',
      contentType VARCHAR(100) NOT NULL         COMMENT 'Detected MIME type (via magic bytes)',
      size        INT UNSIGNED NOT NULL         COMMENT 'File size in bytes',
      width       INT UNSIGNED DEFAULT NULL     COMMENT 'Image width in pixels',
      height      INT UNSIGNED DEFAULT NULL     COMMENT 'Image height in pixels',
      refCount    INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Number of banner frames referencing this asset',
      gcEligibleAt DATETIME DEFAULT NULL        COMMENT 'When this asset becomes eligible for GC (set when refCount drops to 0)',
      uploadedBy  VARCHAR(255) DEFAULT NULL     COMMENT 'User who uploaded this asset',
      createdAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      UNIQUE KEY idx_hash (hash),
      KEY idx_ref_count (refCount),
      KEY idx_gc_eligible (gcEligibleAt),
      KEY idx_storage_key (storageKey(191))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[057] g_media_assets table created');
};

exports.down = async function (connection) {
  const [tables] = await connection.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_media_assets'`
  );
  if (tables.length > 0) {
    await connection.execute(`DROP TABLE g_media_assets`);
  }
  console.log('[057] g_media_assets table dropped');
};
