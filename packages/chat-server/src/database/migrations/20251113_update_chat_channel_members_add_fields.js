exports.up = async function(knex) {
  const tableName = 'chat_channel_members';
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;

  const addIfMissing = async (col, cb) => {
    const exists = await knex.schema.hasColumn(tableName, col);
    if (!exists) {
      await knex.schema.alterTable(tableName, cb);
    }
  };

  // status for membership state
  await addIfMissing('status', (table) => {
    table.enum('status', ['active', 'muted', 'banned', 'left']).defaultTo('active');
  });

  // unread count
  await addIfMissing('unreadCount', (table) => {
    table.integer('unreadCount').unsigned().defaultTo(0);
  });

  // last read timestamp
  await addIfMissing('lastReadAt', (table) => {
    table.timestamp('lastReadAt').nullable();
  });

  // notification settings JSON
  await addIfMissing('notificationSettings', (table) => {
    table.json('notificationSettings').nullable();
  });
};

exports.down = async function(knex) {
  const tableName = 'chat_channel_members';
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;

  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn('notificationSettings');
    table.dropColumn('lastReadAt');
    table.dropColumn('unreadCount');
    table.dropColumn('status');
  });
};

