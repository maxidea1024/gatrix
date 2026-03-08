/**
 * Scope Hierarchy
 *
 * Defines the privilege levels for role scopes.
 * Lower level = higher privilege (like CPU ring 0).
 * A user can only manage roles/users at or below their own scope level.
 *
 * system(0) > org(1) > project(2) > env(3)
 */

export const SCOPE_LEVELS: Record<string, number> = {
  system: 0,
  org: 1,
  project: 2,
  env: 3,
};

/**
 * Get the numeric level for a scope type.
 * Defaults to 3 (env, lowest privilege) for unknown types.
 */
export function getScopeLevel(scopeType: string): number {
  return SCOPE_LEVELS[scopeType] ?? 3;
}

/**
 * Check if the actor's scope level is high enough to manage the target scope.
 * Lower number = higher privilege.
 */
export function canManageScope(
  actorScopeLevel: number,
  targetScopeType: string
): boolean {
  return actorScopeLevel <= getScopeLevel(targetScopeType);
}

/**
 * Determine the highest scope level (lowest number) from a list of role scope types.
 */
export function getHighestScopeLevel(scopeTypes: string[]): number {
  if (scopeTypes.length === 0) return SCOPE_LEVELS.env;
  return Math.min(...scopeTypes.map(getScopeLevel));
}
