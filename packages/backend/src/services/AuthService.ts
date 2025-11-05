// import bcrypt from 'bcryptjs'; // Removed as it's not used directly here
import { UserModel } from '../models/User';
import { JwtUtils } from '../utils/jwt';
import { CustomError } from '../middleware/errorHandler';
import logger from '../config/logger';
import { CreateUserData, UserWithoutPassword } from '../types/user';
import db from '../config/knex';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: UserWithoutPassword;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const { email, password } = credentials;

      // Find user by email
      const user = await UserModel.findByEmail(email);
      if (!user) {
        throw new CustomError('USER_NOT_FOUND', 404);
      }

      // Check if user is active
      if (user.status !== 'active') {
        if (user.status === 'pending') {
          throw new CustomError('ACCOUNT_PENDING', 403);
        } else if (user.status === 'suspended') {
          throw new CustomError('ACCOUNT_SUSPENDED', 403);
        } else {
          throw new CustomError('Account is not active. Please contact an administrator.', 403);
        }
      }

      // Verify password
      const isValidPassword = await UserModel.verifyPassword(user, password);
      if (!isValidPassword) {
        throw new CustomError('Invalid email or password', 401);
      }

      // Update last login
      await UserModel.updateLastLogin(user.id);

      // Remove password hash from user object
      const { passwordHash: _passwordHash, ...userWithoutPassword } = user;

      // Generate tokens
      const accessToken = JwtUtils.generateToken(userWithoutPassword as any);
      const refreshToken = JwtUtils.generateRefreshToken(userWithoutPassword as any);

      logger.info('User logged in successfully:', {
        userId: user.id,
        email: user.email,
      });

      return {
        user: userWithoutPassword as any,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Login error:', error);
      throw new CustomError('Login failed', 500);
    }
  }

  static async register(registerData: RegisterData): Promise<UserWithoutPassword> {
    try {
      const { email, password, name } = registerData;

      // Check if user already exists
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        throw new CustomError('EMAIL_ALREADY_EXISTS', 409);
      }

      // Create user data
      const userData: CreateUserData = {
        email,
        password,
        name,
        status: 'pending', // New users need admin approval
        emailVerified: false,
      };

      // Create user
      const user = await UserModel.create(userData);

      logger.info('User registered successfully:', {
        userId: user.id,
        email: user.email,
      });

      return user;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Registration error:', error);
      throw new CustomError('REGISTRATION_FAILED', 500);
    }
  }

  static async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Verify refresh token
      const payload = JwtUtils.verifyRefreshToken(refreshToken);
      if (!payload) {
        logger.warn('Refresh token verification failed: invalid or expired token');
        throw new CustomError('Invalid or expired refresh token', 401);
      }

      logger.debug('Refresh token verified, looking up user:', { userId: payload.userId });

      // Get user details
      const user = await UserModel.findById(payload.userId);
      if (!user) {
        logger.warn('User not found during token refresh:', { userId: payload.userId });
        throw new CustomError('User not found', 401);
      }

      if (user.status !== 'active') {
        logger.warn('User account is not active during token refresh:', { userId: payload.userId, status: user.status });
        throw new CustomError('User account is not active', 401);
      }

      // Generate new tokens
      const newAccessToken = JwtUtils.generateToken(user);
      const newRefreshToken = JwtUtils.generateRefreshToken(user);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Token refresh error:', error);
      throw new CustomError('Token refresh failed', 500);
    }
  }

  static async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    try {
      // Get user with password hash
      const user = await UserModel.findByEmail((await UserModel.findById(userId))!.email);
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      // OAuth 사용자들은 비밀번호 변경 불가
      if (user.authType !== 'local') {
        throw new CustomError('Password change is not available for OAuth users', 400);
      }

      // Verify current password
      if (user.passwordHash) {
        const isValidPassword = await UserModel.verifyPassword(user, currentPassword);
        if (!isValidPassword) {
          throw new CustomError('Current password is incorrect', 400);
        }
      } else {
        // local 사용자인데 passwordHash가 없는 경우 (데이터 불일치)
        throw new CustomError('Password not set for this account', 400);
      }

      // Update password
      await UserModel.updatePassword(userId, newPassword);

      logger.info('Password changed successfully:', {
        userId,
      });
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Change password error:', error);
      throw new CustomError('Password change failed', 500);
    }
  }

  static async resetPassword(email: string): Promise<void> {
    try {
      const user = await UserModel.findByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not
        logger.info('Password reset requested for non-existent email:', { email });
        return;
      }

      // 1. 보안 리셋 토큰 생성
      const crypto = require('crypto');
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 3600000); // 1시간 후 만료

      // 2. 데이터베이스에 토큰 저장
      await db('g_password_reset_tokens').insert({
        userId: user.id,
        token: resetToken,
        expiresAt,
        createdAt: new Date()
      });

      // 3. 이메일 발송
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

      // QueueService를 통해 이메일 발송 (비동기)
      const QueueService = require('./QueueService').default;
      await QueueService.addEmailJob({
        to: user.email,
        subject: 'Password Reset Request',
        html: `
          <h2>Password Reset Request</h2>
          <p>You requested a password reset. Click the link below to reset your password:</p>
          <a href="${resetUrl}">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `,
        text: `Password reset requested. Visit: ${resetUrl} (expires in 1 hour)`
      });

      logger.info('Password reset email sent:', {
        userId: user.id,
        email: user.email,
      });
    } catch (error) {
      logger.error('Password reset error:', error);
      throw new CustomError('Password reset failed', 500);
    }
  }

  static async verifyEmail(userId: number): Promise<void> {
    try {
      await UserModel.update(userId, {
        emailVerified: true,
      });

      logger.info('Email verified successfully:', {
        userId,
      });
    } catch (error) {
      logger.error('Email verification error:', error);
      throw new CustomError('Email verification failed', 500);
    }
  }

  static async getProfile(userId: number): Promise<UserWithoutPassword> {
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      return user;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Get profile error:', error);
      throw new CustomError('Failed to get user profile', 500);
    }
  }

  static async updateProfile(userId: number, updateData: { name?: string; avatarUrl?: string; preferredLanguage?: string }): Promise<UserWithoutPassword> {
    try {
      // Only allow specific fields for profile updates
      const allowedFields = ['name', 'avatarUrl', 'preferredLanguage'];
      const filteredData: any = {};

      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key) && value !== undefined) {
          filteredData[key] = value;
        }
      }

      if (Object.keys(filteredData).length === 0) {
        throw new CustomError('No valid fields to update', 400);
      }

      const user = await UserModel.update(userId, filteredData);
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      logger.info('Profile updated successfully:', {
        userId,
        updates: Object.keys(filteredData),
      });

      return user;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Update profile error:', error);
      throw new CustomError('Profile update failed', 500);
    }
  }
}
