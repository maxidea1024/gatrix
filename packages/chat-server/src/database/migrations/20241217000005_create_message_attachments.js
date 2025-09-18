/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 기존 테이블이 있으면 삭제
  await knex.schema.dropTableIfExists('chat_message_attachments');

  return knex.schema.createTable('chat_message_attachments', function(table) {
    table.bigIncrements('id').primary();
    table.bigInteger('messageId').unsigned().notNullable();
    table.string('fileName', 255).notNullable();
    table.string('originalName', 255).notNullable();
    table.string('mimeType', 100).notNullable();
    table.bigInteger('fileSize').unsigned().notNullable();
    table.string('filePath', 500).notNullable();
    table.string('fileUrl', 500).nullable();
    table.enum('uploadStatus', ['pending', 'uploading', 'completed', 'failed']).defaultTo('pending');
    table.text('metadata').nullable(); // JSON 형태의 추가 메타데이터
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('updatedAt').defaultTo(knex.fn.now());

    // 외래키 제약조건
    table.foreign('messageId').references('id').inTable('chat_messages').onDelete('CASCADE');
    
    // 인덱스
    table.index('messageId');
    table.index('uploadStatus');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('chat_message_attachments');
};
