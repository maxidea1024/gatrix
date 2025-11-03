exports.up = function(knex) {
  return knex.schema
    // 사용자 온라인 상태 테이블 (고성능)
    .createTableIfNotExists('chat_user_presence', (table) => {
      table.bigInteger('user_id').unsigned().primary();

      // 온라인 상태
      table.enum('status', ['online', 'away', 'busy', 'offline']).defaultTo('offline');
      table.string('custom_status', 255).nullable();

      // 연결 정보
      table.string('socket_id', 100).nullable();
      table.string('server_id', 100).nullable();
      table.enum('device_type', ['web', 'mobile', 'desktop']).defaultTo('web');
      table.text('user_agent').nullable();
      table.string('ip_address', 45).nullable();

      // 타임스탬프
      table.timestamp('last_seen_at').defaultTo(knex.fn.now());
      table.timestamp('connected_at').nullable();
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // 인덱스
      table.index(['status', 'last_seen_at'], 'idx_presence_status');
      table.index('server_id', 'idx_presence_server');
      table.index('last_seen_at', 'idx_presence_last_seen');
    })
    // 타이핑 인디케이터 테이블 (임시 데이터, 메모리 엔진)
    .createTableIfNotExists('chat_typing_indicators', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('channel_id').unsigned().notNullable();
      table.bigInteger('user_id').unsigned().notNullable();

      table.timestamp('started_at').defaultTo(knex.fn.now());
      table.timestamp('expires_at').notNullable();

      // 제약 조건
      table.unique(['channel_id', 'user_id'], { indexName: 'uk_channel_user_typing' });

      // 인덱스
      table.index(['channel_id', 'expires_at'], 'idx_typing_channel');
      table.index('expires_at', 'idx_typing_expires');
    })
    // 사용자 차단 테이블
    .createTableIfNotExists('chat_user_blocks', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('blocker_user_id').unsigned().notNullable();
      table.bigInteger('blocked_user_id').unsigned().notNullable();

      table.string('reason', 255).nullable();

      table.timestamp('created_at').defaultTo(knex.fn.now());

      // 제약 조건
      table.unique(['blocker_user_id', 'blocked_user_id'], { indexName: 'uk_blocker_blocked' });

      // 인덱스
      table.index('blocker_user_id', 'idx_blocks_blocker');
      table.index('blocked_user_id', 'idx_blocks_blocked');
    })
    // 알림 테이블
    .createTableIfNotExists('chat_notifications', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('user_id').unsigned().notNullable();

      // 알림 내용
      table.enum('type', ['message', 'mention', 'channel_invite', 'system']).notNullable();
      table.string('title', 255).notNullable();
      table.text('content').notNullable();

      // 관련 엔티티
      table.bigInteger('channel_id').unsigned().nullable();
      table.bigInteger('message_id').unsigned().nullable();
      table.bigInteger('sender_user_id').unsigned().nullable();

      // 알림 상태
      table.boolean('is_read').defaultTo(false);
      table.boolean('is_delivered').defaultTo(false);
      table.enum('delivery_method', ['push', 'email', 'sms', 'in_app']).defaultTo('in_app');

      // 메타데이터
      table.json('metadata');

      // 타임스탬프
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('read_at').nullable();
      table.timestamp('delivered_at').nullable();
      table.timestamp('expires_at').nullable();

      // 인덱스
      table.index(['user_id', 'is_read', 'created_at'], 'idx_notifications_user');
      table.index('channel_id', 'idx_notifications_channel');
      table.index('message_id', 'idx_notifications_message');
      table.index('expires_at', 'idx_notifications_expires');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('chat_notifications')
    .dropTableIfExists('chat_user_blocks')
    .dropTableIfExists('chat_typing_indicators')
    .dropTableIfExists('chat_user_presence');
};
