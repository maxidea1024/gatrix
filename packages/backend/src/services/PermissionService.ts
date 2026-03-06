/**
 * PermissionService - RBAC v3 Permission Engine (Role Binding Pattern)
 *
 * Implements 4-level scope hierarchy (System > Org > Project > Environment)
 * with role bindings, wildcard matching, role inheritance, and override resolution.
 *
 * Permission check flow:
 * 1. System Admin check (system scope binding with *:*)
 * 2. Org Admin check → immediate grant
 * 3. Membership gate (org member? project member?)
 * 4. Resolve effective role IDs at the given scope (override chain)
 * 5. Wildcard matching against g_role_permissions
 */

import db from '../config/knex';
import redis from '../config/redis';
import { createLogger } from '../config/logger';

const logger = createLogger('PermissionService');
import { matchSingle, MAX_INHERITANCE_DEPTH } from '@gatrix/shared/permissions';

// Cache TTL constants (in seconds)
const CACHE_TTL = {
  ORG_ADMIN: 300, // 5 min
  USER_ROLES: 300, // 5 min
  ROLE_PERMS: 600, // 10 min
};

// Cache key builders
const cacheKey = {
  orgAdmin: (userId: string, orgId: string) => `rbac:org_admin:${userId}:${orgId}`,
  userRoles: (userId: string) => `rbac:user_roles:${userId}`,
  rolePerms: (roleId: string) => `rbac:role_perms:${roleId}`,
};

class PermissionService {
  // ==================== Public API ====================

  /**
   * Check if user has an organisation-level permission
   */
  async hasOrgPermission(userId: string, orgId: string, perm: string): Promise<boolean> {
    // 1. Org Admin → all permissions
    if (await this.isOrgAdmin(userId, orgId)) return true;

    // 2. Get effective role IDs at org scope
    const roleIds = await this.getEffectiveRoleIds(userId, 'org', orgId);
    if (roleIds.length === 0) return false;

    // 3. Check permissions
    return this.checkPermissionInRoles(roleIds, perm);
  }

  /**
   * Check if user has a project-level permission
   */
  async hasProjectPermission(
    userId: string,
    orgId: string,
    projectId: string,
    perm: string
  ): Promise<boolean> {
    // 1. Org Admin → all permissions
    if (await this.isOrgAdmin(userId, orgId)) return true;

    // 2. Get effective role IDs at project scope (with override chain)
    const roleIds = await this.getEffectiveRoleIds(userId, 'project', projectId);
    if (roleIds.length === 0) return false;

    // 3. Check permissions
    return this.checkPermissionInRoles(roleIds, perm);
  }

  /**
   * Check if user has an environment-level permission
   */
  async hasEnvPermission(
    userId: string,
    orgId: string,
    projectId: string,
    environmentId: string,
    perm: string
  ): Promise<boolean> {
    // 1. Org Admin → all permissions
    if (await this.isOrgAdmin(userId, orgId)) return true;

    // 2. Get effective role IDs at environment scope (with override chain)
    const roleIds = await this.getEffectiveRoleIds(userId, 'environment', environmentId);
    if (roleIds.length === 0) return false;

    // 3. Check permissions
    return this.checkPermissionInRoles(roleIds, perm);
  }

  /**
   * Check if user has wildcard (*:*) permission at org scope via RBAC role bindings
   */
  async isOrgAdmin(userId: string, orgId: string): Promise<boolean> {
    const key = cacheKey.orgAdmin(userId, orgId);

    try {
      const cached = await redis.get(key);
      if (cached !== null) return cached === '1';
    } catch {
      // Cache miss or error → fall through to DB
    }

    // Check if user has a role with *:* permission at org scope
    const roleIds = await this.getEffectiveRoleIds(userId, 'org', orgId);
    let isAdmin = false;
    if (roleIds.length > 0) {
      isAdmin = await this.checkPermissionInRoles(roleIds, '*:*');
    }

    try {
      await redis.set(key, isAdmin ? '1' : '0', CACHE_TTL.ORG_ADMIN);
    } catch {
      // Non-critical cache write failure
    }

    return isAdmin;
  }

  /**
   * Check if user is a member of the organisation
   */
  async isOrgMember(userId: string, orgId: string): Promise<boolean> {
    const member = await db('g_organisation_members').where({ userId, orgId }).first();
    return !!member;
  }

  /**
   * Get user's org membership info
   */
  async getOrgMembership(
    userId: string,
    orgId?: string
  ): Promise<{ orgId: string; orgRole: 'admin' | 'user' } | null> {
    const query = db('g_organisation_members').where('userId', userId).select('orgId', 'orgRole');

    if (orgId) {
      query.where('orgId', orgId);
    }

    const membership = await query.first();
    if (!membership) return null;

    return {
      orgId: membership.orgId,
      orgRole: membership.orgRole as 'admin' | 'user',
    };
  }

  /**
   * Get all organisation memberships for a user
   */
  async getUserOrganisations(
    userId: string
  ): Promise<Array<{ orgId: string; orgRole: 'admin' | 'user' }>> {
    const memberships = await db('g_organisation_members')
      .where('userId', userId)
      .join('g_organisations', 'g_organisation_members.orgId', 'g_organisations.id')
      .where('g_organisations.isActive', true)
      .select('g_organisation_members.orgId', 'g_organisation_members.orgRole');

    return memberships.map((m: any) => ({
      orgId: m.orgId,
      orgRole: m.orgRole as 'admin' | 'user',
    }));
  }

  /**
   * Resolve environment → projectId → orgId chain
   */
  async resolveEnvironmentChain(
    environmentId: string
  ): Promise<{ projectId: string; orgId: string } | null> {
    const env = await db('g_environments').where('id', environmentId).select('projectId').first();

    if (!env?.projectId) return null;

    const project = await db('g_projects').where('id', env.projectId).select('orgId').first();

    if (!project) return null;

    return {
      projectId: env.projectId,
      orgId: project.orgId,
    };
  }

  /**
   * Resolve projectId → orgId
   */
  async resolveProjectOrg(projectId: string): Promise<string | null> {
    const project = await db('g_projects').where('id', projectId).select('orgId').first();
    return project?.orgId || null;
  }

  // ==================== Accessibility Queries ====================

  /**
   * Get all project IDs accessible by a user within an org.
   * Org Admin → all active projects.
   * Otherwise → projects where user has membership or any binding.
   */
  async getAccessibleProjectIds(userId: string, orgId: string): Promise<string[]> {
    // Org Admin → all projects
    if (await this.isOrgAdmin(userId, orgId)) {
      const allProjects = await db('g_projects').where({ orgId, isActive: true }).select('id');
      return allProjects.map((p: any) => p.id);
    }

    const ids = new Set<string>();

    // Projects accessible via direct project membership
    const memberProjects = await db('g_project_members')
      .where('g_project_members.userId', userId)
      .join('g_projects', 'g_project_members.projectId', 'g_projects.id')
      .where('g_projects.orgId', orgId)
      .where('g_projects.isActive', true)
      .select('g_projects.id');
    for (const p of memberProjects) {
      ids.add(p.id);
    }

    // Projects accessible via org-level role bindings (org member with role → all projects)
    const orgBindings = await db('g_role_bindings')
      .where({ userId, scopeType: 'org', scopeId: orgId })
      .select('roleId');

    if (orgBindings.length > 0) {
      // User has org-level binding → access to all projects in the org
      const allProjects = await db('g_projects').where({ orgId, isActive: true }).select('id');
      return allProjects.map((p: any) => p.id);
    }

    // Projects accessible via project-level bindings
    const projectBindings = await db('g_role_bindings')
      .where({ userId, scopeType: 'project' })
      .join('g_projects', 'g_role_bindings.scopeId', 'g_projects.id')
      .where('g_projects.orgId', orgId)
      .where('g_projects.isActive', true)
      .select('g_projects.id');
    for (const p of projectBindings) {
      ids.add(p.id);
    }

    // Projects inferred from environment bindings
    const envBindings = await db('g_role_bindings')
      .where({ userId, scopeType: 'environment' })
      .join('g_environments', 'g_role_bindings.scopeId', 'g_environments.id')
      .join('g_projects', 'g_environments.projectId', 'g_projects.id')
      .where('g_projects.orgId', orgId)
      .where('g_projects.isActive', true)
      .select('g_projects.id');
    for (const p of envBindings) {
      ids.add(p.id);
    }

    return Array.from(ids);
  }

  /**
   * Get all environment IDs accessible by a user within a project.
   * Org Admin / Project Admin → all environments.
   * Project member → all environments.
   * Otherwise → environments where user has a binding.
   */
  async getAccessibleEnvironmentIds(
    userId: string,
    orgId: string,
    projectId: string
  ): Promise<string[]> {
    // Org Admin → all environments
    if (await this.isOrgAdmin(userId, orgId)) {
      const allEnvs = await db('g_environments').where({ projectId }).select('id');
      return allEnvs.map((e: any) => e.id);
    }

    // Project member → all environments
    const isProjectMember = await db('g_project_members')
      .where({ projectId, userId })
      .first();
    if (isProjectMember) {
      const allEnvs = await db('g_environments').where({ projectId }).select('id');
      return allEnvs.map((e: any) => e.id);
    }

    // Org-level or project-level binding → all environments
    const roleIds = await this.getEffectiveRoleIds(userId, 'project', projectId);
    if (roleIds.length > 0) {
      const allEnvs = await db('g_environments').where({ projectId }).select('id');
      return allEnvs.map((e: any) => e.id);
    }

    // Environment-specific bindings only
    const envBindings = await db('g_role_bindings')
      .where({ userId, scopeType: 'environment' })
      .join('g_environments', 'g_role_bindings.scopeId', 'g_environments.id')
      .where('g_environments.projectId', projectId)
      .select('g_environments.id');

    return Array.from(new Set(envBindings.map((e: any) => e.id)));
  }

  // ==================== Permission Preview ====================

  /**
   * Get all effective permissions for a user across all scopes
   */
  async getUserEffectivePermissions(
    userId: string,
    orgId: string
  ): Promise<{
    bindings: Array<{
      scopeType: string;
      scopeId: string;
      roleId: string;
      roleName: string;
      permissions: string[];
      source: string;
    }>;
  }> {
    const bindings: Array<{
      scopeType: string;
      scopeId: string;
      roleId: string;
      roleName: string;
      permissions: string[];
      source: string;
    }> = [];

    // Direct user bindings
    const directBindings = await db('g_role_bindings as rb')
      .join('g_roles as r', 'rb.roleId', 'r.id')
      .where('rb.userId', userId)
      .select('rb.scopeType', 'rb.scopeId', 'rb.roleId', 'r.roleName');

    for (const b of directBindings) {
      const perms = await this.getRolePermissions(b.roleId);
      bindings.push({
        scopeType: b.scopeType,
        scopeId: b.scopeId,
        roleId: b.roleId,
        roleName: b.roleName,
        permissions: perms,
        source: 'direct',
      });
    }

    // Group bindings
    const groupBindings = await db('g_role_bindings as rb')
      .join('g_group_members as gm', 'rb.groupId', 'gm.groupId')
      .join('g_roles as r', 'rb.roleId', 'r.id')
      .join('g_groups as g', 'rb.groupId', 'g.id')
      .where('gm.userId', userId)
      .whereNotNull('rb.groupId')
      .select('rb.scopeType', 'rb.scopeId', 'rb.roleId', 'r.roleName', 'g.groupName');

    for (const b of groupBindings) {
      const perms = await this.getRolePermissions(b.roleId);
      bindings.push({
        scopeType: b.scopeType,
        scopeId: b.scopeId,
        roleId: b.roleId,
        roleName: b.roleName,
        permissions: perms,
        source: `group:${b.groupName}`,
      });
    }

    return { bindings };
  }

  // ==================== Cache Invalidation ====================

  /**
   * Invalidate all permission caches for a user
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      const client = redis.getClient();
      const keys = await client.keys(`rbac:*:${userId}:*`);
      const roleKey = cacheKey.userRoles(userId);

      const allKeys = [...keys, roleKey];
      if (allKeys.length > 0) {
        await client.del(allKeys);
      }

      logger.debug(`Invalidated ${allKeys.length} RBAC cache entries for user ${userId}`);
    } catch (error) {
      logger.warn('Failed to invalidate user RBAC cache:', error);
    }
  }

  /**
   * Invalidate org admin cache for a specific user-org pair
   */
  async invalidateOrgAdminCache(userId: string, orgId: string): Promise<void> {
    try {
      await redis.del(cacheKey.orgAdmin(userId, orgId));
    } catch {
      // Non-critical
    }
  }

  /**
   * Invalidate all role-related caches (when role permissions change)
   */
  async invalidateRoleCache(roleId: string): Promise<void> {
    try {
      const client = redis.getClient();
      const keys = await client.keys(`rbac:*_perms:${roleId}*`);
      const permKey = cacheKey.rolePerms(roleId);
      const allKeys = [...keys, permKey];
      if (allKeys.length > 0) {
        await client.del(allKeys);
      }
    } catch (error) {
      logger.warn('Failed to invalidate role RBAC cache:', error);
    }
  }

  // ==================== Internal Helpers ====================

  /**
   * Get effective role IDs for a user at a given scope with override resolution.
   * Override chain: environment > project > org > system
   * Includes both direct user bindings and group bindings + inherited roles.
   */
  private async getEffectiveRoleIds(
    userId: string,
    scopeType: 'system' | 'org' | 'project' | 'environment',
    scopeId: string
  ): Promise<string[]> {
    if (scopeType === 'environment') {
      // Check environment-specific bindings first
      const envRoles = await this.getBindingRoleIds(userId, 'environment', scopeId);
      if (envRoles.length > 0) return this.resolveInheritedRoles(envRoles);

      // Fallback to project
      const projectId = await this.getProjectFromEnv(scopeId);
      if (projectId) {
        const projRoles = await this.getBindingRoleIds(userId, 'project', projectId);
        if (projRoles.length > 0) return this.resolveInheritedRoles(projRoles);
      }

      // Fallback to org
      const orgId = await this.resolveOrgFromScope(scopeType, scopeId);
      if (orgId) {
        const orgRoles = await this.getBindingRoleIds(userId, 'org', orgId);
        if (orgRoles.length > 0) return this.resolveInheritedRoles(orgRoles);
      }

      // Fallback to system
      return this.resolveInheritedRoles(await this.getBindingRoleIds(userId, 'system', 'SYSTEM'));
    }

    if (scopeType === 'project') {
      const projRoles = await this.getBindingRoleIds(userId, 'project', scopeId);
      if (projRoles.length > 0) return this.resolveInheritedRoles(projRoles);

      // Fallback to org
      const orgId = await this.resolveOrgFromScope('project', scopeId);
      if (orgId) {
        const orgRoles = await this.getBindingRoleIds(userId, 'org', orgId);
        if (orgRoles.length > 0) return this.resolveInheritedRoles(orgRoles);
      }

      return this.resolveInheritedRoles(await this.getBindingRoleIds(userId, 'system', 'SYSTEM'));
    }

    if (scopeType === 'org') {
      const orgRoles = await this.getBindingRoleIds(userId, 'org', scopeId);
      if (orgRoles.length > 0) return this.resolveInheritedRoles(orgRoles);

      return this.resolveInheritedRoles(await this.getBindingRoleIds(userId, 'system', 'SYSTEM'));
    }

    // system scope
    return this.resolveInheritedRoles(await this.getBindingRoleIds(userId, 'system', 'SYSTEM'));
  }

  /**
   * Get role IDs from both direct user bindings and group bindings at a specific scope
   */
  private async getBindingRoleIds(
    userId: string,
    scopeType: string,
    scopeId: string
  ): Promise<string[]> {
    // Direct user bindings
    const directBindings = await db('g_role_bindings')
      .where({ userId, scopeType, scopeId })
      .select('roleId');

    // Group bindings (user's groups)
    const groupBindings = await db('g_role_bindings as rb')
      .join('g_group_members as gm', 'rb.groupId', 'gm.groupId')
      .where('gm.userId', userId)
      .where('rb.scopeType', scopeType)
      .where('rb.scopeId', scopeId)
      .whereNotNull('rb.groupId')
      .select('rb.roleId');

    const ids = new Set([
      ...directBindings.map((r: any) => r.roleId),
      ...groupBindings.map((r: any) => r.roleId),
    ]);
    return Array.from(ids);
  }

  /**
   * Check if any of the given roles have the required permission
   */
  private async checkPermissionInRoles(roleIds: string[], perm: string): Promise<boolean> {
    for (const roleId of roleIds) {
      const perms = await this.getRolePermissions(roleId);
      if (perms.some((p) => matchSingle(p, perm))) return true;
    }
    return false;
  }

  /**
   * Get all permissions for a role (with caching)
   */
  private async getRolePermissions(roleId: string): Promise<string[]> {
    const key = cacheKey.rolePerms(roleId);

    try {
      const cached = await redis.get(key);
      if (cached !== null) return JSON.parse(cached);
    } catch {
      // Cache miss
    }

    const rows = await db('g_role_permissions')
      .where('roleId', roleId)
      .select('permission');
    const perms = rows.map((r: any) => r.permission);

    try {
      await redis.set(key, JSON.stringify(perms), CACHE_TTL.ROLE_PERMS);
    } catch {
      // Non-critical
    }

    return perms;
  }

  /**
   * Recursively resolve inherited roles (max depth to prevent cycles)
   */
  private async resolveInheritedRoles(roleIds: string[], depth: number = 0): Promise<string[]> {
    if (depth >= MAX_INHERITANCE_DEPTH || roleIds.length === 0) {
      return roleIds;
    }

    const parentRoles = await db('g_role_inheritance')
      .whereIn('roleId', roleIds)
      .select('parentRoleId');

    const parentIds = parentRoles
      .map((r: any) => r.parentRoleId)
      .filter((id: string) => !roleIds.includes(id)); // Prevent cycles

    if (parentIds.length === 0) {
      return roleIds;
    }

    // Recursively resolve parent roles
    const allParentIds = await this.resolveInheritedRoles([...roleIds, ...parentIds], depth + 1);

    return Array.from(new Set([...roleIds, ...allParentIds]));
  }

  /**
   * Detect if adding parentRoleId as parent of roleId would create a cycle.
   */
  async wouldCreateCycle(roleId: string, parentRoleId: string): Promise<boolean> {
    if (roleId === parentRoleId) return true;

    const visited = new Set<string>([roleId]);
    const queue = [parentRoleId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) return true;
      visited.add(current);

      if (visited.size > MAX_INHERITANCE_DEPTH + 2) return true;

      const parents = await db('g_role_inheritance')
        .where('roleId', current)
        .select('parentRoleId');

      for (const p of parents) {
        if (!visited.has(p.parentRoleId)) {
          queue.push(p.parentRoleId);
        }
      }
    }

    return false;
  }

  /**
   * Get all role IDs for a user (all scopes, for global permission check in User.ts)
   */
  async getAllRoleIds(userId: string): Promise<string[]> {
    const key = cacheKey.userRoles(userId);

    try {
      const cached = await redis.get(key);
      if (cached !== null) return JSON.parse(cached);
    } catch {
      // Cache miss or error
    }

    // Direct bindings
    const directRoles = await db('g_role_bindings')
      .where('userId', userId)
      .select('roleId');

    // Group bindings
    const groupRoles = await db('g_role_bindings as rb')
      .join('g_group_members as gm', 'rb.groupId', 'gm.groupId')
      .where('gm.userId', userId)
      .whereNotNull('rb.groupId')
      .select('rb.roleId');

    const baseRoleIds = new Set([
      ...directRoles.map((r: any) => r.roleId),
      ...groupRoles.map((r: any) => r.roleId),
    ]);

    // Resolve inherited roles
    const allRoleIds = await this.resolveInheritedRoles(Array.from(baseRoleIds));

    try {
      await redis.set(key, JSON.stringify(allRoleIds), CACHE_TTL.USER_ROLES);
    } catch {
      // Non-critical
    }

    return allRoleIds;
  }

  // ─── Scope resolution helpers ─────────────────────────

  private async getProjectFromEnv(environmentId: string): Promise<string | null> {
    const env = await db('g_environments').where('id', environmentId).select('projectId').first();
    return env?.projectId || null;
  }

  private async resolveOrgFromScope(scopeType: string, scopeId: string): Promise<string | null> {
    if (scopeType === 'org') return scopeId;
    if (scopeType === 'system') return null;

    if (scopeType === 'project') {
      const proj = await db('g_projects').where('id', scopeId).select('orgId').first();
      return proj?.orgId || null;
    }

    if (scopeType === 'environment') {
      const env = await db('g_environments').where('id', scopeId).select('projectId').first();
      if (!env?.projectId) return null;
      const proj = await db('g_projects').where('id', env.projectId).select('orgId').first();
      return proj?.orgId || null;
    }

    return null;
  }
}

export const permissionService = new PermissionService();
export default permissionService;
