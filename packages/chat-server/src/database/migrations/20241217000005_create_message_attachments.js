/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // 채널 초대 테이블
    .createTableIfNotExists('chat_channel_invitations', (table) => {
      table.increments('id').primary();
      table.integer('channelId').notNullable();
      table.integer('inviterId').notNullable();
      table.integer('inviteeId').notNullable();
      table.text('message').nullable();
      table.enum('status', ['pending', 'accepted', 'declined', 'expired']).notNullable().defaultTo('pending');
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
      table.timestamp('expiresAt').nullable();

      table.index('channelId', 'idx_channel_invitations_channel');
      table.index('inviterId', 'idx_channel_invitations_inviter');
      table.index('inviteeId', 'idx_channel_invitations_invitee');
      table.index('status', 'idx_channel_invitations_status');
      table.index('expiresAt', 'idx_channel_invitations_expires');
      table.unique(['channelId', 'inviteeId', 'status'], { indexName: 'unique_pending_invitation' });
    })
    // 사용자 프라이버시 설정 테이블
    .createTableIfNotExists('chat_user_privacy_settings', (table) => {
      table.increments('id').primary();
      table.integer('userId').notNullable();
      table.enum('allowDirectMessages', ['everyone', 'friends', 'none']).notNullable().defaultTo('everyone');
      table.enum('allowChannelInvites', ['everyone', 'friends', 'none']).notNullable().defaultTo('everyone');
      table.enum('allowGroupInvites', ['everyone', 'friends', 'none']).notNullable().defaultTo('everyone');
      table.boolean('showOnlineStatus').notNullable().defaultTo(true);
      table.boolean('showLastSeen').notNullable().defaultTo(true);
      table.boolean('allowReadReceipts').notNullable().defaultTo(true);
      table.boolean('allowTypingIndicators').notNullable().defaultTo(true);
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.timestamp('updatedAt').defaultTo(knex.fn.now());

      table.unique('userId', { indexName: 'unique_user_privacy' });
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('chat_user_privacy_settings')
    .dropTableIfExists('chat_channel_invitations');
};
