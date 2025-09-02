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
          'g_users.role',
          'g_users.status',
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
        role: userData.role || 'user',
        status: userData.status || 'pending',
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
    filters: { role?: string; status?: string; search?: string } = {}
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
          'g_users.role',
          'g_users.status',
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

      return {
        users,
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
}
