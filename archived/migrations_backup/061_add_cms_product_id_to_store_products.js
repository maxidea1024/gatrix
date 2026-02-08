/**
 * Add cmsProductId column to g_store_products table
 * This column links the store product to the CMS CashShop product ID
 */

exports.up = async function (connection) {
  console.log('Adding cmsProductId column to g_store_products...');

  // Check if column already exists
  const [columns] = await connection.execute(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'g_store_products'
    AND COLUMN_NAME = 'cmsProductId'
  `);

  if (columns.length > 0) {
    console.log('✅ cmsProductId column already exists');
    return;
  }

  // Add cmsProductId column after productId
  await connection.execute(`
    ALTER TABLE g_store_products
    ADD COLUMN cmsProductId INT NULL COMMENT 'CMS CashShop product ID for sync'
    AFTER productId
  `);

  // Add index for faster lookup
  await connection.execute(`
    ALTER TABLE g_store_products
    ADD INDEX idx_cms_product_id (cmsProductId)
  `);

  // Update unique constraint to use cmsProductId instead of productId
  // First drop the old unique constraint
  try {
    await connection.execute(`
      ALTER TABLE g_store_products
      DROP INDEX uk_env_product_store
    `);
    console.log('✓ Dropped old unique constraint uk_env_product_store');
  } catch (e) {
    console.log('⚠️ uk_env_product_store constraint does not exist, skipping drop');
  }

  // Add new unique constraint with cmsProductId
  await connection.execute(`
    ALTER TABLE g_store_products
    ADD UNIQUE KEY uk_env_cms_product_store (environmentId, cmsProductId, store)
  `);

  console.log('✅ cmsProductId column added successfully');
};

exports.down = async function (connection) {
  console.log('Removing cmsProductId column from g_store_products...');

  // Drop the new unique constraint
  try {
    await connection.execute(`
      ALTER TABLE g_store_products
      DROP INDEX uk_env_cms_product_store
    `);
  } catch (e) {
    console.log('⚠️ uk_env_cms_product_store constraint does not exist');
  }

  // Drop the index
  try {
    await connection.execute(`
      ALTER TABLE g_store_products
      DROP INDEX idx_cms_product_id
    `);
  } catch (e) {
    console.log('⚠️ idx_cms_product_id index does not exist');
  }

  // Drop the column
  try {
    await connection.execute(`
      ALTER TABLE g_store_products
      DROP COLUMN cmsProductId
    `);
  } catch (e) {
    console.log('⚠️ cmsProductId column does not exist');
  }

  // Restore old unique constraint
  await connection.execute(`
    ALTER TABLE g_store_products
    ADD UNIQUE KEY uk_env_product_store (environmentId, productId, store)
  `);

  console.log('✅ cmsProductId column removed');
};

module.exports = exports;
