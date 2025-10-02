exports.up = function(knex) {
  return knex.schema.createTable('chat_channel_members', function(table) {
    table.bigIncrements('id').primary();
    table.bigInteger('channelId').unsigned().notNullable();
    table.bigInteger('userId').unsigned().notNullable();
    
    // 멤버 역할 및 권한
    table.enum('role', ['owner', 'admin', 'moderator', 'member']).defaultTo('member');
    table.json('permissions');
    
    // 멤버 상태
    table.enum('status', ['active', 'muted', 'banned', 'left']).defaultTo('active');
    table.timestamp('mutedUntil');
    table.text('banReason');
    
    // 읽기 상태
    table.bigInteger('lastReadMessageId').unsigned().defaultTo(0);
    table.timestamp('lastReadAt');
    table.integer('unreadCount').unsigned().defaultTo(0);

    // 알림 설정
    table.json('notificationSettings');
    
    // 타임스탬프
    table.timestamp('joinedAt').defaultTo(knex.fn.now());
    table.timestamp('leftAt');
    table.timestamp('updatedAt').defaultTo(knex.fn.now());
    
    // 제약 조건
    table.unique(['channelId', 'userId'], 'uk_channel_user');

    // 인덱스
    table.index(['channelId', 'status'], 'idx_members_channel');
    table.index(['userId', 'status'], 'idx_members_user');
    table.index(['userId', 'unreadCount'], 'idx_members_unread');
    table.index(['channelId', 'lastReadMessageId'], 'idx_members_last_read');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('chat_channel_members');
};
