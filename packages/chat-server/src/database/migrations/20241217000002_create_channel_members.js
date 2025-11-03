exports.up = function(knex) {
  return knex.schema
    // 메시지 테이블 (고성능 샤딩)
    .createTableIfNotExists('chat_messages', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('channel_id').unsigned().notNullable();
      table.bigInteger('user_id').unsigned().notNullable();

      // 메시지 내용
      table.text('content').notNullable();
      table.enum('content_type', ['text', 'image', 'video', 'audio', 'file', 'location', 'system']).defaultTo('text');

      // 메시지 메타데이터
      table.json('message_data'); // 첨부파일, 멘션, 해시태그, 이모지 등
      table.bigInteger('reply_to_message_id').unsigned().nullable(); // 답글
      table.bigInteger('thread_id').unsigned().nullable(); // 스레드

      // 메시지 상태
      table.boolean('is_edited').defaultTo(false);
      table.boolean('is_deleted').defaultTo(false);
      table.boolean('is_pinned').defaultTo(false);

      // 시스템 메시지 정보
      table.string('system_message_type', 50).nullable(); // user_joined, user_left, channel_created 등
      table.json('system_message_data');

      // 타임스탬프
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.timestamp('deleted_at').nullable();

      // 인덱스 (성능 최적화)
      table.index(['channel_id', 'created_at'], 'idx_messages_channel_time');
      table.index(['user_id', 'created_at'], 'idx_messages_user');
      table.index('reply_to_message_id', 'idx_messages_reply');
      table.index(['thread_id', 'created_at'], 'idx_messages_thread');
      table.index(['channel_id', 'is_deleted', 'created_at'], 'idx_messages_active');
    })
    // 메시지 첨부파일 테이블
    .createTableIfNotExists('chat_message_attachments', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('message_id').unsigned().notNullable();

      // 파일 정보
      table.string('file_name', 255).notNullable();
      table.string('file_path', 500).notNullable();
      table.bigInteger('file_size').unsigned().notNullable();
      table.string('file_type', 100).notNullable();
      table.string('mime_type', 100).notNullable();

      // 이미지/비디오 메타데이터
      table.integer('width').unsigned().nullable();
      table.integer('height').unsigned().nullable();
      table.integer('duration').unsigned().nullable(); // 초 단위

      // 썸네일
      table.string('thumbnail_path', 500).nullable();
      table.integer('thumbnail_width').unsigned().nullable();
      table.integer('thumbnail_height').unsigned().nullable();

      // 업로드 정보
      table.enum('upload_status', ['uploading', 'completed', 'failed']).defaultTo('uploading');
      table.integer('upload_progress').unsigned().defaultTo(0);

      table.timestamp('created_at').defaultTo(knex.fn.now());

      // 인덱스
      table.index('message_id', 'idx_attachments_message');
      table.index('file_type', 'idx_attachments_type');
      table.index('upload_status', 'idx_attachments_status');
    })
    // 메시지 반응 테이블 (이모지 반응)
    .createTableIfNotExists('chat_message_reactions', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('message_id').unsigned().notNullable();
      table.bigInteger('user_id').unsigned().notNullable();
      table.string('emoji', 50).notNullable(); // 이모지 유니코드 또는 커스텀 이모지 ID

      table.timestamp('created_at').defaultTo(knex.fn.now());

      // 제약 조건 (한 사용자는 메시지당 같은 이모지 하나만)
      table.unique(['message_id', 'user_id', 'emoji'], { indexName: 'uk_message_user_emoji' });

      // 인덱스
      table.index('message_id', 'idx_reactions_message');
      table.index('user_id', 'idx_reactions_user');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('chat_message_reactions')
    .dropTableIfExists('chat_message_attachments')
    .dropTableIfExists('chat_messages');
};
