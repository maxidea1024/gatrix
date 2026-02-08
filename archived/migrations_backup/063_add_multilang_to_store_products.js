/**
 * Add multi-language columns to g_store_products table
 * Adds nameKo, nameEn, nameZh, descriptionKo, descriptionEn, descriptionZh columns
 * for supporting multi-language product names and descriptions
 */

exports.up = async function (connection) {
  console.log('Adding multi-language columns to g_store_products...');

  // Check if columns already exist
  const [columns] = await connection.execute(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'g_store_products'
    AND COLUMN_NAME IN ('nameKo', 'nameEn', 'nameZh', 'descriptionKo', 'descriptionEn', 'descriptionZh')
  `);

  if (columns.length >= 6) {
    console.log('✅ Multi-language columns already exist');
    return;
  }

  // Add nameKo column (Korean name)
  try {
    await connection.execute(`
      ALTER TABLE g_store_products
      ADD COLUMN nameKo VARCHAR(255) NULL COMMENT 'Product name in Korean'
      AFTER productName
    `);
    console.log('   ✓ Added nameKo column');
  } catch (e) {
    console.log('   ⚠️ nameKo column may already exist');
  }

  // Add nameEn column (English name)
  try {
    await connection.execute(`
      ALTER TABLE g_store_products
      ADD COLUMN nameEn VARCHAR(255) NULL COMMENT 'Product name in English'
      AFTER nameKo
    `);
    console.log('   ✓ Added nameEn column');
  } catch (e) {
    console.log('   ⚠️ nameEn column may already exist');
  }

  // Add nameZh column (Chinese name)
  try {
    await connection.execute(`
      ALTER TABLE g_store_products
      ADD COLUMN nameZh VARCHAR(255) NULL COMMENT 'Product name in Chinese'
      AFTER nameEn
    `);
    console.log('   ✓ Added nameZh column');
  } catch (e) {
    console.log('   ⚠️ nameZh column may already exist');
  }

  // Add descriptionKo column (Korean description)
  try {
    await connection.execute(`
      ALTER TABLE g_store_products
      ADD COLUMN descriptionKo TEXT NULL COMMENT 'Product description in Korean'
      AFTER description
    `);
    console.log('   ✓ Added descriptionKo column');
  } catch (e) {
    console.log('   ⚠️ descriptionKo column may already exist');
  }

  // Add descriptionEn column (English description)
  try {
    await connection.execute(`
      ALTER TABLE g_store_products
      ADD COLUMN descriptionEn TEXT NULL COMMENT 'Product description in English'
      AFTER descriptionKo
    `);
    console.log('   ✓ Added descriptionEn column');
  } catch (e) {
    console.log('   ⚠️ descriptionEn column may already exist');
  }

  // Add descriptionZh column (Chinese description)
  try {
    await connection.execute(`
      ALTER TABLE g_store_products
      ADD COLUMN descriptionZh TEXT NULL COMMENT 'Product description in Chinese'
      AFTER descriptionEn
    `);
    console.log('   ✓ Added descriptionZh column');
  } catch (e) {
    console.log('   ⚠️ descriptionZh column may already exist');
  }

  // Migrate existing data: copy productName to nameKo and description to descriptionKo
  await connection.execute(`
    UPDATE g_store_products
    SET nameKo = productName,
        nameEn = productName,
        nameZh = productName,
        descriptionKo = description,
        descriptionEn = description,
        descriptionZh = description
    WHERE nameKo IS NULL
  `);

  console.log('✅ Multi-language columns added and data migrated successfully');
};

exports.down = async function (connection) {
  console.log('Removing multi-language columns from g_store_products...');

  const columnsToRemove = [
    'nameKo',
    'nameEn',
    'nameZh',
    'descriptionKo',
    'descriptionEn',
    'descriptionZh',
  ];

  for (const column of columnsToRemove) {
    try {
      await connection.execute(`ALTER TABLE g_store_products DROP COLUMN ${column}`);
      console.log(`   ✓ Dropped ${column} column`);
    } catch (e) {
      console.log(`   ⚠️ ${column} column does not exist`);
    }
  }

  console.log('✅ Multi-language columns removed');
};

module.exports = exports;
