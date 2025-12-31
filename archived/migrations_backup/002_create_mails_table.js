/**
 * Create g_mails table for internal messaging system
 * Created: 2025-10-17
 */

exports.up = async function(connection) {
  console.log('Recreating g_mails table with correct schema...');

  // Drop the table if it exists (to fix schema mismatch from 001_initial_schema.js)
  await connection.execute('DROP TABLE IF EXISTS g_mails');

  await connection.execute(`
    CREATE TABLE g_mails (
      id INT AUTO_INCREMENT PRIMARY KEY,
      
      -- Sender information (NULL for system messages)
      senderId INT NULL,
      senderName VARCHAR(255) NULL,
      
      -- Recipient information
      recipientId INT NOT NULL,
      
      -- Mail content
      subject VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      contentType VARCHAR(50) NOT NULL DEFAULT 'text',
      
      -- Mail metadata
      mailType VARCHAR(50) NOT NULL DEFAULT 'user',
      priority VARCHAR(20) NOT NULL DEFAULT 'normal',
      category VARCHAR(100) NULL,
      
      -- Mail status
      isRead BOOLEAN NOT NULL DEFAULT FALSE,
      readAt TIMESTAMP NULL,
      isDeleted BOOLEAN NOT NULL DEFAULT FALSE,
      deletedAt TIMESTAMP NULL,
      isStarred BOOLEAN NOT NULL DEFAULT FALSE,
      
      -- Additional data (JSON)
      mailData JSON NULL,
      
      -- Timestamps
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      -- Indexes
      INDEX idx_recipient (recipientId, isDeleted, createdAt),
      INDEX idx_sender (senderId, createdAt),
      INDEX idx_read_status (recipientId, isRead, isDeleted),
      INDEX idx_mail_type (mailType, recipientId),
      INDEX idx_category (category, recipientId),
      INDEX idx_starred (recipientId, isStarred, isDeleted),
      
      -- Foreign keys
      FOREIGN KEY (senderId) REFERENCES g_users(id) ON DELETE SET NULL,
      FOREIGN KEY (recipientId) REFERENCES g_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('g_mails table created successfully');
};

exports.down = async function(connection) {
  console.log('Dropping g_mails table...');
  await connection.execute('DROP TABLE IF EXISTS g_mails');
  console.log('g_mails table dropped');
};

