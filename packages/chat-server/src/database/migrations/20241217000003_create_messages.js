exports.up = function(knex) {
  return knex.schema.createTable('chat_messages', function(table) {
    table.bigIncrements('id').primary();
    table.bigInteger('channel_id').unsigned().notNullable();
    table.bigInteger('user_id').unsigned().notNullable();
    
    // 메시지 내용
    table.text('content').notNullable();
    table.enum('content_type', ['text', 'image', 'video', 'audio', 'file', 'location', 'system']).defaultTo('text');
    
    // 메시지 메타데이터
    table.json('message_data');
    table.bigInteger('reply_to_message_id').unsigned();
    table.bigInteger('thread_id').unsigned();
    
    // 메시지 상태
    table.boolean('is_edited').defaultTo(false);
    table.boolean('is_deleted').defaultTo(false);
    table.boolean('is_pinned').defaultTo(false);
    
    // 시스템 메시지
    table.string('system_message_type', 50);
    table.json('system_message_data');
    
    // 타임스탬프 (밀리초 정밀도)
    table.timestamp('created_at', { precision: 3 }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { precision: 3 }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { precision: 3 });
    
    // 인덱스
    table.index(['channel_id', 'created_at'], 'idx_messages_channel_time');
    table.index(['user_id', 'created_at'], 'idx_messages_user');
    table.index(['reply_to_message_id'], 'idx_messages_reply');
    table.index(['thread_id', 'created_at'], 'idx_messages_thread');
    table.index(['channel_id', 'is_deleted', 'created_at'], 'idx_messages_active');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('chat_messages');
};
