exports.up = function(knex) {
  return knex.schema.createTable('chat_user_privacy_settings', function(table) {
    table.bigInteger('userId').unsigned().primary();
    
    // 채널 초대 설정
    table.enum('channelInvitePolicy', ['everyone', 'contacts_only', 'nobody']).defaultTo('everyone');
    
    // 1:1 대화 설정  
    table.enum('directMessagePolicy', ['everyone', 'contacts_only', 'nobody']).defaultTo('everyone');
    
    // 사용자 검색 설정
    table.boolean('discoverableByEmail').defaultTo(true);
    table.boolean('discoverableByName').defaultTo(true);
    
    // 연락처/친구 시스템 (향후 확장용)
    table.boolean('requireFriendRequest').defaultTo(false);
    
    // 차단 목록 (JSON 배열로 사용자 ID 저장)
    table.json('blockedUsers').defaultTo('[]');
    
    // 타임스탬프
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('updatedAt').defaultTo(knex.fn.now());
    
    // 인덱스
    table.index(['channelInvitePolicy'], 'idx_privacy_channel_invite');
    table.index(['directMessagePolicy'], 'idx_privacy_direct_message');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('chat_user_privacy_settings');
};
