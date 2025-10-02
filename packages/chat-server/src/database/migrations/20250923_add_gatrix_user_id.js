exports.up = function(knex) {
  return knex.schema.alterTable('chat_users', function(table) {
    // gatrixUserId 컬럼 다시 추가
    table.bigInteger('gatrixUserId').unsigned().nullable().unique();
    
    // 인덱스 추가
    table.index(['gatrixUserId'], 'idx_users_gatrix_id');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('chat_users', function(table) {
    // gatrixUserId 컬럼 제거
    table.dropIndex(['gatrixUserId'], 'idx_users_gatrix_id');
    table.dropColumn('gatrixUserId');
  });
};
