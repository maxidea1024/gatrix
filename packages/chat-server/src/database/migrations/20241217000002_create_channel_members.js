exports.up = function(knex) {
  return knex.schema.createTable('chat_channel_members', function(table) {
    table.bigIncrements('id').primary();
    table.bigInteger('channel_id').unsigned().notNullable();
    table.bigInteger('user_id').unsigned().notNullable();
    
    // 멤버 역할 및 권한
    table.enum('role', ['owner', 'admin', 'moderator', 'member']).defaultTo('member');
    table.json('permissions');
    
    // 멤버 상태
    table.enum('status', ['active', 'muted', 'banned', 'left']).defaultTo('active');
    table.timestamp('muted_until');
    table.text('ban_reason');
    
    // 읽기 상태
    table.bigInteger('last_read_message_id').unsigned().defaultTo(0);
    table.timestamp('last_read_at');
    table.integer('unread_count').unsigned().defaultTo(0);
    
    // 알림 설정
    table.json('notification_settings');
    
    // 타임스탬프
    table.timestamp('joined_at').defaultTo(knex.fn.now());
    table.timestamp('left_at');
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // 제약 조건
    table.unique(['channel_id', 'user_id'], 'uk_channel_user');
    
    // 인덱스
    table.index(['channel_id', 'status'], 'idx_members_channel');
    table.index(['user_id', 'status'], 'idx_members_user');
    table.index(['user_id', 'unread_count'], 'idx_members_unread');
    table.index(['channel_id', 'last_read_message_id'], 'idx_members_last_read');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('chat_channel_members');
};
