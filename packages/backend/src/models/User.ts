import bcrypt from 'bcryptjs';
import db from '../config/knex';
import logger from '../config/logger';
import { User, CreateUserData, UpdateUserData, UserWithoutPassword } from '../types/user';

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
          'creator.email as createdByEmail'
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
      const user = await db('g_users')
        .where('email', email)
        .first();

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
          'updatedAt'
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
        createdBy: userData.createdBy || null
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

      await db('g_users')
        .where('id', id)
        .update(updateData);

      return this.findById(id);
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  static async delete(id: number): Promise<boolean> {
    try {
      const result = await db('g_users')
        .where('id', id)
        .del();

      return result > 0;
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  static async findAll(
    page: number = 1,
    limit: number = 10,
    filters: { role?: string; status?: string; search?: string; tags?: string[] } = {}
  ): Promise<{ users: UserWithoutPassword[]; total: number; page: number; limit: number }> {
    try {
      // Ensure page and limit are integers
      const pageNum = parseInt(page.toString());
      const limitNum = parseInt(limit.toString());
      const offset = (pageNum - 1) * limitNum;

      // Build base query
      const baseQuery = () => db('g_users');

      // Apply filters function
      const applyFilters = (query: any) => {
        if (filters.role) {
          query.where('g_users.role', filters.role);
        }

        if (filters.status) {
          query.where('g_users.status', filters.status);
        }

        if (filters.search) {
          query.where(function(this: any) {
            this.where('g_users.name', 'like', `%${filters.search}%`)
                .orWhere('g_users.email', 'like', `%${filters.search}%`);
          });
        }

        if (filters.tags && filters.tags.length > 0) {
          // AND 조건: 모든 태그를 가진 사용자만 반환
          filters.tags.forEach((tagId: string) => {
            query.whereExists(function(this: any) {
              this.select('*')
                  .from('g_tag_assignments')
                  .whereRaw('g_tag_assignments.entityId = g_users.id')
                  .where('g_tag_assignments.entityType', 'user')
                  .where('g_tag_assignments.tagId', tagId);
            });
          });
        }

        return query;
      };

      // Get total count
      const countQuery = applyFilters(baseQuery())
        .count('g_users.id as total')
        .first();

      // Get users with camelCase field names
      const usersQuery = applyFilters(
        db('g_users')
          .leftJoin('g_users as creator', 'g_users.createdBy', 'creator.id')
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
          'creator.name as createdByName',
          'creator.email as createdByEmail'
        ])
        .orderBy('g_users.createdAt', 'desc')
        .limit(limitNum)
        .offset(offset);

      // Execute queries in parallel
      const [countResult, users] = await Promise.all([
        countQuery,
        usersQuery
      ]);

      const total = countResult?.total || 0;

      // 각 사용자에 대해 태그 정보 로드
      const usersWithTags = await Promise.all(
        users.map(async (user: any) => {
          const tags = await this.getTags(user.id);
          return {
            ...user,
            tags
          };
        })
      );

      return {
        users: usersWithTags,
        total,
        page: pageNum,
        limit: limitNum
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
      const result = await db('g_users')
        .where('id', id)
        .update({
          passwordHash,
          updatedAt: db.fn.now()
        });

      return result > 0;
    } catch (error) {
      logger.error('Error updating password:', error);
      throw error;
    }
  }

  static async updateLastLogin(id: number): Promise<void> {
    try {
      await db('g_users')
        .where('id', id)
        .update({
          lastLoginAt: db.fn.now()
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
          'g_tags.updatedAt'
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
        await trx('g_tag_assignments')
          .where('entityType', 'user')
          .where('entityId', userId)
          .del();

        // 새 태그 할당 추가
        if (tagIds.length > 0) {
          const assignments = tagIds.map(tagId => ({
            tagId,
            entityType: 'user',
            entityId: userId,
            createdBy: updatedBy,
            updatedBy: updatedBy,
            createdAt: new Date(),
            updatedAt: new Date()
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
        updatedAt: new Date()
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
      await db('g_users')
        .where('id', userId)
        .update({
          preferredLanguage
        });
    } catch (error) {
      logger.error('Error updating user language:', error);
      throw error;
    }
  }
}
