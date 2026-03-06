/**
 * Permission type definitions
 */

/**
 * Permission string in resource:action format.
 * Supports wildcards: '*:*', 'resource:*', '*:action'
 */
export type Permission = string;

/**
 * Source of a permission grant for UI display
 */
export type PermissionSource =
  | { type: 'direct'; roleName: string }
  | { type: 'group'; roleName: string; groupName: string }
  | { type: 'inherited'; roleName: string; parentRoleName: string };

/**
 * Resolved permission with source information for preview UI
 */
export interface ResolvedPermission {
  resource: string;
  action: string;
  permission: string;
  source: PermissionSource;
}

/**
 * Maximum depth for role inheritance traversal
 */
export const MAX_INHERITANCE_DEPTH = 5;

/**
 * Wildcard character
 */
export const WILDCARD = '*';

/**
 * Permission separator (resource:action)
 */
export const PERMISSION_SEPARATOR = ':';

/**
 * Instance wildcard for projectId/environmentId
 */
export const INSTANCE_WILDCARD = '*';
