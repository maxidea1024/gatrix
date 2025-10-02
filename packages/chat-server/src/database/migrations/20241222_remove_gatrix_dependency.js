exports.up = function(knex) {
  return knex.schema.alterTable('chat_users', function(table) {
    // gatrixUserId 컬럼 제거
    table.dropColumn('gatrixUserId');
    
    // 채팅서버 독립 사용을 위한 필드 추가
    table.string('username', 255).notNullable().unique();
    table.enum('chatStatus', ['online', 'away', 'busy', 'offline']).defaultTo('offline');
    table.string('customStatus', 255);
    
    // 인덱스 추가
    table.index(['username'], 'idx_users_username');
    table.index(['chatStatus'], 'idx_users_chat_status');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('chat_users', function(table) {
    // 롤백: 추가된 컬럼들 제거
    table.dropColumn('username');
    table.dropColumn('chatStatus');
    table.dropColumn('customStatus');
    
    // gatrixUserId 복원
    table.bigInteger('gatrixUserId').unsigned().notNullable().unique();
    table.index(['gatrixUserId'], 'idx_users_gatrix_id');
  });
};
