/**
 * 022 - Add autoJoinConfig column to g_invitations table
 *
 * Stores the auto-join configuration for organizations, projects, and role bindings
 * that should be applied when an invitation is accepted or a user is directly created.
 */

exports.name = 'invitation_auto_join';

exports.up = async function (connection) {
  console.log('[022] Adding autoJoinConfig column to g_invitations...');

  await connection.execute(`
    ALTER TABLE g_invitations
    ADD COLUMN autoJoinConfig JSON NULL COMMENT 'Auto-join orgs/projects/roles on acceptance'
  `);

  console.log('[022] ??autoJoinConfig column added to g_invitations');
};

exports.down = async function (connection) {
  console.log('[022] Removing autoJoinConfig column from g_invitations...');

  await connection.execute(`
    ALTER TABLE g_invitations
    DROP COLUMN autoJoinConfig
  `);

  console.log('[022] ??autoJoinConfig column removed from g_invitations');
};
