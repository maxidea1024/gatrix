// import bcrypt from 'bcryptjs'; // Removed as it's not used directly here
import { UserModel } from '../models/User';
import { JwtUtils } from '../utils/jwt';
import { CustomError } from '../middleware/errorHandler';
import logger from '../config/logger';
import { CreateUserData, UserWithoutPassword } from '../types/user';

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
      const { passwordHash, ...userWithoutPassword } = user;

      // Generate tokens
      const accessToken = JwtUtils.generateToken(userWithoutPassword);
      const refreshToken = JwtUtils.generateRefreshToken(userWithoutPassword);

      logger.info('User logged in successfully:', {
        userId: user.id,
        email: user.email,
      });

      return {
        user: userWithoutPassword,
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
        throw new CustomError('User with this email already exists', 409);
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
      throw new CustomError('Registration failed', 500);
    }
  }

  static async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Verify refresh token
      const payload = JwtUtils.verifyRefreshToken(refreshToken);
      if (!payload) {
        throw new CustomError('Invalid or expired refresh token', 401);
      }

      // Get user details
      const user = await UserModel.findById(payload.userId);
      if (!user) {
        throw new CustomError('User not found', 401);
      }

      if (user.status !== 'active') {
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

      // Verify current password
      if (user.passwordHash) {
        const isValidPassword = await UserModel.verifyPassword(user, currentPassword);
        if (!isValidPassword) {
          throw new CustomError('Current password is incorrect', 400);
        }
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

      // In a real application, you would:
      // 1. Generate a secure reset token
      // 2. Store it in database with expiration
      // 3. Send email with reset link
      
      // For now, just log the request
      logger.info('Password reset requested:', {
        userId: user.id,
        email: user.email,
      });

      // TODO: Implement email sending and token generation
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

  static async updateProfile(userId: number, updateData: { name?: string; avatarUrl?: string }): Promise<UserWithoutPassword> {
    try {
      // Only allow specific fields for profile updates
      const allowedFields = ['name', 'avatarUrl'];
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
