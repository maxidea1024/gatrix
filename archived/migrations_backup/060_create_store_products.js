/**
 * Create Store Products table
 * Stores in-app purchase products for game stores (Google Play, Apple App Store, etc.)
 */

exports.up = async function(connection) {
  console.log('Creating store products table...');

  // Check if table already exists
  const [tables] = await connection.execute(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_store_products'
  `);

  if (tables.length > 0) {
    console.log('✅ Store products table already exists');
    return;
  }

  // Create store products table
  await connection.execute(`
    CREATE TABLE g_store_products (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      environmentId VARCHAR(50) NOT NULL COMMENT 'Environment ID for multi-env support',
      
      isActive TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Whether the product is available for sale',
      productId VARCHAR(255) NOT NULL COMMENT 'Store product ID (e.g., com.game.gold_pack_100)',
      productName VARCHAR(255) NOT NULL COMMENT 'Display name of the product',
      store VARCHAR(50) NOT NULL COMMENT 'Store type: google, apple, onestore, etc.',
      price DECIMAL(10, 2) NOT NULL COMMENT 'Product price',
      currency VARCHAR(10) NOT NULL DEFAULT 'USD' COMMENT 'Currency code (USD, KRW, etc.)',
      
      saleStartAt DATETIME NULL COMMENT 'Sale start date/time (null = immediately available)',
      saleEndAt DATETIME NULL COMMENT 'Sale end date/time (null = no end date)',
      
      description TEXT NULL COMMENT 'Product description',
      metadata JSON NULL COMMENT 'Additional metadata (rewards, bonuses, etc.)',
      
      createdBy INT NULL COMMENT 'User ID who created this product',
      updatedBy INT NULL COMMENT 'User ID who last updated this product',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Creation timestamp',
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',
      
      INDEX idx_environment_id (environmentId),
      INDEX idx_is_active (isActive),
      INDEX idx_product_id (productId),
      INDEX idx_store (store),
      INDEX idx_created_at (createdAt),
      UNIQUE KEY uk_env_product_store (environmentId, productId, store)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='Store products for in-app purchases'
  `);

  console.log('✅ Store products table created successfully');
};

exports.down = async function(connection) {
  console.log('Dropping store products table...');
  await connection.execute('DROP TABLE IF EXISTS g_store_products');
  console.log('✅ Store products table dropped');
};

module.exports = exports;

