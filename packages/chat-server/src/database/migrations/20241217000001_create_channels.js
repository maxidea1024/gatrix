exports.up = function(knex) {
  return knex.schema.createTable('chat_channels', function(table) {
    table.bigIncrements('id').primary();
    table.string('name', 255).notNullable();
    table.text('description');
    table.enum('type', ['public', 'private', 'direct']).defaultTo('public');
    
    // 채널 설정
    table.integer('maxMembers').unsigned().defaultTo(1000);
    table.boolean('isArchived').defaultTo(false);
    table.text('archiveReason');

    // 메타데이터
    table.string('avatarUrl', 500);
    table.json('settings');

    // 소유자 및 생성 정보
    table.bigInteger('ownerId').unsigned().notNullable();
    table.bigInteger('createdBy').unsigned().notNullable();
    table.bigInteger('updatedBy').unsigned();
    
    // 타임스탬프
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('updatedAt').defaultTo(knex.fn.now());
    table.timestamp('archivedAt');

    // 인덱스
    table.index(['type'], 'idx_channels_type');
    table.index(['ownerId'], 'idx_channels_owner');
    table.index(['createdAt'], 'idx_channels_created_at');
    table.index(['isArchived', 'type'], 'idx_channels_active');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('chat_channels');
};
