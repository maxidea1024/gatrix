/**
 * Permission Matcher
 *
 * Supports wildcard matching:
 *   *:*       — matches everything
 *   users:*   — matches users:create, users:read, etc.
 *   *:read    — matches users:read, features:read, etc.
 */

import { PERMISSION_SEPARATOR, WILDCARD } from './types';

/**
 * Check if a single user permission matches a required permission.
 * Supports wildcards on either side.
 */
export function matchSingle(userPerm: string, required: string): boolean {
  if (userPerm === `${WILDCARD}${PERMISSION_SEPARATOR}${WILDCARD}`) {
    return true;
  }

  if (userPerm === required) {
    return true;
  }

  const [userResource, userAction] = userPerm.split(PERMISSION_SEPARATOR);
  const [reqResource, reqAction] = required.split(PERMISSION_SEPARATOR);

  if (!userResource || !userAction || !reqResource || !reqAction) {
    return false;
  }

  const resourceMatch =
    userResource === WILDCARD || userResource === reqResource;
  const actionMatch = userAction === WILDCARD || userAction === reqAction;

  return resourceMatch && actionMatch;
}

/**
 * Check if the user has a specific permission.
 * Checks all user permissions for a match (including wildcards).
 */
export function hasPermission(
  userPermissions: string[],
  resource: string,
  action: string
): boolean {
  const required = `${resource}${PERMISSION_SEPARATOR}${action}`;
  return userPermissions.some((perm) => matchSingle(perm, required));
}

/**
 * Check if the user has the given permission string.
 */
export function checkPermission(
  userPermissions: string[],
  required: string
): boolean {
  return userPermissions.some((perm) => matchSingle(perm, required));
}

/**
 * Check if the user has ANY of the given permissions.
 */
export function hasAnyPermission(
  userPermissions: string[],
  requiredPermissions: string[]
): boolean {
  return requiredPermissions.some((req) =>
    userPermissions.some((perm) => matchSingle(perm, req))
  );
}

/**
 * Check if the user has ALL of the given permissions.
 */
export function hasAllPermissions(
  userPermissions: string[],
  requiredPermissions: string[]
): boolean {
  return requiredPermissions.every((req) =>
    userPermissions.some((perm) => matchSingle(perm, req))
  );
}

/**
 * Get all matching permissions from user's list for a given resource.
 * Returns the actions the user can perform on the resource.
 */
export function getActionsForResource(
  userPermissions: string[],
  resource: string
): string[] {
  const actions: Set<string> = new Set();

  for (const perm of userPermissions) {
    const [permResource, permAction] = perm.split(PERMISSION_SEPARATOR);
    if (!permResource || !permAction) continue;

    if (permResource === WILDCARD || permResource === resource) {
      if (permAction === WILDCARD) {
        // Wildcard action — caller should expand from RESOURCE_ACTIONS
        actions.add(WILDCARD);
      } else {
        actions.add(permAction);
      }
    }
  }

  return Array.from(actions);
}
