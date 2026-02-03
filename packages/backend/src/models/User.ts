import bcrypt from 'bcryptjs';
import db from '../config/knex';
import logger from '../config/logger';
import {
  User as UserType,
  CreateUserData,
  UpdateUserData,
  UserWithoutPassword,
} from '../types/user';
import { Model } from 'objection';
import {
  convertDateFieldsForMySQL,
  convertDateFieldsFromMySQL,
  COMMON_DATE_FIELDS,
} from '../utils/dateUtils';

// Export User class for Objection.js models
export class User extends Model {
  static tableName = 'g_users';

  id!: number;
  email!: string;
  name!: string;
  passwordHash?: string;
  role!: string;
  status!: string;
  authType!: string;
  emailVerified!: boolean;
  emailVerifiedAt?: Date;
  lastLoginAt?: Date;
  avatarUrl?: string;
  preferredLanguage?: string;
  createdBy?: number;
  updatedBy?: number;
  createdAt!: Date;
  updatedAt!: Date;
}

export class UserModel {
  static async findById(id: number): Promise<UserWithoutPassword | null> {
    try {
      const user = await db('g_users')
        .select([
          'g_users.id',
          'g_users.email',
          'g_users.name',
          'g_users.avatarUrl',
          'g_users.preferredLanguage',
          'g_users.role',
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
          'role',
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

      const [insertId] = await db('g_users').insert({
        email: userData.email,
        passwordHash: passwordHash || null,
        name: userData.name,
        avatarUrl: userData.avatarUrl || null,
        preferredLanguage: userData.preferredLanguage || 'en',
        role: userData.role || 'user',
        status: userData.status || 'pending',
        authType: userData.authType || 'local',
        emailVerified: userData.emailVerified || false,
        createdBy: userData.createdBy || null,
      });

      const user = await this.findById(insertId);
      if (!user) {
        throw new Error('Failed to create user');
      }

      return user;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  static async update(id: number, userData: UpdateUserData): Promise<UserWithoutPassword | null> {
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

  static async delete(id: number): Promise<boolean> {
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
      role?: string | string[];
      role_operator?: 'any_of' | 'include_all';
      status?: string | string[];
      status_operator?: 'any_of' | 'include_all';
      search?: string;
      tags?: string[];
      tags_operator?: 'any_of' | 'include_all';
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

      // Build base query
      const baseQuery = () => db('g_users');

      // Apply filters function
      const applyFilters = (query: any) => {
        // Handle role filter (single or multiple)
        if (filters.role) {
          if (Array.isArray(filters.role)) {
            logger.info(`[UserModel] Applying role filter (array): ${filters.role.join(', ')}`);
            query.whereIn('g_users.role', filters.role);
          } else {
            logger.info(`[UserModel] Applying role filter (single): ${filters.role}`);
            query.where('g_users.role', filters.role);
          }
        }

        // Handle status filter (single or multiple)
        if (filters.status) {
          if (Array.isArray(filters.status)) {
            logger.info(`[UserModel] Applying status filter (array): ${filters.status.join(', ')}`);
            query.whereIn('g_users.status', filters.status);
          } else {
            logger.info(`[UserModel] Applying status filter (single): ${filters.status}`);
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
            // AND 조건: 모든 태그를 가진 사용자만 반환
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
            // OR 조건: 태그 중 하나라도 가진 사용자 반환
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
          'g_users.role',
          'g_users.status',
          'g_users.authType',
          'g_users.emailVerified',
          'g_users.emailVerifiedAt',
          'g_users.lastLoginAt',
          'g_users.createdAt',
          'g_users.updatedAt',
          'g_users.createdBy',
          'g_users.allowAllEnvironments',
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

      // Batch load environment assignments
      const envAssignments =
        userIds.length > 0
          ? await db('g_user_environments')
              .whereIn('userId', userIds)
              .select('userId', 'environment')
          : [];

      // Group environment names by user
      const envByUser = envAssignments.reduce((acc: any, env: any) => {
        if (!acc[env.userId]) acc[env.userId] = [];
        acc[env.userId].push(env.environment);
        return acc;
      }, {});

      // 각 사용자에 대해 태그 및 환경 정보 로드
      const usersWithExtras = await Promise.all(
        users.map(async (user: any) => {
          const tags = await this.getTags(user.id);
          return {
            ...user,
            tags,
            environments: envByUser[user.id] || [],
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

  static async updatePassword(id: number, newPassword: string): Promise<boolean> {
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

  static async updateLastLogin(id: number): Promise<void> {
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
  static async getTags(userId: number): Promise<any[]> {
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

  static async setTags(userId: number, tagIds: number[], updatedBy: number): Promise<void> {
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

  static async addTag(userId: number, tagId: number, createdBy: number): Promise<void> {
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

  static async removeTag(userId: number, tagId: number): Promise<void> {
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
  static async updateLanguage(userId: number, preferredLanguage: string): Promise<void> {
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
  static async searchUsers(query: string, limit: number = 20): Promise<UserWithoutPassword[]> {
    try {
      const users = await db('g_users')
        .select('id', 'name', 'email', 'role', 'status', 'avatarUrl', 'createdAt', 'updatedAt')
        .where('status', 'active') // 활성 사용자만 검색
        .andWhere(function () {
          this.where('name', 'like', `%${query}%`).orWhere('email', 'like', `%${query}%`);
        })
        .orderBy('name', 'asc')
        .limit(limit);

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
          'role',
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

  // Environment access methods

  /**
   * Get user's environment access settings
   */
  static async getEnvironmentAccess(userId: number): Promise<{
    allowAllEnvironments: boolean;
    environments: string[];
  }> {
    try {
      // Get allowAllEnvironments flag
      const user = await db('g_users').select('allowAllEnvironments').where('id', userId).first();

      if (!user) {
        throw new Error('User not found');
      }

      // Get specific environment assignments
      const environments = await db('g_user_environments')
        .select('environment')
        .where('userId', userId);

      return {
        allowAllEnvironments: !!user.allowAllEnvironments,
        environments: environments.map((e: any) => e.environment),
      };
    } catch (error) {
      logger.error('Error getting user environment access:', error);
      throw error;
    }
  }

  /**
   * Set user's environment access
   */
  static async setEnvironmentAccess(
    userId: number,
    allowAllEnvironments: boolean,
    environments: string[],
    updatedBy: number
  ): Promise<void> {
    try {
      await db.transaction(async (trx) => {
        // Update allowAllEnvironments flag
        await trx('g_users').where('id', userId).update({
          allowAllEnvironments,
          updatedBy,
          updatedAt: trx.fn.now(),
        });

        // Clear existing environment assignments
        await trx('g_user_environments').where('userId', userId).del();

        // Add new environment assignments (only if not allowAllEnvironments)
        if (!allowAllEnvironments && environments.length > 0) {
          const assignments = environments.map((environment) => ({
            userId,
            environment,
            createdBy: updatedBy,
            createdAt: new Date(),
          }));

          await trx('g_user_environments').insert(assignments);
        }
      });
    } catch (error) {
      logger.error('Error setting user environment access:', error);
      throw error;
    }
  }

  /**
   * Check if user has access to a specific environment
   */
  static async hasEnvironmentAccess(userId: number, environment: string): Promise<boolean> {
    try {
      const user = await db('g_users').select('allowAllEnvironments').where('id', userId).first();

      if (!user) {
        return false;
      }

      // Admin with all environments access
      if (user.allowAllEnvironments) {
        return true;
      }

      // Check specific environment assignment
      const assignment = await db('g_user_environments')
        .where('userId', userId)
        .where('environment', environment)
        .first();

      return !!assignment;
    } catch (error) {
      logger.error('Error checking user environment access:', error);
      return false;
    }
  }

  /**
   * Get accessible environment names for a user
   */
  static async getAccessibleEnvironments(userId: number): Promise<string[] | 'all'> {
    try {
      const user = await db('g_users').select('allowAllEnvironments').where('id', userId).first();

      if (!user) {
        return [];
      }

      if (user.allowAllEnvironments) {
        return 'all';
      }

      const environments = await db('g_user_environments')
        .select('environment')
        .where('userId', userId);

      return environments.map((e: any) => e.environment);
    } catch (error) {
      logger.error('Error getting accessible environment names:', error);
      return [];
    }
  }

  // Permission methods for RBAC

  /**
   * Get all permissions for a user
   */
  static async getPermissions(userId: number): Promise<string[]> {
    try {
      const permissions = await db('g_user_permissions')
        .select('permission')
        .where('userId', userId);

      return permissions.map((p: any) => p.permission);
    } catch (error) {
      logger.error('Error getting user permissions:', error);
      throw error;
    }
  }

  /**
   * Check if user has a specific permission
   * Supports wildcard '*' permission that grants all permissions
   */
  static async hasPermission(userId: number, permission: string): Promise<boolean> {
    try {
      // Check for wildcard permission or exact match
      const result = await db('g_user_permissions')
        .where('userId', userId)
        .where(function () {
          this.where('permission', permission).orWhere('permission', '*');
        })
        .first();

      return !!result;
    } catch (error) {
      logger.error('Error checking user permission:', error);
      return false;
    }
  }

  /**
   * Check if user has any of the specified permissions
   * Supports wildcard '*' permission that grants all permissions
   */
  static async hasAnyPermission(userId: number, permissions: string[]): Promise<boolean> {
    try {
      // Check for wildcard permission or any of the specified permissions
      const result = await db('g_user_permissions')
        .where('userId', userId)
        .where(function () {
          this.whereIn('permission', permissions).orWhere('permission', '*');
        })
        .first();

      return !!result;
    } catch (error) {
      logger.error('Error checking user permissions:', error);
      return false;
    }
  }

  /**
   * Set permissions for a user (replaces all existing permissions)
   */
  static async setPermissions(userId: number, permissions: string[]): Promise<void> {
    try {
      await db.transaction(async (trx) => {
        // Delete all existing permissions
        await trx('g_user_permissions').where('userId', userId).del();

        // Insert new permissions
        if (permissions.length > 0) {
          const permissionsToInsert = permissions.map((permission) => ({
            userId,
            permission,
          }));

          await trx('g_user_permissions').insert(permissionsToInsert);
        }
      });
    } catch (error) {
      logger.error('Error setting user permissions:', error);
      throw error;
    }
  }

  /**
   * Add a permission to a user
   */
  static async addPermission(userId: number, permission: string): Promise<void> {
    try {
      await db('g_user_permissions')
        .insert({ userId, permission })
        .onConflict(['userId', 'permission'])
        .ignore();
    } catch (error) {
      logger.error('Error adding user permission:', error);
      throw error;
    }
  }

  /**
   * Remove a permission from a user
   */
  static async removePermission(userId: number, permission: string): Promise<void> {
    try {
      await db('g_user_permissions').where('userId', userId).where('permission', permission).del();
    } catch (error) {
      logger.error('Error removing user permission:', error);
      throw error;
    }
  }
}
