/*
  Update chat_channel_invitations schema to match model expectations
  - Rename/add inviterId/inviteeId columns (keep old columns for now)
  - Expand status enum values
  - Add optional fields: message, expiresAt, updatedAt
*/

exports.up = async function up(knex) {
  const tableName = 'chat_channel_invitations';
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;

  // Helper to add column if missing via alterTable callback
  const addIfMissing = async (col, cb) => {
    const exists = await knex.schema.hasColumn(tableName, col);
    if (!exists) {
      await knex.schema.alterTable(tableName, cb);
    }
  };

  // Add inviteeId if missing and backfill from invitedUserId when available
  const hasInvitedUserId = await knex.schema.hasColumn(tableName, 'invitedUserId');
  const hasInviteeId = await knex.schema.hasColumn(tableName, 'inviteeId');
  if (!hasInviteeId) {
    await knex.schema.alterTable(tableName, (table) => {
      table.integer('inviteeId').unsigned().nullable().after('channelId');
    });
    if (hasInvitedUserId) {
      await knex.raw(`UPDATE ${tableName} SET inviteeId = invitedUserId`);
    }
    // Make it not nullable after backfill if table is not empty
    await knex.schema.alterTable(tableName, (table) => {
      table.integer('inviteeId').unsigned().notNullable().alter();
    });
  }

  // Add inviterId if missing and backfill from invitedBy
  const hasInvitedBy = await knex.schema.hasColumn(tableName, 'invitedBy');
  const hasInviterId = await knex.schema.hasColumn(tableName, 'inviterId');
  if (!hasInviterId) {
    await knex.schema.alterTable(tableName, (table) => {
      table.integer('inviterId').unsigned().nullable().after('inviteeId');
    });
    if (hasInvitedBy) {
      await knex.raw(`UPDATE ${tableName} SET inviterId = invitedBy`);
    }
    await knex.schema.alterTable(tableName, (table) => {
      table.integer('inviterId').unsigned().notNullable().alter();
    });
  }

  // Add message, expiresAt, updatedAt if missing
  await addIfMissing('message', (table) => {
    table.text('message').nullable().after('status');
  });

  await addIfMissing('expiresAt', (table) => {
    table.timestamp('expiresAt').nullable().after('message');
  });

  const hasUpdatedAt = await knex.schema.hasColumn(tableName, 'updatedAt');
  if (!hasUpdatedAt) {
    await knex.schema.alterTable(tableName, (table) => {
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
    });
  }

  // Normalize status values: map 'rejected' -> 'declined'
  try {
    await knex.raw(`UPDATE ${tableName} SET status = 'declined' WHERE status = 'rejected'`);
  } catch (e) {
    // ignore if column values or enum don't allow it yet, will be handled by enum alter below
  }

  // Expand enum values for status
  // MySQL requires raw SQL to change ENUM definition
  try {
    await knex.raw(
      `ALTER TABLE ${tableName} MODIFY COLUMN status ENUM('pending','accepted','declined','expired','cancelled') DEFAULT 'pending'`
    );
  } catch (e) {
    // If table uses a different type, ignore
  }

  // Keep legacy columns for now to avoid breaking old code paths
  // Future migration can drop invitedUserId/invitedBy after all code is updated
};

exports.down = async function down(knex) {
  const tableName = 'chat_channel_invitations';
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;

  // Best-effort rollback: collapse enum and keep data
  try {
    // Map newer statuses back to closest legacy values
    await knex.raw(`UPDATE ${tableName} SET status = 'accepted' WHERE status = 'accepted'`);
    await knex.raw(`UPDATE ${tableName} SET status = 'pending' WHERE status IN ('pending')`);
    await knex.raw(`UPDATE ${tableName} SET status = 'rejected' WHERE status IN ('declined','expired','cancelled')`);
    await knex.raw(
      `ALTER TABLE ${tableName} MODIFY COLUMN status ENUM('pending','accepted','rejected') DEFAULT 'pending'`
    );
  } catch (e) {
    // ignore
  }

  // No column drops in down() to avoid potential data loss
};

