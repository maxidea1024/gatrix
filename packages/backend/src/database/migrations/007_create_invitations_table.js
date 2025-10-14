/**
 * Create g_invitations table for user invitation system
 * This table stores invitations sent to users to join the platform
 */

exports.up = async function(connection) {
  // Connection is provided by the migration system

  console.log('Creating g_invitations table...');

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_invitations (
      id VARCHAR(36) PRIMARY KEY COMMENT 'UUID for invitation',
      token VARCHAR(36) NOT NULL UNIQUE COMMENT 'Unique token for invitation link',
      email VARCHAR(255) NOT NULL COMMENT 'Email address of the invitee',
      role VARCHAR(50) NOT NULL DEFAULT 'user' COMMENT 'Role to assign to user when they accept',
      isActive BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether invitation is still active',
      expiresAt TIMESTAMP NOT NULL COMMENT 'When the invitation expires',
      usedAt TIMESTAMP NULL COMMENT 'When the invitation was used',
      usedBy INT NULL COMMENT 'User ID who used the invitation',
      createdBy INT NOT NULL COMMENT 'User ID who created the invitation',
      updatedBy INT NULL COMMENT 'User ID who last updated the invitation',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      -- Indexes for performance
      INDEX idx_invitations_email (email),
      INDEX idx_invitations_token (token),
      INDEX idx_invitations_active (isActive),
      INDEX idx_invitations_expires (expiresAt),
      INDEX idx_invitations_created_by (createdBy),
      INDEX idx_invitations_used_by (usedBy),
      
      -- Foreign key constraints
      CONSTRAINT fk_invitations_creator FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_invitations_updater FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_invitations_used_by FOREIGN KEY (usedBy) REFERENCES g_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='User invitation system'
  `);

  console.log('✓ g_invitations table created successfully');
};

exports.down = async function(connection) {
  // Connection is provided by the migration system
  console.log('Dropping g_invitations table...');

  await connection.execute(`DROP TABLE IF EXISTS g_invitations`);

  console.log('✓ g_invitations table dropped successfully');
};
