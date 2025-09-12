/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('g_remote_config_variants', function(table) {
    table.integer('updatedBy').nullable();
    table.foreign('updatedBy').references('id').inTable('g_users').onDelete('SET NULL');
    table.index(['updatedBy']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('g_remote_config_variants', function(table) {
    table.dropForeign(['updatedBy']);
    table.dropIndex(['updatedBy']);
    table.dropColumn('updatedBy');
  });
};
