import bcrypt from 'bcryptjs';
import { generateULID } from '../utils/ulid';
import db from '../config/knex';
import { createLogger } from '../config/logger';

const logger = createLogger('UserModel');
import { CreateUserData, UpdateUserData, UserWithoutPassword } from '../types/user';
import { Model } from 'objection';

// Export User class for Objection.js models
export class User extends Model {
  static tableName = 'g_users';

  id!: string;
  email!: string;
  name!: string;
  passwordHash?: string;

  status!: string;
  authType!: string;
  emailVerified!: boolean;
  emailVerifiedAt?: Date;
  lastLoginAt?: Date;
  avatarUrl?: string;
  preferredLanguage?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt!: Date;
  updatedAt!: Date;
}

export class UserModel {
  static async findById(id: string): Promise<UserWithoutPassword | null> {
    try {
      const user = await db('g_users')
        .select([
          'g_users.id',
          'g_users.email',
          'g_users.name',
          'g_users.avatarUrl',
          'g_users.preferredLanguage',
          'g_users.status',
          'g_users.authType',
          'g_users.emailVerified',
          'g_users.emailVerifiedAt',
          'g_users.lastLoginAt',
          'g_users.createdAt',
          'g_users.updatedAt',
          'g_users.createdBy',
          'creator.name as createdByName',
          'creator.email as createdByEmail',
        ])
        .leftJoin('g_users as creator', 'g_users.createdBy', 'creator.id')
        .where('g_users.id', id)
        .first();

      if (user) {
        // 태그 정보 로드
        const tags = await this.getTags(user.id);
        user.tags = tags;
      }

      return user || null;
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  static async findByEmail(email: string): Promise<User | null> {
    try {
      const user = await db('g_users').where('email', email).first();

      return user || null;
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  static async findByEmailWithoutPassword(email: string): Promise<UserWithoutPassword | null> {
    try {
      const user = await db('g_users')
        .select([
          'id',
          'email',
          'name',
          'avatarUrl',
          'preferredLanguage',

          'status',
          'emailVerified',
          'emailVerifiedAt',
          'lastLoginAt',
          'createdAt',
          'updatedAt',
        ])
        .where('email', email)
        .first();

      return user || null;
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  static async create(userData: CreateUserData): Promise<UserWithoutPassword> {
    try {
      let passwordHash: string | undefined;

      if (userData.password) {
        passwordHash = await bcrypt.hash(userData.password, 12);
      }

      const id = generateULID();

      await db('g_users').insert({
        id,
        email: userData.email,
        passwordHash: passwordHash || null,
        name: userData.name,
        avatarUrl: userData.avatarUrl || null,
        preferredLanguage: userData.preferredLanguage || 'en',

        status: userData.status || 'pending',
        authType: userData.authType || 'local',
        emailVerified: userData.emailVerified || false,
        createdBy: userData.createdBy || null,
      });

      const user = await this.findById(id);
      if (!user) {
        throw new Error('Failed to create user');
      }

      return user;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  static async update(id: string, userData: UpdateUserData): Promise<UserWithoutPassword | null> {
    try {
      const updateData: any = {};

      Object.entries(userData).forEach(([key, value]) => {
        if (value !== undefined) {
          updateData[key] = value;
        }
      });

      if (Object.keys(updateData).length === 0) {
        return this.findById(id);
      }

      updateData.updatedAt = db.fn.now();

      await db('g_users').where('id', id).update(updateData);

      return this.findById(id);
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  static async delete(id: string): Promise<boolean> {
    try {
      const result = await db('g_users').where('id', id).del();

      return result > 0;
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  static async findAll(
    page: number = 1,
    limit: number = 10,
    filters: {
      status?: string | string[];
      status_operator?: 'any_of' | 'include_all';
      search?: string;
      tags?: string[];
      tags_operator?: 'any_of' | 'include_all';
      orgId?: string;
    } = {}
  ): Promise<{
    users: UserWithoutPassword[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      // Ensure page and limit are integers
      const pageNum = parseInt(page.toString());
      const limitNum = parseInt(limit.toString());
      const offset = (pageNum - 1) * limitNum;

      // Build base query — scope to org if orgId filter is present
      const baseQuery = () => {
        const q = db('g_users');
        if (filters.orgId) {
          q.join('g_organisation_members as om', function () {
            this.on('om.userId', '=', 'g_users.id').andOn(
              'om.orgId',
              '=',
              db.raw('?', [filters.orgId])
            );
          });
        }
        return q;
      };

      // Apply filters function
      const applyFilters = (query: any) => {
        // Handle status filter (single or multiple)
        if (filters.status) {
          if (Array.isArray(filters.status)) {
            logger.info(`Applying status filter (array): ${filters.status.join(', ')}`);
            query.whereIn('g_users.status', filters.status);
          } else {
            logger.info(`Applying status filter (single): ${filters.status}`);
            query.where('g_users.status', filters.status);
          }
        }

        if (filters.search) {
          query.where(function (this: any) {
            this.where('g_users.name', 'like', `%${filters.search}%`).orWhere(
              'g_users.email',
              'like',
              `%${filters.search}%`
            );
          });
        }

        if (filters.tags && filters.tags.length > 0) {
          const tagsOperator = filters.tags_operator || 'include_all'; // Default to include_all (AND)

          if (tagsOperator === 'include_all') {
            // AND: only users with all specified tags
            filters.tags.forEach((tagId: string) => {
              query.whereExists(function (this: any) {
                this.select('*')
                  .from('g_tag_assignments')
                  .whereRaw('g_tag_assignments.entityId = g_users.id')
                  .where('g_tag_assignments.entityType', 'user')
                  .where('g_tag_assignments.tagId', tagId);
              });
            });
          } else {
            // OR: users with any of the specified tags
            query.whereExists(function (this: any) {
              this.select('*')
                .from('g_tag_assignments')
                .whereRaw('g_tag_assignments.entityId = g_users.id')
                .where('g_tag_assignments.entityType', 'user')
                .whereIn('g_tag_assignments.tagId', filters.tags!);
            });
          }
        }

        return query;
      };

      // Get total count
      const countQuery = applyFilters(baseQuery()).count('g_users.id as total').first();

      // Get users with camelCase field names
      const usersQuery = applyFilters(
        db('g_users').leftJoin('g_users as creator', 'g_users.createdBy', 'creator.id')
      )
        .select([
          'g_users.id',
          'g_users.email',
          'g_users.name',
          'g_users.avatarUrl',
          'g_users.preferredLanguage',
          'g_users.status',
          'g_users.authType',
          'g_users.emailVerified',
          'g_users.emailVerifiedAt',
          'g_users.lastLoginAt',
          'g_users.createdAt',
          'g_users.updatedAt',
          'g_users.createdBy',
          'creator.name as createdByName',
          'creator.email as createdByEmail',
        ])
        .orderBy('g_users.createdAt', 'desc')
        .limit(limitNum)
        .offset(offset);

      // Execute queries in parallel
      const [countResult, users] = await Promise.all([countQuery, usersQuery]);

      const total = countResult?.total || 0;

      // Get all user IDs for batch loading
      const userIds = users.map((u: any) => u.id);

      // Load tags for all users
      const usersWithExtras = await Promise.all(
        users.map(async (user: any) => {
          const tags = await this.getTags(user.id);
          return {
            ...user,
            tags,
          };
        })
      );

      return {
        users: usersWithExtras,
        total,
        page: pageNum,
        limit: limitNum,
      };
    } catch (error) {
      logger.error('Error finding all users:', error);
      throw error;
    }
  }

  static async verifyPassword(user: User, password: string): Promise<boolean> {
    try {
      if (!user.passwordHash) {
        return false;
      }
      return await bcrypt.compare(password, user.passwordHash);
    } catch (error) {
      logger.error('Error verifying password:', error);
      return false;
    }
  }

  static async updatePassword(id: string, newPassword: string): Promise<boolean> {
    try {
      const passwordHash = await bcrypt.hash(newPassword, 12);
      const result = await db('g_users').where('id', id).update({
        passwordHash,
        updatedAt: db.fn.now(),
      });

      return result > 0;
    } catch (error) {
      logger.error('Error updating password:', error);
      throw error;
    }
  }

  static async updateLastLogin(id: string): Promise<void> {
    try {
      await db('g_users').where('id', id).update({
        lastLoginAt: db.fn.now(),
      });
    } catch (error) {
      logger.error('Error updating last login:', error);
      // Don't throw error for this non-critical operation
    }
  }

  // 태그 관련 메서드들
  static async getTags(userId: string): Promise<any[]> {
    try {
      const tags = await db('g_tag_assignments')
        .join('g_tags', 'g_tag_assignments.tagId', 'g_tags.id')
        .select([
          'g_tags.id',
          'g_tags.name',
          'g_tags.color',
          'g_tags.description',
          'g_tags.createdAt',
          'g_tags.updatedAt',
        ])
        .where('g_tag_assignments.entityType', 'user')
        .where('g_tag_assignments.entityId', userId)
        .orderBy('g_tags.name');

      return tags;
    } catch (error) {
      logger.error('Error getting user tags:', error);
      throw error;
    }
  }

  static async setTags(
    userId: string,
    tagIds: (string | number)[],
    updatedBy: string
  ): Promise<void> {
    try {
      await db.transaction(async (trx) => {
        // 기존 태그 할당 삭제
        await trx('g_tag_assignments').where('entityType', 'user').where('entityId', userId).del();

        // 새 태그 할당 추가
        if (tagIds.length > 0) {
          const assignments = tagIds.map((tagId) => ({
            tagId,
            entityType: 'user',
            entityId: userId,
            createdBy: updatedBy,
            updatedBy: updatedBy,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

          await trx('g_tag_assignments').insert(assignments);
        }
      });
    } catch (error) {
      logger.error('Error setting user tags:', error);
      throw error;
    }
  }

  static async addTag(userId: string, tagId: string, createdBy: string): Promise<void> {
    try {
      await db('g_tag_assignments').insert({
        tagId,
        entityType: 'user',
        entityId: userId,
        createdBy,
        updatedBy: createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      logger.error('Error adding user tag:', error);
      throw error;
    }
  }

  static async removeTag(userId: string, tagId: string): Promise<void> {
    try {
      await db('g_tag_assignments')
        .where('entityType', 'user')
        .where('entityId', userId)
        .where('tagId', tagId)
        .del();
    } catch (error) {
      logger.error('Error removing user tag:', error);
      throw error;
    }
  }

  /**
   * Update user's preferred language
   */
  static async updateLanguage(userId: string, preferredLanguage: string): Promise<void> {
    try {
      await db('g_users').where('id', userId).update({
        preferredLanguage,
      });
    } catch (error) {
      logger.error('Error updating user language:', error);
      throw error;
    }
  }

  /**
   * Search users by name or email
   */
  static async searchUsers(query: string, limit: number = 20, orgId?: string): Promise<UserWithoutPassword[]> {
    try {
      const q = db('g_users')
        .select('g_users.id', 'g_users.name', 'g_users.email', 'g_users.status', 'g_users.avatarUrl', 'g_users.createdAt', 'g_users.updatedAt')
        .where('g_users.status', 'active')
        .andWhere(function () {
          this.where('g_users.name', 'like', `%${query}%`).orWhere('g_users.email', 'like', `%${query}%`);
        })
        .orderBy('g_users.name', 'asc')
        .limit(limit);

      // Scope to organisation members if orgId is provided
      if (orgId) {
        q.join('g_organisation_members as om', function () {
          this.on('om.userId', '=', 'g_users.id')
            .andOn('om.orgId', '=', db.raw('?', [orgId]));
        });
      }

      const users = await q;
      return users;
    } catch (error) {
      logger.error('Error searching users:', error);
      throw error;
    }
  }

  /**
   * Get users updated since a specific date for synchronization
   */
  static async getUsersForSync(since: Date): Promise<UserWithoutPassword[]> {
    try {
      const users = await db('g_users')
        .select([
          'id',
          'email',
          'name',
          'avatarUrl',

          'status',
          'lastLoginAt',
          'createdAt',
          'updatedAt',
        ])
        .where('status', 'active') // 활성 사용자만 동기화
        .andWhere(function () {
          this.where('updatedAt', '>=', since).orWhere('createdAt', '>=', since);
        })
        .orderBy('updatedAt', 'desc');

      return users;
    } catch (error) {
      logger.error('Error getting users for sync:', error);
      throw error;
    }
  }

  // Permission methods for RBAC

  /**
   * Get all permissions for a user (from role bindings + role permissions)
   */
  static async getPermissions(userId: string): Promise<string[]> {
    try {
      // Get all role IDs from direct bindings
      const directBindings = await db('g_role_bindings')
        .where('userId', userId)
        .select('roleId');

      // Get all role IDs from group bindings
      const groupBindings = await db('g_role_bindings as rb')
        .join('g_group_members as gm', 'rb.groupId', 'gm.groupId')
        .where('gm.userId', userId)
        .whereNotNull('rb.groupId')
        .select('rb.roleId');

      const roleIds = [
        ...new Set([
          ...directBindings.map((r: any) => r.roleId),
          ...groupBindings.map((r: any) => r.roleId),
        ]),
      ];

      if (roleIds.length === 0) {
        return [];
      }

      // Get permissions from g_role_permissions
      const perms = await db('g_role_permissions')
        .whereIn('roleId', roleIds)
        .select('permission')
        .distinct();

      return perms.map((p: any) => p.permission);
    } catch (error) {
      logger.error('Error getting user permissions:', error);
      throw error;
    }
  }

  /**
   * Check if user has a specific permission
   * Supports wildcard '*' permission that grants all permissions
   */
  static async hasPermission(userId: string, permission: string): Promise<boolean> {
    try {
      const permissions = await this.getPermissions(userId);
      return permissions.includes('*') || permissions.includes(permission);
    } catch (error) {
      logger.error('Error checking user permission:', error);
      return false;
    }
  }

  /**
   * Check if user has any of the specified permissions
   * Supports wildcard '*' permission that grants all permissions
   */
  static async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    try {
      const userPerms = await this.getPermissions(userId);
      if (userPerms.includes('*')) return true;
      return permissions.some((p) => userPerms.includes(p));
    } catch (error) {
      logger.error('Error checking user permissions:', error);
      return false;
    }
  }
}
