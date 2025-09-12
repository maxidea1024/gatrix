/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('g_remote_config_context_fields', function(table) {
    table.increments('id').primary();
    table.string('key', 100).notNullable().unique();
    table.string('name', 200).notNullable();
    table.text('description');
    table.enum('type', ['string', 'number', 'boolean', 'array']).notNullable();
    table.json('options').nullable(); // For array type fields
    table.text('defaultValue').nullable();
    table.json('validation').nullable(); // Validation rules
    table.boolean('isActive').defaultTo(true);
    table.boolean('isSystem').defaultTo(false); // System fields cannot be deleted
    table.integer('createdBy').nullable();
    table.integer('updatedBy').nullable();
    table.timestamps(true, true);
    
    // Foreign keys
    table.foreign('createdBy').references('id').inTable('g_users').onDelete('SET NULL');
    table.foreign('updatedBy').references('id').inTable('g_users').onDelete('SET NULL');
    
    // Indexes
    table.index(['key']);
    table.index(['type']);
    table.index(['isActive']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('g_remote_config_context_fields');
};
