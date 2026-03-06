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
  private static readonly PERMISSIONS_TABLE = 'g_role_permissions';

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
    // Cascade delete handles permissions and bindings via FK
    const result = await db(this.TABLE).where('id', id).del();
    if (result > 0) {
      await permissionService.invalidateRoleCache(id);
    }
    return result > 0;
  }

  // ─── Permissions (g_role_permissions) ─────────────────────────

  /**
   * Get permissions for a role (pure permission strings, no scope)
   */
  static async getPermissions(roleId: string): Promise<string[]> {
    const rows = await db(this.PERMISSIONS_TABLE)
      .where('roleId', roleId)
      .select('permission');
    return rows.map((r: any) => r.permission);
  }

  /**
   * Set permissions for a role (replaces all existing)
   */
  static async setPermissions(roleId: string, permissions: string[]): Promise<void> {
    await db.transaction(async (trx) => {
      // Clear existing
      await trx(this.PERMISSIONS_TABLE).where('roleId', roleId).del();

      // Insert new
      if (permissions.length > 0) {
        // Deduplicate
        const uniquePerms = [...new Set(permissions)];
        await trx(this.PERMISSIONS_TABLE).insert(
          uniquePerms.map((perm) => ({
            id: generateULID(),
            roleId,
            permission: perm,
          }))
        );
      }
    });

    // Invalidate role cache
    await permissionService.invalidateRoleCache(roleId);
  }

  /**
   * Get role with full details (permissions + binding counts)
   */
  static async getWithDetails(
    roleId: string
  ): Promise<
    (RoleRecord & { permissions: string[]; userCount: number; groupCount: number }) | null
  > {
    const role = await this.findById(roleId);
    if (!role) return null;

    const [permissions, userCountResult, groupCountResult] = await Promise.all([
      this.getPermissions(roleId),
      db('g_role_bindings')
        .where('roleId', roleId)
        .whereNotNull('userId')
        .countDistinct('userId as count')
        .first(),
      db('g_role_bindings')
        .where('roleId', roleId)
        .whereNotNull('groupId')
        .countDistinct('groupId as count')
        .first(),
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
