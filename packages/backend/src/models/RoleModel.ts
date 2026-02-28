import db from '../config/knex';
import { generateULID } from '../utils/ulid';
import { createLogger } from '../config/logger';
import { permissionService } from '../services/PermissionService';

const logger = createLogger('RoleModel');

// ==================== Types ====================

export interface RoleRecord {
  id: string;
  orgId: string;
  roleName: string;
  description: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RolePermissions {
  org: string[];
  project: Array<{ projectId: string; permission: string; isAdmin: boolean }>;
  env: Array<{ environmentId: string; permission: string; isAdmin: boolean }>;
}

export interface CreateRoleData {
  orgId: string;
  roleName: string;
  description?: string;
  createdBy: string;
}

export interface UpdateRoleData {
  roleName?: string;
  description?: string;
  updatedBy: string;
}

// ==================== Model ====================

export class RoleModel {
  private static readonly TABLE = 'g_roles';
  private static readonly ORG_PERMS_TABLE = 'g_role_org_permissions';
  private static readonly PROJECT_PERMS_TABLE = 'g_role_project_permissions';
  private static readonly ENV_PERMS_TABLE = 'g_role_environment_permissions';

  // ─── Role CRUD ─────────────────────────

  static async create(data: CreateRoleData): Promise<RoleRecord> {
    const id = generateULID();
    await db(this.TABLE).insert({
      id,
      orgId: data.orgId,
      roleName: data.roleName,
      description: data.description || null,
      createdBy: data.createdBy,
    });

    const role = await this.findById(id);
    if (!role) throw new Error('Failed to create role');
    return role;
  }

  static async findById(id: string): Promise<RoleRecord | null> {
    const row = await db(this.TABLE).where('id', id).first();
    return row || null;
  }

  static async findByOrgId(orgId: string): Promise<RoleRecord[]> {
    return db(this.TABLE).where('orgId', orgId).orderBy('roleName', 'asc');
  }

  static async findByName(orgId: string, roleName: string): Promise<RoleRecord | null> {
    const row = await db(this.TABLE).where('orgId', orgId).where('roleName', roleName).first();
    return row || null;
  }

  static async update(id: string, data: UpdateRoleData): Promise<RoleRecord | null> {
    const updateData: any = { updatedBy: data.updatedBy };
    if (data.roleName !== undefined) updateData.roleName = data.roleName;
    if (data.description !== undefined) updateData.description = data.description;

    await db(this.TABLE).where('id', id).update(updateData);
    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    // Cascade delete handles permissions via FK
    const result = await db(this.TABLE).where('id', id).del();
    if (result > 0) {
      // Invalidate caches
      await permissionService.invalidateRoleCache(id);
    }
    return result > 0;
  }

  // ─── Permissions ─────────────────────────

  static async getPermissions(roleId: string): Promise<RolePermissions> {
    const [orgPerms, projectPerms, envPerms] = await Promise.all([
      db(this.ORG_PERMS_TABLE).where('roleId', roleId).select('permission'),
      db(this.PROJECT_PERMS_TABLE)
        .where('roleId', roleId)
        .select('projectId', 'permission', 'isAdmin'),
      db(this.ENV_PERMS_TABLE)
        .where('roleId', roleId)
        .select('environmentId', 'permission', 'isAdmin'),
    ]);

    return {
      org: orgPerms.map((r: any) => r.permission),
      project: projectPerms.map((r: any) => ({
        projectId: r.projectId,
        permission: r.permission,
        isAdmin: !!r.isAdmin,
      })),
      env: envPerms.map((r: any) => ({
        environmentId: r.environmentId,
        permission: r.permission,
        isAdmin: !!r.isAdmin,
      })),
    };
  }

  /**
   * Set permissions for a role (replaces all existing permissions)
   */
  static async setPermissions(roleId: string, permissions: RolePermissions): Promise<void> {
    await db.transaction(async (trx) => {
      // Clear existing
      await trx(this.ORG_PERMS_TABLE).where('roleId', roleId).del();
      await trx(this.PROJECT_PERMS_TABLE).where('roleId', roleId).del();
      await trx(this.ENV_PERMS_TABLE).where('roleId', roleId).del();

      // Insert org permissions
      if (permissions.org.length > 0) {
        await trx(this.ORG_PERMS_TABLE).insert(
          permissions.org.map((perm) => ({
            id: generateULID(),
            roleId,
            permission: perm,
          }))
        );
      }

      // Insert project permissions
      if (permissions.project.length > 0) {
        await trx(this.PROJECT_PERMS_TABLE).insert(
          permissions.project.map((p) => ({
            id: generateULID(),
            roleId,
            projectId: p.projectId,
            permission: p.permission,
            isAdmin: p.isAdmin,
          }))
        );
      }

      // Insert env permissions
      if (permissions.env.length > 0) {
        await trx(this.ENV_PERMS_TABLE).insert(
          permissions.env.map((e) => ({
            id: generateULID(),
            roleId,
            environmentId: e.environmentId,
            permission: e.permission,
            isAdmin: e.isAdmin,
          }))
        );
      }
    });

    // Invalidate role cache
    await permissionService.invalidateRoleCache(roleId);
  }

  /**
   * Get role with full details (including permissions and assigned users/groups count)
   */
  static async getWithDetails(
    roleId: string
  ): Promise<
    (RoleRecord & { permissions: RolePermissions; userCount: number; groupCount: number }) | null
  > {
    const role = await this.findById(roleId);
    if (!role) return null;

    const [permissions, userCountResult, groupCountResult] = await Promise.all([
      this.getPermissions(roleId),
      db('g_user_roles').where('roleId', roleId).count('id as count').first(),
      db('g_group_roles').where('roleId', roleId).count('id as count').first(),
    ]);

    return {
      ...role,
      permissions,
      userCount: Number(userCountResult?.count || 0),
      groupCount: Number(groupCountResult?.count || 0),
    };
  }
}

export default RoleModel;
