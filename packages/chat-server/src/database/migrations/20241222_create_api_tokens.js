exports.up = function(knex) {
  return knex.schema.createTable('chat_api_tokens', function(table) {
    table.string('id', 36).primary();
    table.string('name', 255).notNullable();
    table.string('token', 255).notNullable().unique();
    table.json('permissions').notNullable();
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.boolean('isActive').defaultTo(true);
    
    // 인덱스 추가
    table.index('token', 'idx_token');
    table.index('name', 'idx_name');
    table.index('isActive', 'idx_active');
    table.index('createdAt', 'idx_created_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('chat_api_tokens');
};
