exports.up = function(knex) {
  return knex.schema.alterTable('chat_channel_invitations', function(table) {
    // 기존의 잘못된 유니크 키 제거
    table.dropUnique(['channelId', 'inviteeId', 'status'], 'uk_channel_invitee_pending');
    
    // pending 상태일 때만 중복을 방지하는 유니크 키 추가
    // MySQL에서는 조건부 유니크 키를 지원하지 않으므로 애플리케이션 레벨에서 처리
    // 대신 일반적인 인덱스 추가
    table.index(['channelId', 'inviteeId', 'status'], 'idx_channel_invitee_status');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('chat_channel_invitations', function(table) {
    // 인덱스 제거
    table.dropIndex(['channelId', 'inviteeId', 'status'], 'idx_channel_invitee_status');
    
    // 원래 유니크 키 복원
    table.unique(['channelId', 'inviteeId', 'status'], 'uk_channel_invitee_pending');
  });
};
