exports.up = function(knex) {
  return knex.schema
    // 메시지 검색 최적화를 위한 인덱스 테이블
    .createTableIfNotExists('chat_message_search_index', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('message_id').unsigned().notNullable();
      table.bigInteger('channel_id').unsigned().notNullable();
      table.bigInteger('user_id').unsigned().notNullable();

      // 검색 최적화된 컨텐츠
      table.text('search_content').notNullable(); // 정규화된 검색 텍스트
      table.string('keywords', 1000).nullable(); // 추출된 키워드
      table.json('mentions').nullable(); // 멘션된 사용자 ID 배열
      table.json('hashtags').nullable(); // 해시태그 배열

      table.timestamp('created_at').defaultTo(knex.fn.now());

      // 인덱스
      table.index('channel_id', 'idx_search_channel');
      table.index('user_id', 'idx_search_user');
      table.index('message_id', 'idx_search_message');
    })
    // 채널 통계 테이블 (성능 최적화)
    .createTableIfNotExists('chat_channel_stats', (table) => {
      table.bigInteger('channel_id').unsigned().primary();

      // 멤버 통계
      table.integer('total_members').unsigned().defaultTo(0);
      table.integer('active_members').unsigned().defaultTo(0); // 최근 7일 활성 멤버
      table.integer('online_members').unsigned().defaultTo(0);

      // 메시지 통계
      table.bigInteger('total_messages').unsigned().defaultTo(0);
      table.integer('messages_today').unsigned().defaultTo(0);
      table.integer('messages_this_week').unsigned().defaultTo(0);
      table.integer('messages_this_month').unsigned().defaultTo(0);

      // 활동 통계
      table.timestamp('last_message_at').nullable();
      table.timestamp('last_activity_at').nullable();
      table.integer('peak_concurrent_users').unsigned().defaultTo(0);

      // 업데이트 타임스탬프
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // 인덱스
      table.index('last_activity_at', 'idx_stats_activity');
      table.index('total_messages', 'idx_stats_messages');
      table.index('total_members', 'idx_stats_members');
    })
    // 사용자 통계 테이블
    .createTableIfNotExists('chat_user_stats', (table) => {
      table.bigInteger('user_id').unsigned().primary();

      // 메시지 통계
      table.bigInteger('total_messages_sent').unsigned().defaultTo(0);
      table.integer('messages_today').unsigned().defaultTo(0);
      table.integer('messages_this_week').unsigned().defaultTo(0);
      table.integer('messages_this_month').unsigned().defaultTo(0);

      // 채널 통계
      table.integer('total_channels_joined').unsigned().defaultTo(0);
      table.integer('active_channels').unsigned().defaultTo(0); // 최근 활동한 채널 수

      // 활동 통계
      table.timestamp('first_message_at').nullable();
      table.timestamp('last_message_at').nullable();
      table.bigInteger('total_online_time').unsigned().defaultTo(0); // 초 단위

      // 업데이트 타임스탬프
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // 인덱스
      table.index('last_message_at', 'idx_user_stats_activity');
      table.index('total_messages_sent', 'idx_user_stats_messages');
    })
    // 서버 성능 모니터링 테이블
    .createTableIfNotExists('chat_server_metrics', (table) => {
      table.bigIncrements('id').primary();
      table.string('server_id', 100).notNullable();

      // 연결 통계
      table.integer('concurrent_connections').unsigned().defaultTo(0);
      table.bigInteger('total_connections_today').unsigned().defaultTo(0);
      table.integer('peak_connections').unsigned().defaultTo(0);

      // 메시지 통계
      table.decimal('messages_per_second', 10, 2).defaultTo(0);
      table.bigInteger('total_messages_processed').unsigned().defaultTo(0);

      // 성능 지표
      table.decimal('cpu_usage', 5, 2).defaultTo(0); // 퍼센트
      table.bigInteger('memory_usage').unsigned().defaultTo(0); // 바이트
      table.decimal('redis_latency', 10, 3).defaultTo(0); // 밀리초
      table.decimal('db_latency', 10, 3).defaultTo(0); // 밀리초

      // 에러 통계
      table.integer('error_count').unsigned().defaultTo(0);
      table.integer('warning_count').unsigned().defaultTo(0);

      table.timestamp('recorded_at').defaultTo(knex.fn.now());

      // 인덱스
      table.index(['server_id', 'recorded_at'], 'idx_metrics_server');
      table.index('recorded_at', 'idx_metrics_time');
    })
    // 메시지 큐 테이블 (배치 처리용)
    .createTableIfNotExists('chat_message_queue', (table) => {
      table.bigIncrements('id').primary();

      // 큐 정보
      table.enum('queue_type', ['broadcast', 'notification', 'webhook', 'analytics']).notNullable();
      table.integer('priority').unsigned().defaultTo(5); // 1(높음) ~ 10(낮음)

      // 메시지 데이터
      table.json('payload').notNullable();
      table.json('target_channels').nullable(); // 대상 채널 ID 배열
      table.json('target_users').nullable(); // 대상 사용자 ID 배열

      // 처리 상태
      table.enum('status', ['pending', 'processing', 'completed', 'failed', 'retrying']).defaultTo('pending');
      table.integer('attempts').unsigned().defaultTo(0);
      table.integer('max_attempts').unsigned().defaultTo(3);

      // 스케줄링
      table.timestamp('scheduled_at').defaultTo(knex.fn.now());
      table.timestamp('started_at').nullable();
      table.timestamp('completed_at').nullable();

      // 에러 정보
      table.text('error_message').nullable();
      table.json('error_details');

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // 인덱스
      table.index(['status', 'priority', 'scheduled_at'], 'idx_queue_status');
      table.index(['queue_type', 'status'], 'idx_queue_type');
      table.index('scheduled_at', 'idx_queue_scheduled');
      table.index(['status', 'completed_at'], 'idx_queue_cleanup');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('chat_message_queue')
    .dropTableIfExists('chat_server_metrics')
    .dropTableIfExists('chat_user_stats')
    .dropTableIfExists('chat_channel_stats')
    .dropTableIfExists('chat_message_search_index');
};
