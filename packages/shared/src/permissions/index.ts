/**
 * @gatrix/shared/permissions
 *
 * Single source of truth for RBAC permission definitions.
 * Used by both frontend and backend.
 */

// Constants
export {
  ACTIONS,
  SCOPES,
  RESOURCES,
  RESOURCE_SCOPES,
  RESOURCE_ACTIONS,
  P,
  type Action,
  type Scope,
  type Resource,
  type PermissionKey,
} from './constants';

// Types
export {
  type Permission,
  type PermissionSource,
  type ResolvedPermission,
  MAX_INHERITANCE_DEPTH,
  WILDCARD,
  PERMISSION_SEPARATOR,
  INSTANCE_WILDCARD,
} from './types';

// Matcher
export {
  matchSingle,
  hasPermission,
  checkPermission,
  hasAnyPermission,
  hasAllPermissions,
  getActionsForResource,
} from './matcher';

// Categories
export {
  type PermissionCategory,
  PERMISSION_CATEGORIES,
  getCategoriesByScope,
  getResourcesByScope,
} from './categories';

// Role Label inference
export { inferRoleLabelKey, getRoleLabelColor } from './roleLabel';
