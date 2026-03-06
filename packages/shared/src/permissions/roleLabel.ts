/**
 * Infer a human-readable role label key from a list of permissions.
 *
 * Returns a translation key (e.g., 'roles.superAdmin') that can be
 * used with i18n to display the user's effective role.
 *
 * Priority:
 *   1. *:* or * → 'roles.superAdmin'
 *   2. Has any create/update/delete actions → 'roles.manager'
 *   3. Has any read/access actions → 'roles.viewer'
 *   4. No permissions → 'roles.member'
 */

import { PERMISSION_SEPARATOR, WILDCARD } from './types';

/**
 * Infer a role label i18n key from the user's effective permissions.
 */
export function inferRoleLabelKey(permissions: string[]): string {
  if (!permissions || permissions.length === 0) {
    return 'roles.member';
  }

  // Check for super admin (wildcard)
  for (const perm of permissions) {
    if (perm === '*' || perm === `${WILDCARD}${PERMISSION_SEPARATOR}${WILDCARD}`) {
      return 'roles.superAdmin';
    }
  }

  // Check for write permissions (create, update, delete)
  const writeActions = new Set(['create', 'update', 'delete']);
  let hasWrite = false;
  let hasRead = false;

  for (const perm of permissions) {
    const parts = perm.split(PERMISSION_SEPARATOR);
    if (parts.length < 2) continue;

    const action = parts[1];

    if (action === WILDCARD) {
      // resource:* means all actions including write
      hasWrite = true;
      break;
    }

    if (writeActions.has(action)) {
      hasWrite = true;
      break;
    }

    if (action === 'read' || action === 'access') {
      hasRead = true;
    }
  }

  if (hasWrite) {
    return 'roles.manager';
  }

  if (hasRead) {
    return 'roles.viewer';
  }

  return 'roles.member';
}

/**
 * Get a Chip color variant for the inferred role.
 */
export function getRoleLabelColor(roleLabelKey: string): 'error' | 'primary' | 'info' | 'default' {
  switch (roleLabelKey) {
    case 'roles.superAdmin':
      return 'error';
    case 'roles.manager':
      return 'primary';
    case 'roles.viewer':
      return 'info';
    default:
      return 'default';
  }
}
