exports.up = function(knex) {
  return knex.schema
    // 채널 테이블 (채팅방)
    .createTableIfNotExists('chat_channels', (table) => {
      table.bigIncrements('id').primary();
      table.string('name', 255).notNullable();
      table.text('description');
      table.enum('type', ['public', 'private', 'direct']).notNullable().defaultTo('public');

      // 채널 설정
      table.integer('max_members').unsigned().defaultTo(1000);
      table.boolean('is_archived').defaultTo(false);
      table.text('archive_reason');

      // 메타데이터
      table.string('avatar_url', 500);
      table.json('settings'); // 채널별 설정 (알림, 권한 등)

      // 소유자 및 생성 정보
      table.bigInteger('owner_id').unsigned().notNullable();
      table.bigInteger('created_by').unsigned().notNullable();
      table.bigInteger('updated_by').unsigned();

      // 타임스탬프
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.timestamp('archived_at').nullable();

      // 인덱스
      table.index('type', 'idx_channels_type');
      table.index('owner_id', 'idx_channels_owner');
      table.index('created_at', 'idx_channels_created_at');
      table.index(['is_archived', 'type'], 'idx_channels_active');
    })
    // 채널 멤버십 테이블
    .createTableIfNotExists('chat_channel_members', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('channel_id').unsigned().notNullable();
      table.bigInteger('user_id').unsigned().notNullable();

      // 멤버 역할 및 권한
      table.enum('role', ['owner', 'admin', 'moderator', 'member']).defaultTo('member');
      table.json('permissions'); // 세부 권한 설정

      // 멤버 상태
      table.enum('status', ['active', 'muted', 'banned', 'left']).defaultTo('active');
      table.timestamp('muted_until').nullable();
      table.text('ban_reason');

      // 읽기 상태 (성능 최적화)
      table.bigInteger('last_read_message_id').unsigned().defaultTo(0);
      table.timestamp('last_read_at').nullable();
      table.integer('unread_count').unsigned().defaultTo(0);

      // 알림 설정
      table.json('notification_settings');

      // 타임스탬프
      table.timestamp('joined_at').defaultTo(knex.fn.now());
      table.timestamp('left_at').nullable();
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // 제약 조건
      table.unique(['channel_id', 'user_id'], { indexName: 'uk_channel_user' });

      // 인덱스 (성능 최적화)
      table.index(['channel_id', 'status'], 'idx_members_channel');
      table.index(['user_id', 'status'], 'idx_members_user');
      table.index(['user_id', 'unread_count'], 'idx_members_unread');
      table.index(['channel_id', 'last_read_message_id'], 'idx_members_last_read');
      table.index(['channel_id', 'user_id', 'joined_at'], 'idx_members_partition');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('chat_channel_members')
    .dropTableIfExists('chat_channels');
};
