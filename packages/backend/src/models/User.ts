import bcrypt from 'bcryptjs';
import database from '../config/database';
import logger from '../config/logger';
import { User, CreateUserData, UpdateUserData, UserWithoutPassword } from '../types/user';

export class UserModel {
  static async findById(id: number): Promise<UserWithoutPassword | null> {
    try {
      const rows = await database.query(
        `SELECT id, email, name, avatarUrl, role, status,
                emailVerified as email_verified,
                emailVerifiedAt as email_verified_at,
                lastLoginAt as last_login_at,
                createdAt as created_at,
                updatedAt as updated_at
         FROM g_users WHERE id = ?`,
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  static async findByEmail(email: string): Promise<User | null> {
    try {
      const rows = await database.query(
        'SELECT * FROM g_users WHERE email = ?',
        [email]
      );
      return rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  static async findByEmailWithoutPassword(email: string): Promise<UserWithoutPassword | null> {
    try {
      const rows = await database.query(
        `SELECT id, email, name, avatarUrl, role, status,
                emailVerified as email_verified,
                emailVerifiedAt as email_verified_at,
                lastLoginAt as last_login_at,
                createdAt as created_at,
                updatedAt as updated_at
         FROM g_users WHERE email = ?`,
        [email]
      );
      return rows[0] || null;
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

      const result = await database.query(
        `INSERT INTO g_users (email, passwordHash, name, avatarUrl, role, status, emailVerified)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userData.email,
          passwordHash || null,
          userData.name,
          userData.avatarUrl || null,
          userData.role || 'user',
          userData.status || 'pending',
          userData.emailVerified || false
        ]
      );

      const user = await this.findById(result.insertId);
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
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      Object.entries(userData).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`${key} = ?`);
          updateValues.push(value);
        }
      });

      if (updateFields.length === 0) {
        return this.findById(id);
      }

      updateValues.push(id);

      await database.query(
        `UPDATE g_users SET ${updateFields.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
        updateValues
      );

      return this.findById(id);
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  static async delete(id: number): Promise<boolean> {
    try {
      const result = await database.query('DELETE FROM g_users WHERE id = ?', [id]);
      return result.affectedRows > 0;
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
      const whereConditions: string[] = [];
      const whereValues: any[] = [];

      if (filters.role) {
        whereConditions.push('role = ?');
        whereValues.push(filters.role);
      }

      if (filters.status) {
        whereConditions.push('status = ?');
        whereValues.push(filters.status);
      }

      if (filters.search) {
        whereConditions.push('(name LIKE ? OR email LIKE ?)');
        whereValues.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await database.query(
        `SELECT COUNT(*) as total FROM g_users ${whereClause}`,
        whereValues
      );
      const total = countResult[0].total;

      // Get users with field name conversion for frontend compatibility
      const users = await database.query(
        `SELECT id, email, name, avatarUrl, role, status,
                emailVerified as email_verified,
                emailVerifiedAt as email_verified_at,
                lastLoginAt as last_login_at,
                createdAt as created_at,
                updatedAt as updated_at
         FROM g_users ${whereClause}
         ORDER BY createdAt DESC
         LIMIT ${limitNum} OFFSET ${offset}`,
        whereValues
      );

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
      const result = await database.query(
        'UPDATE g_users SET passwordHash = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
        [passwordHash, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      logger.error('Error updating password:', error);
      throw error;
    }
  }

  static async updateLastLogin(id: number): Promise<void> {
    try {
      await database.query(
        'UPDATE g_users SET lastLoginAt = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
    } catch (error) {
      logger.error('Error updating last login:', error);
      // Don't throw error for this non-critical operation
    }
  }
}
