/**
 * Migration: Rename columns nameKey -> name, descriptionKey -> description in g_coupon_settings
 * Notes:
 * - Keep camelCase per convention
 * - MySQL DATETIME unaffected
 */

exports.up = async function(connection) {
  console.log('Renaming columns in g_coupon_settings (nameKey -> name, descriptionKey -> description)...');
  await connection.execute(`ALTER TABLE g_coupon_settings CHANGE COLUMN nameKey name VARCHAR(128) NOT NULL`);
  await connection.execute(`ALTER TABLE g_coupon_settings CHANGE COLUMN descriptionKey description VARCHAR(128) NULL`);
  console.log('Column rename completed.');
};

exports.down = async function(connection) {
  console.log('Reverting column names in g_coupon_settings (name -> nameKey, description -> descriptionKey)...');
  await connection.execute(`ALTER TABLE g_coupon_settings CHANGE COLUMN name nameKey VARCHAR(128) NOT NULL`);
  await connection.execute(`ALTER TABLE g_coupon_settings CHANGE COLUMN description descriptionKey VARCHAR(128) NULL`);
  console.log('Column rename reverted.');
};

