exports.up = function(knex) {
  return knex.schema.createTable('chat_users', function(table) {
    table.bigIncrements('id').primary();
    table.bigInteger('gatrixUserId').unsigned().notNullable().unique();

    // 사용자 기본 정보
    table.string('email', 255).notNullable();
    table.string('name', 255).notNullable();
    table.string('avatarUrl', 500);
    table.string('role', 50).notNullable().defaultTo('user');
    table.string('status', 50).notNullable().defaultTo('active');

    // 활동 정보
    table.timestamp('lastLoginAt');
    table.timestamp('lastActivityAt');
    
    // 타임스탬프
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('updatedAt').defaultTo(knex.fn.now());
    
    // 인덱스
    table.index(['gatrixUserId'], 'idx_users_gatrix_id');
    table.index(['email'], 'idx_users_email');
    table.index(['status'], 'idx_users_status');
    table.index(['lastActivityAt'], 'idx_users_last_activity');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('chat_users');
};
