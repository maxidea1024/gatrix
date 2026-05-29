/**
 * 019 - Project Members
 *
 * Add g_project_members table for direct project membership management.
 * Members get basic access to the project without needing role-based assignments.
 */

exports.name = 'project_members';

exports.up = async function (connection) {
  console.log('[019] Creating g_project_members table...');

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_project_members (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      projectId CHAR(26) NOT NULL,
      userId CHAR(26) NOT NULL,
      projectRole ENUM('admin', 'member') NOT NULL DEFAULT 'member',
      joinedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      invitedBy CHAR(26) NULL,
      UNIQUE KEY uniq_project_user (projectId, userId),
      CONSTRAINT fk_projmem_project FOREIGN KEY (projectId) REFERENCES g_projects(id) ON DELETE CASCADE,
      CONSTRAINT fk_projmem_user FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE,
      INDEX idx_project_id (projectId),
      INDEX idx_user_id (userId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[019] ??g_project_members table created');
};

exports.down = async function (connection) {
  await connection.execute('DROP TABLE IF EXISTS g_project_members');
  console.log('[019] ??g_project_members table dropped');
};
