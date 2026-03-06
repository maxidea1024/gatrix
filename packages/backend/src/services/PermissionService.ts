/**
 * PermissionService - RBAC Permission Calculation Engine
 *
 * Implements 4-level permission check (System > Org > Project > Environment)
 * with wildcard matching, role inheritance, and instance wildcards.
 *
 * Permission check order:
 * 1. Org Admin check → immediate grant (replaces super admin email check)
 * 2. Collect roleIds (direct + group + inherited)
 * 3. Instance wildcard check (projectId='*' or environmentId='*')
 * 4. Specific instance permission check
 * 5. Permission wildcard matching (resource:*, *:read, *:*)
 */

import db from '../config/knex';
import redis from '../config/redis';
import { createLogger } from '../config/logger';

const logger = createLogger('PermissionService');
import { matchSingle, MAX_INHERITANCE_DEPTH, INSTANCE_WILDCARD } from '@gatrix/shared/permissions';

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
  orgPerms: (roleId: string) => `rbac:org_perms:${roleId}`,
  projectPerms: (roleId: string, projectId: string) => `rbac:proj_perms:${roleId}:${projectId}`,
  envPerms: (roleId: string, env: string) => `rbac:env_perms:${roleId}:${env}`,
};

class PermissionService {
  // ==================== Public API ====================

  /**
   * Check if user has an organisation-level permission
   */
  async hasOrgPermission(userId: string, orgId: string, perm: string): Promise<boolean> {
    // 1. Org Admin → all permissions
    if (await this.isOrgAdmin(userId, orgId)) return true;

    // 2. Collect all roleIds (direct + group + inherited)
    const roleIds = await this.getAllRoleIds(userId);
    if (roleIds.length === 0) return false;

    // 3. Get all org permissions for these roles
    const perms = await db('g_role_org_permissions')
      .whereIn('roleId', roleIds)
      .select('permission');

    // 4. Check with wildcard matching
    return perms.some((row: any) => matchSingle(row.permission, perm));
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

    const roleIds = await this.getAllRoleIds(userId);
    if (roleIds.length === 0) return false;

    // 2. Check instance wildcard (projectId='*') permissions
    const wildcardPerms = await db('g_role_project_permissions')
      .whereIn('roleId', roleIds)
      .where('projectId', INSTANCE_WILDCARD)
      .select('permission');

    if (wildcardPerms.some((row: any) => matchSingle(row.permission, perm))) return true;

    // 3. Check specific project permissions
    const specificPerms = await db('g_role_project_permissions')
      .whereIn('roleId', roleIds)
      .where('projectId', projectId)
      .select('permission');

    return specificPerms.some((row: any) => matchSingle(row.permission, perm));
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

    const roleIds = await this.getAllRoleIds(userId);
    if (roleIds.length === 0) return false;

    // 2. Project Admin check (projectId='*' with *:*)
    const projWildcardPerms = await db('g_role_project_permissions')
      .whereIn('roleId', roleIds)
      .where('projectId', INSTANCE_WILDCARD)
      .select('permission');

    if (projWildcardPerms.some((row: any) => matchSingle(row.permission, perm))) return true;

    // 3. Specific project *:* check (project admin for this project → all env permissions)
    const projSpecificPerms = await db('g_role_project_permissions')
      .whereIn('roleId', roleIds)
      .where('projectId', projectId)
      .select('permission');

    if (projSpecificPerms.some((row: any) => matchSingle(row.permission, perm))) return true;

    // 4. Check instance wildcard (environmentId='*') permissions
    const envWildcardPerms = await db('g_role_environment_permissions')
      .whereIn('roleId', roleIds)
      .where('environmentId', INSTANCE_WILDCARD)
      .select('permission');

    if (envWildcardPerms.some((row: any) => matchSingle(row.permission, perm))) return true;

    // 5. Check specific environment permissions
    const envSpecificPerms = await db('g_role_environment_permissions')
      .whereIn('roleId', roleIds)
      .where('environmentId', environmentId)
      .select('permission');

    return envSpecificPerms.some((row: any) => matchSingle(row.permission, perm));
  }

  /**
   * Check if user is an Org Admin
   * Replaces the old isSuperAdmin() email-based check.
   */
  async isOrgAdmin(userId: string, orgId: string): Promise<boolean> {
    const key = cacheKey.orgAdmin(userId, orgId);

    try {
      const cached = await redis.get(key);
      if (cached !== null) return cached === '1';
    } catch {
      // Cache miss or error → fall through to DB
    }

    const member = await db('g_organisation_members')
      .where({ userId, orgId, orgRole: 'admin' })
      .first();

    const isAdmin = !!member;

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
   * Org Admin → all active projects in the org.
   * Instance wildcard (projectId='*') → all active projects.
   * Otherwise → projects where user has any project-level or environment-level permission.
   */
  async getAccessibleProjectIds(userId: string, orgId: string): Promise<string[]> {
    // Org Admin → all projects
    if (await this.isOrgAdmin(userId, orgId)) {
      const allProjects = await db('g_projects').where({ orgId, isActive: true }).select('id');
      return allProjects.map((p: any) => p.id);
    }

    const roleIds = await this.getAllRoleIds(userId);
    if (roleIds.length === 0) return [];

    // Check for instance wildcard (projectId='*')
    const hasWildcard = await db('g_role_project_permissions')
      .whereIn('roleId', roleIds)
      .where('projectId', INSTANCE_WILDCARD)
      .first();

    if (hasWildcard) {
      const allProjects = await db('g_projects').where({ orgId, isActive: true }).select('id');
      return allProjects.map((p: any) => p.id);
    }

    // Projects with direct project-level permissions
    const projectPerms = await db('g_role_project_permissions')
      .whereIn('roleId', roleIds)
      .join('g_projects', 'g_role_project_permissions.projectId', 'g_projects.id')
      .where('g_projects.orgId', orgId)
      .where('g_projects.isActive', true)
      .select('g_projects.id');

    // Projects inferred from environment-level permissions
    const envPerms = await db('g_role_environment_permissions')
      .whereIn('g_role_environment_permissions.roleId', roleIds)
      .join('g_environments', 'g_role_environment_permissions.environmentId', 'g_environments.id')
      .join('g_projects', 'g_environments.projectId', 'g_projects.id')
      .where('g_projects.orgId', orgId)
      .where('g_projects.isActive', true)
      .select('g_projects.id');

    const ids = new Set([...projectPerms.map((p: any) => p.id), ...envPerms.map((p: any) => p.id)]);

    return Array.from(ids);
  }

  /**
   * Get all environment IDs accessible by a user within a project.
   * Org Admin / Project Admin → all environments.
   * Instance wildcard (environmentId='*') → all environments.
   * Otherwise → environments where user has any environment-level permission.
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

    const roleIds = await this.getAllRoleIds(userId);
    if (roleIds.length === 0) return [];

    // Project Admin check (projectId='*' or specific project with *:*)
    const projPerms = await db('g_role_project_permissions')
      .whereIn('roleId', roleIds)
      .where(function (this: any) {
        this.where('projectId', projectId).orWhere('projectId', INSTANCE_WILDCARD);
      })
      .select('permission');

    const isProjectAdmin = projPerms.some((row: any) => matchSingle(row.permission, '*:*'));
    if (isProjectAdmin) {
      const allEnvs = await db('g_environments').where({ projectId }).select('id');
      return allEnvs.map((e: any) => e.id);
    }

    // Instance wildcard (environmentId='*')
    const hasEnvWildcard = await db('g_role_environment_permissions')
      .whereIn('roleId', roleIds)
      .where('environmentId', INSTANCE_WILDCARD)
      .first();

    if (hasEnvWildcard) {
      const allEnvs = await db('g_environments').where({ projectId }).select('id');
      return allEnvs.map((e: any) => e.id);
    }

    // Environments with direct environment-level permissions
    const envPerms = await db('g_role_environment_permissions')
      .whereIn('g_role_environment_permissions.roleId', roleIds)
      .join('g_environments', 'g_role_environment_permissions.environmentId', 'g_environments.id')
      .where('g_environments.projectId', projectId)
      .select('g_environments.id');

    return Array.from(new Set(envPerms.map((e: any) => e.id)));
  }

  // ==================== Permission Preview ====================

  /**
   * Get all effective permissions for a user (for preview UI).
   * Collects permissions from all sources: direct roles, group roles, inherited roles.
   */
  async getUserEffectivePermissions(
    userId: string,
    orgId: string
  ): Promise<{
    orgPermissions: Array<{ permission: string; source: string }>;
    projectPermissions: Array<{ projectId: string; permission: string; source: string }>;
    envPermissions: Array<{ environmentId: string; permission: string; source: string }>;
  }> {
    const roleIds = await this.getAllRoleIds(userId);

    // Get role info for source tracking
    const roleInfo = await this.getRoleSourceInfo(userId);

    const orgPerms: Array<{ permission: string; source: string }> = [];
    const projectPerms: Array<{ projectId: string; permission: string; source: string }> = [];
    const envPerms: Array<{ environmentId: string; permission: string; source: string }> = [];

    for (const roleId of roleIds) {
      const source = roleInfo.get(roleId) || 'unknown';

      // Org perms
      const orgRows = await db('g_role_org_permissions')
        .where('roleId', roleId)
        .select('permission');
      for (const row of orgRows) {
        orgPerms.push({ permission: row.permission, source });
      }

      // Project perms
      const projRows = await db('g_role_project_permissions')
        .where('roleId', roleId)
        .select('projectId', 'permission');
      for (const row of projRows) {
        projectPerms.push({ projectId: row.projectId, permission: row.permission, source });
      }

      // Env perms
      const envRows = await db('g_role_environment_permissions')
        .where('roleId', roleId)
        .select('environmentId', 'permission');
      for (const row of envRows) {
        envPerms.push({ environmentId: row.environmentId, permission: row.permission, source });
      }
    }

    return {
      orgPermissions: orgPerms,
      projectPermissions: projectPerms,
      envPermissions: envPerms,
    };
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
      const keys = await client.keys(`rbac:*_perms:${roleId}:*`);
      if (keys.length > 0) {
        await client.del(keys);
      }
    } catch (error) {
      logger.warn('Failed to invalidate role RBAC cache:', error);
    }
  }

  // ==================== Internal Helpers ====================

  /**
   * Get all roleIds for a user (direct roles + group roles + inherited), with caching
   */
  async getAllRoleIds(userId: string): Promise<string[]> {
    const key = cacheKey.userRoles(userId);

    try {
      const cached = await redis.get(key);
      if (cached !== null) return JSON.parse(cached);
    } catch {
      // Cache miss or error
    }

    // Direct roles
    const directRoles = await db('g_user_roles').where('userId', userId).select('roleId');

    // Group roles
    const groupRoles = await db('g_group_members as gm')
      .join('g_group_roles as gr', 'gm.groupId', 'gr.groupId')
      .where('gm.userId', userId)
      .select('gr.roleId');

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
   * Uses BFS to trace the ancestry of parentRoleId; if roleId appears, it's a cycle.
   */
  async wouldCreateCycle(roleId: string, parentRoleId: string): Promise<boolean> {
    if (roleId === parentRoleId) return true;

    const visited = new Set<string>([roleId]);
    const queue = [parentRoleId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) return true;
      visited.add(current);

      // Check depth limit
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
   * Get source info (role name + how assigned) for each roleId
   * Returns Map<roleId, sourceLabel>
   */
  private async getRoleSourceInfo(userId: string): Promise<Map<string, string>> {
    const sourceMap = new Map<string, string>();

    // Direct roles
    const directRoles = await db('g_user_roles as ur')
      .join('g_roles as r', 'ur.roleId', 'r.id')
      .where('ur.userId', userId)
      .select('r.id', 'r.roleName');

    for (const role of directRoles) {
      sourceMap.set(role.id, `${role.roleName} (direct)`);
    }

    // Group roles
    const groupRoles = await db('g_group_members as gm')
      .join('g_group_roles as gr', 'gm.groupId', 'gr.groupId')
      .join('g_roles as r', 'gr.roleId', 'r.id')
      .join('g_groups as g', 'gm.groupId', 'g.id')
      .where('gm.userId', userId)
      .select('r.id', 'r.roleName', 'g.groupName');

    for (const role of groupRoles) {
      if (!sourceMap.has(role.id)) {
        sourceMap.set(role.id, `${role.roleName} (${role.groupName})`);
      }
    }

    return sourceMap;
  }
}

export const permissionService = new PermissionService();
export default permissionService;
