exports.up = function(knex) {
  return knex.schema.createTable('chat_channel_invitations', function(table) {
    table.bigIncrements('id').primary();
    table.bigInteger('channelId').unsigned().notNullable();
    table.bigInteger('inviterId').unsigned().notNullable();
    table.bigInteger('inviteeId').unsigned().notNullable();
    
    // 초대 상태
    table.enum('status', ['pending', 'accepted', 'declined', 'expired', 'cancelled']).defaultTo('pending');
    
    // 초대 메시지 (선택사항)
    table.text('message');
    
    // 만료 시간
    table.timestamp('expiresAt');
    
    // 응답 시간
    table.timestamp('respondedAt');
    
    // 타임스탬프
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('updatedAt').defaultTo(knex.fn.now());
    
    // 제약 조건 - 같은 채널에 같은 사용자를 중복 초대 방지 (pending 상태일 때만)
    // 주의: 이 제약조건은 pending 상태일 때만 적용되어야 하지만, MySQL에서는 조건부 유니크 키를 지원하지 않음
    // 대신 애플리케이션 레벨에서 중복 체크를 수행
    // table.unique(['channelId', 'inviteeId', 'status'], 'uk_channel_invitee_pending');
    
    // 인덱스
    table.index(['channelId'], 'idx_invitations_channel');
    table.index(['inviterId'], 'idx_invitations_inviter');
    table.index(['inviteeId'], 'idx_invitations_invitee');
    table.index(['status'], 'idx_invitations_status');
    table.index(['expiresAt'], 'idx_invitations_expires');
    table.index(['createdAt'], 'idx_invitations_created');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('chat_channel_invitations');
};
