exports.up = function(knex) {
  return knex.schema.createTable('chat_messages', function(table) {
    table.bigIncrements('id').primary();
    table.bigInteger('channelId').unsigned().notNullable();
    table.bigInteger('userId').unsigned().notNullable();

    // 메시지 내용
    table.text('content').notNullable();
    table.enum('contentType', ['text', 'image', 'video', 'audio', 'file', 'location', 'system']).defaultTo('text');

    // 메시지 메타데이터
    table.json('messageData');
    table.bigInteger('replyToMessageId').unsigned();
    table.bigInteger('threadId').unsigned();
    
    // 메시지 상태
    table.boolean('isEdited').defaultTo(false);
    table.boolean('isDeleted').defaultTo(false);
    table.boolean('isPinned').defaultTo(false);

    // 시스템 메시지
    table.string('systemMessageType', 50);
    table.json('systemMessageData');

    // 타임스탬프 (밀리초 정밀도)
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('updatedAt').defaultTo(knex.fn.now());
    table.timestamp('deletedAt');
    
    // 인덱스
    table.index(['channelId', 'createdAt'], 'idx_messages_channel_time');
    table.index(['userId', 'createdAt'], 'idx_messages_user');
    table.index(['replyToMessageId'], 'idx_messages_reply');
    table.index(['threadId', 'createdAt'], 'idx_messages_thread');
    table.index(['channelId', 'isDeleted', 'createdAt'], 'idx_messages_active');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('chat_messages');
};
