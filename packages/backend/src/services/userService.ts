import { UserModel } from '../models/User';
import { UserWithoutPassword } from '../types/user';
import { CustomError } from '../middleware/errorHandler';
import logger from '../config/logger';
import EmailService from './EmailService';

export interface UserFilters {
  role?: string;
  status?: string;
  search?: string;
  tags?: string[];
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface UserListResponse {
  users: UserWithoutPassword[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class UserService {
  static async createUser(userData: {
    name: string;
    email: string;
    password: string;
    role?: 'admin' | 'user';
    status?: 'active' | 'pending' | 'suspended';
    emailVerified?: boolean;
    createdBy?: number;
  }): Promise<UserWithoutPassword> {
    try {
      // Check if user already exists
      const existingUser = await UserModel.findByEmail(userData.email);
      if (existingUser) {
        throw new CustomError('User with this email already exists', 400);
      }

      const user = await UserModel.create({
        name: userData.name,
        email: userData.email,
        password: userData.password,
        role: userData.role || 'user',
        status: userData.status || 'active',
        emailVerified: userData.emailVerified || true,
        createdBy: userData.createdBy,
      });

      logger.info('User created successfully:', {
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      return user;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error creating user:', error);
      throw new CustomError('Failed to create user', 500);
    }
  }

  static async getAllUsers(
    filters: UserFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<UserListResponse> {
    try {
      const page = parseInt(pagination.page?.toString() || '1');
      const limit = Math.min(parseInt(pagination.limit?.toString() || '10'), 100); // Max 100 items per page

      const result = await UserModel.findAll(page, limit, filters);

      return {
        ...result,
        totalPages: Math.ceil(result.total / limit),
      };
    } catch (error) {
      logger.error('Error getting all users:', error);
      throw new CustomError('Failed to get users', 500);
    }
  }

  static async getUserById(id: number): Promise<UserWithoutPassword> {
    try {
      const user = await UserModel.findById(id);
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      return user;
    } catch (error) {
      logger.error('Error getting user by ID:', error);
      throw new CustomError('Failed to get user', 500);
    }
  }

  static async updateUser(id: number, updateData: any): Promise<UserWithoutPassword> {
    try {
      // Validate updates for admin
      const allowedFields = ['name', 'email', 'status', 'role', 'avatarUrl'];
      const filteredUpdates: any = {};

      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key)) {
          filteredUpdates[key] = value;
        }
      }

      if (Object.keys(filteredUpdates).length === 0) {
        throw new CustomError('No valid fields to update', 400);
      }

      const user = await UserModel.update(id, filteredUpdates);
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      logger.info('User updated successfully:', {
        userId: id,
        updates: Object.keys(filteredUpdates),
      });

      return user;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error updating user:', error);
      throw new CustomError('Failed to update user', 500);
    }
  }

  static async deleteUser(id: number): Promise<void> {
    try {
      const user = await UserModel.findById(id);
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      await UserModel.delete(id);

      logger.info('User deleted successfully:', {
        userId: id,
        userEmail: user.email,
      });
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error deleting user:', error);
      throw new CustomError('Failed to delete user', 500);
    }
  }

  static async getUserStats(): Promise<{
    total: number;
    active: number;
    pending: number;
    suspended: number;
    admins: number;
  }> {
    try {
      const [total, active, pending, suspended, admins] = await Promise.all([
        UserModel.findAll(1, 1, {}).then(result => result.total),
        UserModel.findAll(1, 1, { status: 'active' }).then(result => result.total),
        UserModel.findAll(1, 1, { status: 'pending' }).then(result => result.total),
        UserModel.findAll(1, 1, { status: 'suspended' }).then(result => result.total),
        UserModel.findAll(1, 1, { role: 'admin' }).then(result => result.total),
      ]);

      return {
        total,
        active,
        pending,
        suspended,
        admins,
      };
    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw new CustomError('Failed to get user statistics', 500);
    }
  }

  static async activateUser(userId: number): Promise<void> {
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      if (user.status === 'active') {
        throw new CustomError('User is already active', 400);
      }

      await UserModel.update(userId, { status: 'active' });

      // 승인 이메일 발송
      try {
        await EmailService.sendAccountApprovalEmail(user.email, user.name);
        logger.info('Account approval email sent:', {
          userId,
          email: user.email,
        });
      } catch (emailError) {
        // 이메일 발송 실패는 로그만 남기고 전체 프로세스는 계속 진행
        logger.error('Failed to send approval email:', {
          userId,
          email: user.email,
          error: emailError,
        });
      }

      logger.info('User activated:', {
        userId,
        email: user.email,
      });
    } catch (error) {
      logger.error('Error activating user:', error);
      throw error instanceof CustomError ? error : new CustomError('Failed to activate user', 500);
    }
  }

  static async suspendUser(userId: number): Promise<void> {
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      if (user.status === 'suspended') {
        throw new CustomError('User is already suspended', 400);
      }

      await UserModel.update(userId, { status: 'suspended' });

      logger.info('User suspended:', {
        userId,
        email: user.email,
      });
    } catch (error) {
      logger.error('Error suspending user:', error);
      throw error instanceof CustomError ? error : new CustomError('Failed to suspend user', 500);
    }
  }

  static async promoteToAdmin(userId: number): Promise<void> {
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      if (user.role === 'admin') {
        throw new CustomError('User is already an admin', 400);
      }

      await UserModel.update(userId, { role: 'admin' });

      logger.info('User promoted to admin:', {
        userId,
        email: user.email,
      });
    } catch (error) {
      logger.error('Error promoting user to admin:', error);
      throw error instanceof CustomError ? error : new CustomError('Failed to promote user to admin', 500);
    }
  }

  static async demoteFromAdmin(userId: number): Promise<void> {
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      if (user.role !== 'admin') {
        throw new CustomError('User is not an admin', 400);
      }

      await UserModel.update(userId, { role: 'user' });

      logger.info('User demoted from admin:', {
        userId,
        email: user.email,
      });
    } catch (error) {
      logger.error('Error demoting user from admin:', error);
      throw error instanceof CustomError ? error : new CustomError('Failed to demote user from admin', 500);
    }
  }

  static async getPendingUsers(): Promise<UserWithoutPassword[]> {
    try {
      const result = await UserModel.findAll(1, 100, { status: 'pending' });
      return result.users;
    } catch (error) {
      logger.error('Error getting pending users:', error);
      throw new CustomError('Failed to get pending users', 500);
    }
  }
  // 태그 관련 메서드들
  static async getUserTags(userId: number): Promise<any[]> {
    try {
      return await UserModel.getTags(userId);
    } catch (error) {
      logger.error('Error getting user tags:', error);
      throw new CustomError('Failed to get user tags', 500);
    }
  }

  static async setUserTags(userId: number, tagIds: number[], updatedBy: number): Promise<void> {
    try {
      // 사용자 존재 확인
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      await UserModel.setTags(userId, tagIds, updatedBy);
    } catch (error) {
      logger.error('Error setting user tags:', error);
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError('Failed to set user tags', 500);
    }
  }

  static async addUserTag(userId: number, tagId: number, createdBy: number): Promise<void> {
    try {
      // 사용자 존재 확인
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      await UserModel.addTag(userId, tagId, createdBy);
    } catch (error) {
      logger.error('Error adding user tag:', error);
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError('Failed to add user tag', 500);
    }
  }

  static async removeUserTag(userId: number, tagId: number): Promise<void> {
    try {
      // 사용자 존재 확인
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      await UserModel.removeTag(userId, tagId);
    } catch (error) {
      logger.error('Error removing user tag:', error);
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError('Failed to remove user tag', 500);
    }
  }

  // 관리자가 사용자 이메일을 강제 인증 처리
  static async verifyUserEmail(userId: number): Promise<void> {
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      if (user.emailVerified) {
        throw new CustomError('User email is already verified', 400);
      }

      await UserModel.update(userId, { emailVerified: true });

      logger.info('User email verified by admin:', {
        userId,
        email: user.email,
      });
    } catch (error) {
      logger.error('Error verifying user email:', error);
      throw error instanceof CustomError ? error : new CustomError('Failed to verify user email', 500);
    }
  }

  // 사용자에게 이메일 인증 메일 재전송
  static async resendVerificationEmail(userId: number): Promise<void> {
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      if (user.emailVerified) {
        throw new CustomError('User email is already verified', 400);
      }

      // 이메일 인증 메일 발송 (현재는 웰컴 이메일로 대체)
      try {
        await EmailService.sendWelcomeEmail(user.email, user.name);
        logger.info('Verification email sent:', {
          userId,
          email: user.email,
        });
      } catch (emailError) {
        logger.error('Failed to send verification email:', {
          userId,
          email: user.email,
          error: emailError,
        });
        throw new CustomError('Failed to send verification email', 500);
      }
    } catch (error) {
      logger.error('Error resending verification email:', error);
      throw error instanceof CustomError ? error : new CustomError('Failed to resend verification email', 500);
    }
  }

  /**
   * Update user's preferred language
   */
  static async updateUserLanguage(userId: number, preferredLanguage: string): Promise<void> {
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      await UserModel.updateLanguage(userId, preferredLanguage);

      logger.info('User language updated successfully', {
        userId,
        preferredLanguage,
        email: user.email
      });
    } catch (error) {
      logger.error('Error updating user language:', error);
      throw error instanceof CustomError ? error : new CustomError('Failed to update user language', 500);
    }
  }
}
