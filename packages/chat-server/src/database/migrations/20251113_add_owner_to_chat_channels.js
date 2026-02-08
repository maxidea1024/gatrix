exports.up = async function (knex) {
  const tableName = 'chat_channels';
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;

  const addIfMissing = async (col, cb) => {
    const exists = await knex.schema.hasColumn(tableName, col);
    if (!exists) {
      await knex.schema.alterTable(tableName, cb);
    }
  };

  // ownerId column (owner of the channel)
  await addIfMissing('ownerId', (table) => {
    table.integer('ownerId').unsigned().nullable();
  });

  // updatedBy column (who last updated the channel)
  await addIfMissing('updatedBy', (table) => {
    table.integer('updatedBy').unsigned().nullable();
  });

  // archivedAt column (when the channel was archived)
  await addIfMissing('archivedAt', (table) => {
    table.timestamp('archivedAt').nullable();
  });

  // Try to backfill ownerId with createdBy where possible
  try {
    const hasOwnerId = await knex.schema.hasColumn(tableName, 'ownerId');
    const hasCreatedBy = await knex.schema.hasColumn(tableName, 'createdBy');
    if (hasOwnerId && hasCreatedBy) {
      await knex(tableName).whereNull('ownerId').update('ownerId', knex.raw('`createdBy`'));
    }
  } catch (e) {
    // Best-effort backfill; ignore if it fails
  }

  // Add foreign keys if supported and columns exist
  try {
    const hasUsers = await knex.schema.hasTable('chat_users');
    const hasOwnerId = await knex.schema.hasColumn(tableName, 'ownerId');
    const hasUpdatedBy = await knex.schema.hasColumn(tableName, 'updatedBy');

    if (hasUsers && hasOwnerId) {
      // MySQL requires separate raw statement to add FK conditionally; guard with try/catch
      await knex
        .raw(`ALTER TABLE ?? ADD INDEX ?? (??)`, [tableName, 'idx_channels_owner_id', 'ownerId'])
        .catch(() => {});
      await knex
        .raw(
          `ALTER TABLE ?? ADD CONSTRAINT ?? FOREIGN KEY (??) REFERENCES ??(id) ON DELETE SET NULL`,
          [tableName, 'fk_channels_owner_id', 'ownerId', 'chat_users']
        )
        .catch(() => {});
    }
    if (hasUsers && hasUpdatedBy) {
      await knex
        .raw(`ALTER TABLE ?? ADD INDEX ?? (??)`, [
          tableName,
          'idx_channels_updated_by',
          'updatedBy',
        ])
        .catch(() => {});
      await knex
        .raw(
          `ALTER TABLE ?? ADD CONSTRAINT ?? FOREIGN KEY (??) REFERENCES ??(id) ON DELETE SET NULL`,
          [tableName, 'fk_channels_updated_by', 'updatedBy', 'chat_users']
        )
        .catch(() => {});
    }
  } catch (e) {
    // Ignore FK add failures in dev
  }
};

exports.down = async function (knex) {
  const tableName = 'chat_channels';
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;

  // Drop FKs first
  try {
    await knex
      .raw(`ALTER TABLE ?? DROP FOREIGN KEY ??`, [tableName, 'fk_channels_owner_id'])
      .catch(() => {});
    await knex
      .raw(`ALTER TABLE ?? DROP FOREIGN KEY ??`, [tableName, 'fk_channels_updated_by'])
      .catch(() => {});
  } catch (e) {}

  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn('archivedAt');
    table.dropColumn('updatedBy');
    table.dropColumn('ownerId');
  });
};
