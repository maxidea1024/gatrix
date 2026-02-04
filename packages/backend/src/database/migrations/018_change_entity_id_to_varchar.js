module.exports = {
  name: 'change_entity_id_to_varchar',
  async up(connection) {
    // First, delete any existing store_product assignments (they used incorrect INT type)
    await connection.query(`
            DELETE FROM g_tag_assignments WHERE entityType = 'store_product'
        `);

    // Modify the column type from INT to VARCHAR(36) to support ULIDs
    await connection.query(`
            ALTER TABLE g_tag_assignments MODIFY COLUMN entityId VARCHAR(36) NOT NULL
        `);
  },
  async down(connection) {
    // First, delete any store_product assignments (they would be incompatible with INT)
    await connection.query(`
            DELETE FROM g_tag_assignments WHERE entityType = 'store_product'
        `);

    // Revert to INT type
    await connection.query(`
            ALTER TABLE g_tag_assignments MODIFY COLUMN entityId INT NOT NULL
        `);
  },
};
