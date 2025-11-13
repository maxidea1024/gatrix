exports.up = async function(knex) {
  // Update chat_messages table to align with MessageModel expectations
  const messagesTable = 'chat_messages';
  const attachmentsTable = 'chat_message_attachments';

  const hasMessages = await knex.schema.hasTable(messagesTable);
  if (hasMessages) {
    const addIfMissing = async (col, cb) => {
      const exists = await knex.schema.hasColumn(messagesTable, col);
      if (!exists) {
        await knex.schema.alterTable(messagesTable, cb);
      }
    };

    // Content type for richer messages
    await addIfMissing('contentType', (table) => {
      table.enum('contentType', ['text', 'image', 'video', 'audio', 'file', 'location', 'system']).defaultTo('text');
    });

    // JSON payload for structured message content
    await addIfMissing('messageData', (table) => {
      table.json('messageData').nullable();
    });

    // Reply-to and thread support
    await addIfMissing('replyToMessageId', (table) => {
      table.integer('replyToMessageId').unsigned().nullable();
      // FK best-effort (ignore if fails)
      knex.raw(
        'ALTER TABLE ?? ADD INDEX ?? (??)',
        [messagesTable, 'idx_messages_reply_to', 'replyToMessageId']
      ).catch(() => {});
    });

    await addIfMissing('threadId', (table) => {
      table.integer('threadId').unsigned().nullable();
      knex.raw(
        'ALTER TABLE ?? ADD INDEX ?? (??)',
        [messagesTable, 'idx_messages_thread_id', 'threadId']
      ).catch(() => {});
    });

    // Flags and soft delete
    await addIfMissing('isEdited', (table) => {
      table.boolean('isEdited').defaultTo(false);
    });

    await addIfMissing('isDeleted', (table) => {
      table.boolean('isDeleted').defaultTo(false);
      knex.raw(
        'ALTER TABLE ?? ADD INDEX ?? (??)',
        [messagesTable, 'idx_messages_is_deleted', 'isDeleted']
      ).catch(() => {});
    });

    await addIfMissing('isPinned', (table) => {
      table.boolean('isPinned').defaultTo(false);
    });

    await addIfMissing('deletedAt', (table) => {
      table.timestamp('deletedAt').nullable();
    });

    // System message support (optional)
    await addIfMissing('systemMessageType', (table) => {
      table.string('systemMessageType', 50).nullable();
    });

    await addIfMissing('systemMessageData', (table) => {
      table.json('systemMessageData').nullable();
    });
  }

  // Update chat_message_attachments: ensure uploadStatus exists
  const hasAttachments = await knex.schema.hasTable(attachmentsTable);
  if (hasAttachments) {
    const hasUploadStatus = await knex.schema.hasColumn(attachmentsTable, 'uploadStatus');
    if (!hasUploadStatus) {
      await knex.schema.alterTable(attachmentsTable, (table) => {
        table.enum('uploadStatus', ['pending', 'completed', 'failed']).defaultTo('completed');
      });
    }
  }
};

exports.down = async function(knex) {
  const messagesTable = 'chat_messages';
  const attachmentsTable = 'chat_message_attachments';

  const hasMessages = await knex.schema.hasTable(messagesTable);
  if (hasMessages) {
    await knex.schema.alterTable(messagesTable, (table) => {
      // Drop in safe order
      table.dropColumn('systemMessageData');
      table.dropColumn('systemMessageType');
      table.dropColumn('deletedAt');
      table.dropColumn('isPinned');
      table.dropColumn('isDeleted');
      table.dropColumn('isEdited');
      table.dropColumn('threadId');
      table.dropColumn('replyToMessageId');
      table.dropColumn('messageData');
      table.dropColumn('contentType');
    });
  }

  const hasAttachments = await knex.schema.hasTable(attachmentsTable);
  if (hasAttachments) {
    const hasUploadStatus = await knex.schema.hasColumn(attachmentsTable, 'uploadStatus');
    if (hasUploadStatus) {
      await knex.schema.alterTable(attachmentsTable, (table) => {
        table.dropColumn('uploadStatus');
      });
    }
  }
};

