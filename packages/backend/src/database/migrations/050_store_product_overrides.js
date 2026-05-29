// Migration: Add overriddenFields column to g_store_products for tracking
// which fields have been manually overridden vs imported from planning data
exports.name = '050_store_product_overrides';

exports.up = async function (connection) {
  // Check if column already exists
  const [columns] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_store_products' AND COLUMN_NAME = 'overriddenFields'`
  );
  if (columns.length > 0) {
    console.log('[050] overriddenFields column already exists, skipping');
    return;
  }

  await connection.execute(
    `ALTER TABLE g_store_products ADD COLUMN overriddenFields JSON NULL COMMENT 'JSON array of field names overridden by user'`
  );

  console.log('[050] overriddenFields column added to g_store_products');
};

exports.down = async function (connection) {
  const [columns] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_store_products' AND COLUMN_NAME = 'overriddenFields'`
  );
  if (columns.length > 0) {
    await connection.execute(
      `ALTER TABLE g_store_products DROP COLUMN overriddenFields`
    );
  }
  console.log('[050] overriddenFields column removed from g_store_products');
};
