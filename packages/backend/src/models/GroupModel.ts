import db from '../config/knex';
import { generateULID } from '../utils/ulid';
import { createLogger } from '../config/logger';
import { permissionService } from '../services/PermissionService';

const logger = createLogger('GroupModel');

// ==================== Types ====================

export interface GroupRecord {
  id: string;
  orgId: string;
  groupName: string;
  description: string | null;
  addNewUsersByDefault: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupMemberRecord {
  id: string;
  groupId: string;
  userId: string;
  isGroupAdmin: boolean;
  addedBy: string | null;
  addedAt: Date;
  // Joined fields
  name?: string;
  email?: string;
}

export interface CreateGroupData {
  orgId: string;
  groupName: string;
  description?: string;
  addNewUsersByDefault?: boolean;
  createdBy: string;
}

export interface UpdateGroupData {
  groupName?: string;
  description?: string;
  addNewUsersByDefault?: boolean;
  updatedBy: string;
}

// ==================== Model ====================

export class GroupModel {
  private static readonly TABLE = 'g_groups';
  private static readonly MEMBERS_TABLE = 'g_group_members';
  private static readonly ROLES_TABLE = 'g_group_roles';

  // ─── Group CRUD ─────────────────────────

  static async create(data: CreateGroupData): Promise<GroupRecord> {
    const id = generateULID();
    await db(this.TABLE).insert({
      id,
      orgId: data.orgId,
      groupName: data.groupName,
      description: data.description || null,
      addNewUsersByDefault: data.addNewUsersByDefault || false,
      createdBy: data.createdBy,
    });

    const group = await this.findById(id);
    if (!group) throw new Error('Failed to create group');
    return group;
  }

  static async findById(id: string): Promise<GroupRecord | null> {
    const row = await db(this.TABLE).where('id', id).first();
    return row || null;
  }

  static async findByOrgId(orgId: string): Promise<GroupRecord[]> {
    return db(this.TABLE).where('orgId', orgId).orderBy('groupName', 'asc');
  }

  static async findByName(orgId: string, groupName: string): Promise<GroupRecord | null> {
    const row = await db(this.TABLE).where('orgId', orgId).where('groupName', groupName).first();
    return row || null;
  }

  static async update(id: string, data: UpdateGroupData): Promise<GroupRecord | null> {
    const updateData: any = { updatedBy: data.updatedBy };
    if (data.groupName !== undefined) updateData.groupName = data.groupName;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.addNewUsersByDefault !== undefined) {
      updateData.addNewUsersByDefault = data.addNewUsersByDefault;
    }

    await db(this.TABLE).where('id', id).update(updateData);
    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    const result = await db(this.TABLE).where('id', id).del();
    return result > 0;
  }

  // ─── Members ─────────────────────────

  static async addMember(
    groupId: string,
    userId: string,
    isGroupAdmin: boolean = false,
    addedBy?: string
  ): Promise<void> {
    const id = generateULID();
    await db(this.MEMBERS_TABLE).insert({
      id,
      groupId,
      userId,
      isGroupAdmin,
      addedBy: addedBy || null,
    });

    // Invalidate user's role cache (group membership affects permissions)
    await permissionService.invalidateUserCache(userId);
  }

  static async removeMember(groupId: string, userId: string): Promise<boolean> {
    const result = await db(this.MEMBERS_TABLE)
      .where('groupId', groupId)
      .where('userId', userId)
      .del();

    if (result > 0) {
      await permissionService.invalidateUserCache(userId);
    }
    return result > 0;
  }

  static async getMembers(groupId: string): Promise<GroupMemberRecord[]> {
    return db(this.MEMBERS_TABLE)
      .select([`${this.MEMBERS_TABLE}.*`, 'u.name', 'u.email'])
      .join('g_users as u', `${this.MEMBERS_TABLE}.userId`, 'u.id')
      .where(`${this.MEMBERS_TABLE}.groupId`, groupId)
      .orderBy('u.name', 'asc');
  }

  // ─── Roles ─────────────────────────

  static async addRole(groupId: string, roleId: string, assignedBy?: string): Promise<void> {
    const id = generateULID();
    await db(this.ROLES_TABLE).insert({
      id,
      groupId,
      roleId,
      assignedBy: assignedBy || null,
    });

    // Invalidate all group members' caches
    const members = await db(this.MEMBERS_TABLE).where('groupId', groupId).select('userId');
    for (const member of members) {
      await permissionService.invalidateUserCache(member.userId);
    }
  }

  static async removeRole(groupId: string, roleId: string): Promise<boolean> {
    const result = await db(this.ROLES_TABLE)
      .where('groupId', groupId)
      .where('roleId', roleId)
      .del();

    if (result > 0) {
      const members = await db(this.MEMBERS_TABLE).where('groupId', groupId).select('userId');
      for (const member of members) {
        await permissionService.invalidateUserCache(member.userId);
      }
    }
    return result > 0;
  }

  static async getRoles(groupId: string): Promise<any[]> {
    return db(this.ROLES_TABLE)
      .select([`${this.ROLES_TABLE}.*`, 'r.roleName', 'r.description as roleDescription'])
      .join('g_roles as r', `${this.ROLES_TABLE}.roleId`, 'r.id')
      .where(`${this.ROLES_TABLE}.groupId`, groupId)
      .orderBy('r.roleName', 'asc');
  }

  /**
   * Get groups with member & role counts
   */
  static async findByOrgIdWithCounts(
    orgId: string
  ): Promise<(GroupRecord & { memberCount: number; roleCount: number })[]> {
    const groups = await this.findByOrgId(orgId);
    const groupIds = groups.map((g) => g.id);

    if (groupIds.length === 0) return [];

    const [memberCounts, roleCounts] = await Promise.all([
      db(this.MEMBERS_TABLE)
        .select('groupId')
        .count('id as count')
        .whereIn('groupId', groupIds)
        .groupBy('groupId'),
      db(this.ROLES_TABLE)
        .select('groupId')
        .count('id as count')
        .whereIn('groupId', groupIds)
        .groupBy('groupId'),
    ]);

    const memberMap = new Map(memberCounts.map((r: any) => [r.groupId, Number(r.count)]));
    const roleMap = new Map(roleCounts.map((r: any) => [r.groupId, Number(r.count)]));

    return groups.map((g) => ({
      ...g,
      memberCount: memberMap.get(g.id) || 0,
      roleCount: roleMap.get(g.id) || 0,
    }));
  }

  /**
   * Get all default-join groups for an org (addNewUsersByDefault = true)
   */
  static async getDefaultGroups(orgId: string): Promise<GroupRecord[]> {
    return db(this.TABLE).where('orgId', orgId).where('addNewUsersByDefault', true);
  }
}

export default GroupModel;
