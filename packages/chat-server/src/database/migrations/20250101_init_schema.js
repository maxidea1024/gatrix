exports.up = async function(knex) {
  // Create users table FIRST (referenced by other tables)
  if (!(await knex.schema.hasTable('chat_users'))) {
    await knex.schema.createTable('chat_users', (table) => {
    table.increments('id').primary().unsigned();
    table.integer('gatrixUserId').nullable().unique();
    table.string('username', 255).notNullable().unique();
    table.string('email', 255).nullable();
    table.string('avatar', 255).nullable();
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('updatedAt').defaultTo(knex.fn.now());
    table.index('gatrixUserId', 'idx_users_gatrix_user_id');
  });

    // Insert system user for API tokens
    await knex('chat_users').insert({
      id: 1,
      username: 'system',
      email: 'system@gatrix.local',
      avatar: null,
      gatrixUserId: null,
    });
  }

  // Create channels table
  if (!(await knex.schema.hasTable('chat_channels'))) {
    await knex.schema.createTable('chat_channels', (table) => {
    table.increments('id').primary().unsigned();
    table.string('channelName', 255).notNullable();
    table.text('description').nullable();
    table.enum('type', ['direct', 'group', 'public']).notNullable();
    table.integer('createdBy').unsigned().notNullable();
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('updatedAt').defaultTo(knex.fn.now());
    table.foreign('createdBy').references('id').inTable('chat_users').onDelete('CASCADE');
    table.index('type', 'idx_channels_type');
    table.index('createdBy', 'idx_channels_created_by');
  });
  }

  // Create channel members table
  if (!(await knex.schema.hasTable('chat_channel_members'))) {
    await knex.schema.createTable('chat_channel_members', (table) => {
    table.increments('id').primary().unsigned();
    table.integer('channelId').unsigned().notNullable();
    table.integer('userId').unsigned().notNullable();
    table.enum('role', ['owner', 'admin', 'member']).defaultTo('member');
    table.timestamp('joinedAt').defaultTo(knex.fn.now());
    table.foreign('channelId').references('id').inTable('chat_channels').onDelete('CASCADE');
    table.foreign('userId').references('id').inTable('chat_users').onDelete('CASCADE');
    table.unique(['channelId', 'userId']);
    table.index('userId', 'idx_channel_members_user_id');
  });
  }

  // Create messages table
  if (!(await knex.schema.hasTable('chat_messages'))) {
    await knex.schema.createTable('chat_messages', (table) => {
    table.increments('id').primary().unsigned();
    table.integer('channelId').unsigned().notNullable();
    table.integer('userId').unsigned().notNullable();
    table.text('content').notNullable();
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('updatedAt').defaultTo(knex.fn.now());
    table.foreign('channelId').references('id').inTable('chat_channels').onDelete('CASCADE');
    table.foreign('userId').references('id').inTable('chat_users').onDelete('CASCADE');
    table.index('channelId', 'idx_messages_channel_id');
    table.index('userId', 'idx_messages_user_id');
    table.index('createdAt', 'idx_messages_created_at');
  });
  }

  // Create message attachments table
  if (!(await knex.schema.hasTable('chat_message_attachments'))) {
    await knex.schema.createTable('chat_message_attachments', (table) => {
    table.increments('id').primary().unsigned();
    table.integer('messageId').unsigned().notNullable();
    table.string('fileName', 255).notNullable();
    table.string('fileUrl', 255).notNullable();
    table.string('fileType', 100).nullable();
    table.bigInteger('fileSize').nullable();
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.foreign('messageId').references('id').inTable('chat_messages').onDelete('CASCADE');
    table.index('messageId', 'idx_attachments_message_id');
  });
  }

  // Create message reactions table
  if (!(await knex.schema.hasTable('chat_message_reactions'))) {
    await knex.schema.createTable('chat_message_reactions', (table) => {
    table.increments('id').primary().unsigned();
    table.integer('messageId').unsigned().notNullable();
    table.integer('userId').unsigned().notNullable();
    table.string('emoji', 50).notNullable();
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.foreign('messageId').references('id').inTable('chat_messages').onDelete('CASCADE');
    table.foreign('userId').references('id').inTable('chat_users').onDelete('CASCADE');
    table.unique(['messageId', 'userId', 'emoji']);
    table.index('messageId', 'idx_reactions_message_id');
    table.index('userId', 'idx_reactions_user_id');
  });
  }

  // Create user privacy settings table
  if (!(await knex.schema.hasTable('chat_user_privacy_settings'))) {
    await knex.schema.createTable('chat_user_privacy_settings', (table) => {
    table.increments('id').primary().unsigned();
    table.integer('userId').unsigned().notNullable().unique();
    table.boolean('allowDirectMessages').defaultTo(true);
    table.boolean('allowGroupInvites').defaultTo(true);
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('updatedAt').defaultTo(knex.fn.now());
    table.foreign('userId').references('id').inTable('chat_users').onDelete('CASCADE');
  });
  }

  // Create channel invitations table
  if (!(await knex.schema.hasTable('chat_channel_invitations'))) {
    await knex.schema.createTable('chat_channel_invitations', (table) => {
    table.increments('id').primary().unsigned();
    table.integer('channelId').unsigned().notNullable();
    table.integer('invitedUserId').unsigned().notNullable();
    table.integer('invitedBy').unsigned().notNullable();
    table.enum('status', ['pending', 'accepted', 'rejected']).defaultTo('pending');
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('respondedAt').nullable();
    table.foreign('channelId').references('id').inTable('chat_channels').onDelete('CASCADE');
    table.foreign('invitedUserId').references('id').inTable('chat_users').onDelete('CASCADE');
    table.foreign('invitedBy').references('id').inTable('chat_users').onDelete('CASCADE');
    table.unique(['channelId', 'invitedUserId']);
    table.index('invitedUserId', 'idx_invitations_invited_user_id');
    table.index('status', 'idx_invitations_status');
  });
  }

  // Create API tokens table
  if (!(await knex.schema.hasTable('chat_api_tokens'))) {
    await knex.schema.createTable('chat_api_tokens', (table) => {
    table.increments('id').primary().unsigned();
    table.string('tokenName', 255).notNullable();
    table.string('tokenHash', 255).notNullable().unique();
    table.enum('tokenType', ['client', 'server']).notNullable();
    table.json('permissions').nullable();
    table.text('description').nullable();
    table.timestamp('expiresAt').nullable();
    table.timestamp('lastUsedAt').nullable();
    table.bigInteger('usageCount').defaultTo(0);
    table.boolean('isActive').defaultTo(true);
    table.integer('createdBy').unsigned().nullable(); // Changed to nullable to allow system tokens
    table.integer('updatedBy').unsigned().nullable();
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('updatedAt').defaultTo(knex.fn.now());
    table.index('tokenType', 'idx_token_type');
    table.index('createdBy', 'idx_created_by');
    table.index('createdAt', 'idx_created_at');
    table.index('lastUsedAt', 'idx_last_used_at');
    table.index('expiresAt', 'idx_expires_at');
    table.index('isActive', 'idx_is_active');
  });
  }

  // Create additional tables
  if (!(await knex.schema.hasTable('chat_channel_stats'))) {
    await knex.schema.createTable('chat_channel_stats', (table) => {
    table.increments('id').primary().unsigned();
    table.integer('channelId').unsigned().notNullable().unique();
    table.integer('memberCount').defaultTo(0);
    table.integer('messageCount').defaultTo(0);
    table.timestamp('lastMessageAt').nullable();
    table.timestamp('updatedAt').defaultTo(knex.fn.now());
    table.foreign('channelId').references('id').inTable('chat_channels').onDelete('CASCADE');
  });
  }

  if (!(await knex.schema.hasTable('chat_user_stats'))) {
    await knex.schema.createTable('chat_user_stats', (table) => {
    table.increments('id').primary().unsigned();
    table.integer('userId').unsigned().notNullable().unique();
    table.integer('messageCount').defaultTo(0);
    table.integer('channelCount').defaultTo(0);
    table.timestamp('lastActiveAt').nullable();
    table.timestamp('updatedAt').defaultTo(knex.fn.now());
    table.foreign('userId').references('id').inTable('chat_users').onDelete('CASCADE');
  });
  }

  if (!(await knex.schema.hasTable('chat_user_presence'))) {
    await knex.schema.createTable('chat_user_presence', (table) => {
    table.increments('id').primary().unsigned();
    table.integer('userId').unsigned().notNullable().unique();
    table.enum('status', ['online', 'offline', 'away']).defaultTo('offline');
    table.timestamp('lastSeenAt').nullable();
    table.timestamp('updatedAt').defaultTo(knex.fn.now());
    table.foreign('userId').references('id').inTable('chat_users').onDelete('CASCADE');
  });
  }

  if (!(await knex.schema.hasTable('chat_user_blocks'))) {
    await knex.schema.createTable('chat_user_blocks', (table) => {
    table.increments('id').primary().unsigned();
    table.integer('userId').unsigned().notNullable();
    table.integer('blockedUserId').unsigned().notNullable();
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.foreign('userId').references('id').inTable('chat_users').onDelete('CASCADE');
    table.foreign('blockedUserId').references('id').inTable('chat_users').onDelete('CASCADE');
    table.unique(['userId', 'blockedUserId']);
    table.index('userId', 'idx_blocks_user_id');
    table.index('blockedUserId', 'idx_blocks_blocked_user_id');
  });
  }

  if (!(await knex.schema.hasTable('chat_notifications'))) {
    await knex.schema.createTable('chat_notifications', (table) => {
    table.increments('id').primary().unsigned();
    table.integer('userId').unsigned().notNullable();
    table.string('type', 100).notNullable();
    table.text('content').nullable();
    table.boolean('isRead').defaultTo(false);
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.foreign('userId').references('id').inTable('chat_users').onDelete('CASCADE');
    table.index('userId', 'idx_notifications_user_id');
    table.index('isRead', 'idx_notifications_is_read');
  });
  }

  if (!(await knex.schema.hasTable('chat_typing_indicators'))) {
    await knex.schema.createTable('chat_typing_indicators', (table) => {
    table.increments('id').primary().unsigned();
    table.integer('channelId').unsigned().notNullable();
    table.integer('userId').unsigned().notNullable();
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.foreign('channelId').references('id').inTable('chat_channels').onDelete('CASCADE');
    table.foreign('userId').references('id').inTable('chat_users').onDelete('CASCADE');
    table.unique(['channelId', 'userId']);
  });
  }

  if (!(await knex.schema.hasTable('chat_message_queue'))) {
    await knex.schema.createTable('chat_message_queue', (table) => {
    table.increments('id').primary().unsigned();
    table.integer('messageId').unsigned().nullable();
    table.text('content').notNullable();
    table.enum('status', ['pending', 'sent', 'failed']).defaultTo('pending');
    table.integer('retryCount').defaultTo(0);
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    table.timestamp('sentAt').nullable();
  });
  }

  if (!(await knex.schema.hasTable('chat_message_search_index'))) {
    await knex.schema.createTable('chat_message_search_index', (table) => {
    table.increments('id').primary().unsigned();
    table.integer('messageId').unsigned().notNullable().unique();
    table.text('content').notNullable();
    table.integer('channelId').unsigned().notNullable();
    table.timestamp('createdAt').defaultTo(knex.fn.now());
    // Note: fulltext index is not supported by Knex, use raw SQL if needed
    table.index('channelId', 'idx_search_channel_id');
  });
  }

  if (!(await knex.schema.hasTable('chat_server_metrics'))) {
    await knex.schema.createTable('chat_server_metrics', (table) => {
    table.increments('id').primary().unsigned();
    table.integer('activeConnections').defaultTo(0);
    table.integer('totalMessages').defaultTo(0);
    table.integer('totalChannels').defaultTo(0);
    table.integer('totalUsers').defaultTo(0);
    table.timestamp('recordedAt').defaultTo(knex.fn.now());
    table.index('recordedAt', 'idx_metrics_recorded_at');
  });
  }
};

exports.down = async function(knex) {
  // Drop all tables in reverse order
  await knex.schema.dropTableIfExists('chat_server_metrics');
  await knex.schema.dropTableIfExists('chat_message_search_index');
  await knex.schema.dropTableIfExists('chat_message_queue');
  await knex.schema.dropTableIfExists('chat_typing_indicators');
  await knex.schema.dropTableIfExists('chat_notifications');
  await knex.schema.dropTableIfExists('chat_user_blocks');
  await knex.schema.dropTableIfExists('chat_user_presence');
  await knex.schema.dropTableIfExists('chat_user_stats');
  await knex.schema.dropTableIfExists('chat_channel_stats');
  await knex.schema.dropTableIfExists('chat_api_tokens');
  await knex.schema.dropTableIfExists('chat_channel_invitations');
  await knex.schema.dropTableIfExists('chat_user_privacy_settings');
  await knex.schema.dropTableIfExists('chat_message_reactions');
  await knex.schema.dropTableIfExists('chat_message_attachments');
  await knex.schema.dropTableIfExists('chat_messages');
  await knex.schema.dropTableIfExists('chat_channel_members');
  await knex.schema.dropTableIfExists('chat_users');
  await knex.schema.dropTableIfExists('chat_channels');
};

