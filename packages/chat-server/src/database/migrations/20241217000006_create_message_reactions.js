/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 기존 테이블이 있으면 삭제
  await knex.schema.dropTableIfExists('chat_message_reactions');

  return knex.schema.createTable('chat_message_reactions', function(table) {
    table.bigIncrements('id').primary();
    table.bigInteger('messageId').unsigned().notNullable();
    table.bigInteger('userId').unsigned().notNullable();
    table.string('emoji', 50).notNullable(); // 이모지 유니코드 또는 커스텀 이모지 ID
    table.timestamp('createdAt').defaultTo(knex.fn.now());

    // 외래키 제약조건
    table.foreign('messageId').references('id').inTable('chat_messages').onDelete('CASCADE');
    table.foreign('userId').references('id').inTable('chat_users').onDelete('CASCADE');
    
    // 유니크 제약조건 (한 사용자는 같은 메시지에 같은 이모지로 한 번만 반응 가능)
    table.unique(['messageId', 'userId', 'emoji']);
    
    // 인덱스
    table.index('messageId');
    table.index('userId');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('chat_message_reactions');
};
