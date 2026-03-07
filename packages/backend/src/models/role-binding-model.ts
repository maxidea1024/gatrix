import db from '../config/knex';
import { generateULID } from '../utils/ulid';
import { createLogger } from '../config/logger';
import { permissionService } from '../services/permission-service';

const logger = createLogger('RoleBindingModel');

// ==================== Types ====================

export type ScopeType = 'system' | 'org' | 'project' | 'environment';

export interface RoleBindingRecord {
  id: string;
  userId: string | null;
  groupId: string | null;
  roleId: string;
  scopeType: ScopeType;
  scopeId: string;
  assignedBy: string | null;
  assignedAt: Date;
  // Joined fields
  roleName?: string;
  roleDescription?: string;
  userName?: string;
  userEmail?: string;
  groupName?: string;
}

export interface CreateRoleBindingData {
  userId?: string;
  groupId?: string;
  roleId: string;
  scopeType: ScopeType;
  scopeId: string;
  assignedBy?: string;
}

// ==================== Model ====================

export class RoleBindingModel {
  private static readonly TABLE = 'g_role_bindings';

  /**
   * Create a new role binding
   */
  static async create(data: CreateRoleBindingData): Promise<RoleBindingRecord> {
    if (!data.userId && !data.groupId) {
      throw new Error('Either userId or groupId must be provided');
    }

    const id = generateULID();
    await db(this.TABLE).insert({
      id,
      userId: data.userId || null,
      groupId: data.groupId || null,
      roleId: data.roleId,
      scopeType: data.scopeType,
      scopeId: data.scopeId,
      assignedBy: data.assignedBy || null,
    });

    const binding = await this.findById(id);
    if (!binding) throw new Error('Failed to create role binding');

    // Invalidate caches
    if (data.userId) {
      await permissionService.invalidateUserCache(data.userId);
    }
    if (data.groupId) {
      await this.invalidateGroupMembersCaches(data.groupId);
    }

    return binding;
  }

  /**
   * Delete a role binding by ID
   */
  static async delete(id: string): Promise<boolean> {
    const binding = await this.findById(id);
    if (!binding) return false;

    const result = await db(this.TABLE).where('id', id).del();
    if (result > 0) {
      if (binding.userId) {
        await permissionService.invalidateUserCache(binding.userId);
      }
      if (binding.groupId) {
        await this.invalidateGroupMembersCaches(binding.groupId);
      }
    }
    return result > 0;
  }

  /**
   * Find a binding by ID with joined role/user/group info
   */
  static async findById(id: string): Promise<RoleBindingRecord | null> {
    const row = await db(this.TABLE)
      .select([
        `${this.TABLE}.*`,
        'r.roleName',
        'r.description as roleDescription',
        'u.name as userName',
        'u.email as userEmail',
        'g.groupName',
      ])
      .leftJoin('g_roles as r', `${this.TABLE}.roleId`, 'r.id')
      .leftJoin('g_users as u', `${this.TABLE}.userId`, 'u.id')
      .leftJoin('g_groups as g', `${this.TABLE}.groupId`, 'g.id')
      .where(`${this.TABLE}.id`, id)
      .first();
    return row || null;
  }

  /**
   * Get all bindings for a user (optionally filtered by scope)
   */
  static async getByUser(
    userId: string,
    scopeType?: ScopeType,
    scopeId?: string
  ): Promise<RoleBindingRecord[]> {
    const query = db(this.TABLE)
      .select([
        `${this.TABLE}.*`,
        'r.roleName',
        'r.description as roleDescription',
      ])
      .leftJoin('g_roles as r', `${this.TABLE}.roleId`, 'r.id')
      .where(`${this.TABLE}.userId`, userId);

    if (scopeType) query.where(`${this.TABLE}.scopeType`, scopeType);
    if (scopeId) query.where(`${this.TABLE}.scopeId`, scopeId);

    return query.orderBy(`${this.TABLE}.assignedAt`, 'desc');
  }

  /**
   * Get all bindings for a group
   */
  static async getByGroup(
    groupId: string,
    scopeType?: ScopeType,
    scopeId?: string
  ): Promise<RoleBindingRecord[]> {
    const query = db(this.TABLE)
      .select([
        `${this.TABLE}.*`,
        'r.roleName',
        'r.description as roleDescription',
      ])
      .leftJoin('g_roles as r', `${this.TABLE}.roleId`, 'r.id')
      .where(`${this.TABLE}.groupId`, groupId);

    if (scopeType) query.where(`${this.TABLE}.scopeType`, scopeType);
    if (scopeId) query.where(`${this.TABLE}.scopeId`, scopeId);

    return query.orderBy(`${this.TABLE}.assignedAt`, 'desc');
  }

  /**
   * Get all bindings for a specific scope (e.g., all bindings for a project)
   */
  static async getByScope(
    scopeType: ScopeType,
    scopeId: string
  ): Promise<RoleBindingRecord[]> {
    return db(this.TABLE)
      .select([
        `${this.TABLE}.*`,
        'r.roleName',
        'r.description as roleDescription',
        'u.name as userName',
        'u.email as userEmail',
        'g.groupName',
      ])
      .leftJoin('g_roles as r', `${this.TABLE}.roleId`, 'r.id')
      .leftJoin('g_users as u', `${this.TABLE}.userId`, 'u.id')
      .leftJoin('g_groups as g', `${this.TABLE}.groupId`, 'g.id')
      .where(`${this.TABLE}.scopeType`, scopeType)
      .where(`${this.TABLE}.scopeId`, scopeId)
      .orderBy(`${this.TABLE}.assignedAt`, 'desc');
  }

  /**
   * Get effective role IDs for a user at a given scope.
   * Override resolution: environment > project > org > system
   * Includes both direct user bindings and group bindings.
   */
  static async getEffectiveRoleIds(
    userId: string,
    scopeType: ScopeType,
    scopeId: string
  ): Promise<string[]> {
    // Check most specific scope first, then fall back

    if (scopeType === 'environment') {
      const envRoles = await this.getBindingRoleIds(userId, 'environment', scopeId);
      if (envRoles.length > 0) return envRoles;

      // Fallback to project
      const projectId = await this.getProjectFromEnv(scopeId);
      if (projectId) {
        const projRoles = await this.getBindingRoleIds(userId, 'project', projectId);
        if (projRoles.length > 0) return projRoles;
      }
    }

    if (scopeType === 'project') {
      const projRoles = await this.getBindingRoleIds(userId, 'project', scopeId);
      if (projRoles.length > 0) return projRoles;
    }

    // Fallback to org
    const orgId = await this.resolveOrgId(scopeType, scopeId);
    if (orgId) {
      const orgRoles = await this.getBindingRoleIds(userId, 'org', orgId);
      if (orgRoles.length > 0) return orgRoles;
    }

    // Fallback to system
    const systemRoles = await this.getBindingRoleIds(userId, 'system', 'SYSTEM');
    return systemRoles;
  }

  /**
   * Get role IDs from both direct user bindings and group bindings at a specific scope
   */
  private static async getBindingRoleIds(
    userId: string,
    scopeType: ScopeType,
    scopeId: string
  ): Promise<string[]> {
    // Direct user bindings
    const directBindings = await db(this.TABLE)
      .where({ userId, scopeType, scopeId })
      .select('roleId');

    // Group bindings (user's groups)
    const groupBindings = await db(this.TABLE + ' as rb')
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
   * Count bindings for a role (for display in role list)
   */
  static async countByRoleId(roleId: string): Promise<{ userCount: number; groupCount: number }> {
    const [userResult, groupResult] = await Promise.all([
      db(this.TABLE)
        .where('roleId', roleId)
        .whereNotNull('userId')
        .countDistinct('userId as count')
        .first(),
      db(this.TABLE)
        .where('roleId', roleId)
        .whereNotNull('groupId')
        .countDistinct('groupId as count')
        .first(),
    ]);

    return {
      userCount: Number(userResult?.count || 0),
      groupCount: Number(groupResult?.count || 0),
    };
  }

  // ─── Helper: resolve scope IDs ─────────────────────────

  private static async getProjectFromEnv(environmentId: string): Promise<string | null> {
    const env = await db('g_environments').where('id', environmentId).select('projectId').first();
    return env?.projectId || null;
  }

  private static async resolveOrgId(scopeType: ScopeType, scopeId: string): Promise<string | null> {
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

  private static async invalidateGroupMembersCaches(groupId: string): Promise<void> {
    const members = await db('g_group_members').where('groupId', groupId).select('userId');
    for (const member of members) {
      await permissionService.invalidateUserCache(member.userId);
    }
  }
}

export default RoleBindingModel;
