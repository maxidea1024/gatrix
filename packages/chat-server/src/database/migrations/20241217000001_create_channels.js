exports.up = function(knex) {
  return knex.schema.createTable('chat_channels', function(table) {
    table.bigIncrements('id').primary();
    table.string('name', 255).notNullable();
    table.text('description');
    table.enum('type', ['public', 'private', 'direct']).defaultTo('public');
    
    // 채널 설정
    table.integer('max_members').unsigned().defaultTo(1000);
    table.boolean('is_archived').defaultTo(false);
    table.text('archive_reason');
    
    // 메타데이터
    table.string('avatar_url', 500);
    table.json('settings');
    
    // 소유자 및 생성 정보
    table.bigInteger('owner_id').unsigned().notNullable();
    table.bigInteger('created_by').unsigned().notNullable();
    table.bigInteger('updated_by').unsigned();
    
    // 타임스탬프
    table.timestamps(true, true);
    table.timestamp('archived_at');
    
    // 인덱스
    table.index(['type'], 'idx_channels_type');
    table.index(['owner_id'], 'idx_channels_owner');
    table.index(['created_at'], 'idx_channels_created_at');
    table.index(['is_archived', 'type'], 'idx_channels_active');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('chat_channels');
};
