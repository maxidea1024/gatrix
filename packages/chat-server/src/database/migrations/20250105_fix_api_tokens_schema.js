exports.up = function(knex) {
  return knex.schema
    .dropTableIfExists('chat_api_tokens')
    .then(() => {
      return knex.schema.createTable('chat_api_tokens', (table) => {
        table.increments('id').primary();
        table.string('tokenName', 255).notNullable();
        table.string('tokenHash', 255).notNullable().unique();
        table.enum('tokenType', ['client', 'server']).notNullable();
        table.text('description').nullable();
        table.json('permissions').nullable(); // Add permissions column
        table.timestamp('expiresAt').nullable();
        table.timestamp('lastUsedAt').nullable();
        table.bigInteger('usageCount').defaultTo(0);
        table.boolean('isActive').defaultTo(true);
        table.integer('createdBy').notNullable();
        table.integer('updatedBy').nullable();
        table.timestamp('createdAt').defaultTo(knex.fn.now());
        table.timestamp('updatedAt').defaultTo(knex.fn.now());

        table.index('tokenType', 'idx_token_type');
        table.index('createdBy', 'idx_created_by');
        table.index('createdAt', 'idx_created_at');
        table.index('lastUsedAt', 'idx_last_used_at');
        table.index('expiresAt', 'idx_expires_at');
        table.index('isActive', 'idx_is_active');
      });
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('chat_api_tokens');
};

