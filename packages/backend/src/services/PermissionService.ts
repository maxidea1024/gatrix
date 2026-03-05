/**
 * PermissionService - RBAC Permission Calculation Engine
 *
 * Implements the 3-level permission check (Org ??Project ??Environment)
 * with Redis caching for performance.
 *
 * Permission check order:
 * 1. Org Admin check ??immediate grant
 * 2. Collect roleIds (direct + group)
 * 3. Admin flag check (Project Admin, Env Admin)
 * 4. Exact permission match
 * 5. write ??read fallback
 */

import db from '../config/knex';
import redis from '../config/redis';
import logger from '../config/logger';

// Super admin email - has full system privileges across all resources
const SUPER_ADMIN_EMAIL = 'admin@gatrix.com';

// Cache TTL constants (in seconds)
const CACHE_TTL = {
  ORG_ADMIN: 300, // 5 min
  USER_ROLES: 300, // 5 min
  ROLE_PERMS: 600, // 10 min
};

// Cache key builders
const cacheKey = {
  orgAdmin: (userId: string, orgId: string) => `rbac:org_admin:${userId}:${orgId}`,
  superAdmin: (userId: string) => `rbac:super_admin:${userId}`,
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
    // 0. Super Admin bypass
    if (await this.isSuperAdmin(userId)) return true;

    // 1. Org Admin → all permissions
    if (await this.isOrgAdmin(userId, orgId)) return true;

    // 2. Collect all roleIds
    const roleIds = await this.getAllRoleIds(userId);
    if (roleIds.length === 0) return false;

    // 3. Check exact permission
    const hasExact = await db('g_role_org_permissions')
      .whereIn('roleId', roleIds)
      .where('permission', perm)
      .first();
    if (hasExact) return true;

    // 4. write → read fallback
    if (perm.endsWith('.read')) {
      const writePerm = perm.replace('.read', '.write');
      const hasWrite = await db('g_role_org_permissions')
        .whereIn('roleId', roleIds)
        .where('permission', writePerm)
        .first();
      if (hasWrite) return true;
    }

    return false;
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
    // 0. Super Admin bypass
    if (await this.isSuperAdmin(userId)) return true;

    // 1. Org Admin → all permissions
    if (await this.isOrgAdmin(userId, orgId)) return true;

    const roleIds = await this.getAllRoleIds(userId);
    if (roleIds.length === 0) return false;

    // 2. Project Admin → all project + env permissions
    const isProjectAdmin = await db('g_role_project_permissions')
      .whereIn('roleId', roleIds)
      .where('projectId', projectId)
      .where('isAdmin', true)
      .first();
    if (isProjectAdmin) return true;

    // 3. Check exact permission
    const hasExact = await db('g_role_project_permissions')
      .whereIn('roleId', roleIds)
      .where('projectId', projectId)
      .where('permission', perm)
      .first();
    if (hasExact) return true;

    // 4. write → read fallback
    if (perm.endsWith('.read')) {
      const writePerm = perm.replace('.read', '.write');
      const hasWrite = await db('g_role_project_permissions')
        .whereIn('roleId', roleIds)
        .where('projectId', projectId)
        .where('permission', writePerm)
        .first();
      if (hasWrite) return true;
    }

    return false;
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
    // 0. Super Admin bypass
    if (await this.isSuperAdmin(userId)) return true;

    // 1. Org Admin → all permissions
    if (await this.isOrgAdmin(userId, orgId)) return true;

    const roleIds = await this.getAllRoleIds(userId);
    if (roleIds.length === 0) return false;

    // 2. Project Admin → all env permissions
    const isProjectAdmin = await db('g_role_project_permissions')
      .whereIn('roleId', roleIds)
      .where('projectId', projectId)
      .where('isAdmin', true)
      .first();
    if (isProjectAdmin) return true;

    // 3. Env Admin → all env permissions for this environment
    const isEnvAdmin = await db('g_role_environment_permissions')
      .whereIn('roleId', roleIds)
      .where('environmentId', environmentId)
      .where('isAdmin', true)
      .first();
    if (isEnvAdmin) return true;

    // 4. Check exact permission
    const hasExact = await db('g_role_environment_permissions')
      .whereIn('roleId', roleIds)
      .where('environmentId', environmentId)
      .where('permission', perm)
      .first();
    if (hasExact) return true;

    // 5. write ??read fallback
    if (perm.endsWith('.read')) {
      const writePerm = perm.replace('.read', '.write');
      const hasWrite = await db('g_role_environment_permissions')
        .whereIn('roleId', roleIds)
        .where('environmentId', environmentId)
        .where('permission', writePerm)
        .first();
      if (hasWrite) return true;
    }

    return false;
  }

  /**
   * Check if user is an Org Admin (or Super Admin)
   */
  async isOrgAdmin(userId: string, orgId: string): Promise<boolean> {
    // Super Admin is always org admin
    if (await this.isSuperAdmin(userId)) return true;

    const key = cacheKey.orgAdmin(userId, orgId);

    try {
      const cached = await redis.get(key);
      if (cached !== null) return cached === '1';
    } catch {
      // Cache miss or error ??fall through to DB
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

    // Return first membership (or specific org if provided)
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
   * Resolve environment ??projectId ??orgId chain
   */
  async resolveEnvironmentChain(
    environmentId: string
  ): Promise<{ projectId: string; orgId: string } | null> {
    const env = await db('g_environments')
      .where('environmentId', environmentId)
      .select('projectId')
      .first();

    if (!env?.projectId) return null;

    const project = await db('g_projects').where('id', env.projectId).select('orgId').first();

    if (!project) return null;

    return {
      projectId: env.projectId,
      orgId: project.orgId,
    };
  }

  /**
   * Resolve projectId ??orgId
   */
  async resolveProjectOrg(projectId: string): Promise<string | null> {
    const project = await db('g_projects').where('id', projectId).select('orgId').first();
    return project?.orgId || null;
  }

  // ==================== Cache Invalidation ====================

  /**
   * Invalidate all permission caches for a user
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      // We need to scan for all keys matching this user
      // For simplicity, invalidate known keys
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
   * Check if user is a super admin (admin@gatrix.com)
   * Super admin has full system privileges across all resources.
   */
  async isSuperAdmin(userId: string): Promise<boolean> {
    const key = cacheKey.superAdmin(userId);

    try {
      const cached = await redis.get(key);
      if (cached !== null) return cached === '1';
    } catch {
      // Cache miss or error
    }

    const user = await db('g_users').where('id', userId).select('email').first();

    const isSuper = user?.email === SUPER_ADMIN_EMAIL;

    try {
      await redis.set(key, isSuper ? '1' : '0', CACHE_TTL.ORG_ADMIN);
    } catch {
      // Non-critical
    }

    return isSuper;
  }

  /**
   * Get all roleIds for a user (direct roles + group roles), with caching
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

    const all = Array.from(
      new Set([...directRoles.map((r: any) => r.roleId), ...groupRoles.map((r: any) => r.roleId)])
    );

    try {
      await redis.set(key, JSON.stringify(all), CACHE_TTL.USER_ROLES);
    } catch {
      // Non-critical
    }

    return all;
  }
}

export const permissionService = new PermissionService();
export default permissionService;
