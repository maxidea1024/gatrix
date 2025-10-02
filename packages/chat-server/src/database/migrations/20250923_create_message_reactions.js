/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('chat_message_reactions', function(table) {
    table.increments('id').primary();
    table.integer('messageId').unsigned().notNullable();
    table.integer('userId').unsigned().notNullable();
    table.string('emoji', 10).notNullable(); // 이모지 (예: '👍', '❤️', '😂')
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // 외래키 제약조건
    table.foreign('messageId').references('id').inTable('chat_messages').onDelete('CASCADE');
    table.foreign('userId').references('gatrixUserId').inTable('chat_users').onDelete('CASCADE');
    
    // 복합 유니크 인덱스 (한 사용자는 같은 메시지에 같은 이모지로 한 번만 리액션 가능)
    table.unique(['messageId', 'userId', 'emoji']);
    
    // 인덱스
    table.index(['messageId']);
    table.index(['userId']);
    table.index(['emoji']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('chat_message_reactions');
};
