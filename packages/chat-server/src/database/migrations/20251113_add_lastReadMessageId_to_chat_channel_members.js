exports.up = async function(knex) {
  const tableName = 'chat_channel_members';
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;

  const hasColumn = await knex.schema.hasColumn(tableName, 'lastReadMessageId');
  if (!hasColumn) {
    await knex.schema.alterTable(tableName, (table) => {
      table.integer('lastReadMessageId').unsigned().nullable();
      table.index(['lastReadMessageId'], 'idx_ccm_last_read_msg');
    });
  }
};

exports.down = async function(knex) {
  const tableName = 'chat_channel_members';
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;

  const hasColumn = await knex.schema.hasColumn(tableName, 'lastReadMessageId');
  if (hasColumn) {
    await knex.schema.alterTable(tableName, (table) => {
      table.dropIndex(['lastReadMessageId'], 'idx_ccm_last_read_msg');
      table.dropColumn('lastReadMessageId');
    });
  }
};

