import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import passwordResetService from '../services/PasswordResetService';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import logger from '../config/logger';
import Joi from 'joi';

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().min(2).max(100).required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});

const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  avatarUrl: Joi.string().uri().optional().allow(''),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});

export class AuthController {
  static login = asyncHandler(async (req: Request, res: Response) => {
    // Validate request body
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const { email, password } = value;
    const result = await AuthService.login({ email, password });

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
      message: 'Login successful',
    });
  });

  static register = asyncHandler(async (req: Request, res: Response) => {
    // Validate request body
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const user = await AuthService.register(value);

    res.status(201).json({
      success: true,
      data: { user },
      message: 'Registration successful. Please wait for admin approval.',
    });
  });

  static refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      throw new CustomError('Refresh token is required', 401);
    }

    const result = await AuthService.refreshToken(refreshToken);

    // Set new refresh token as httpOnly cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({
      success: true,
      data: {
        accessToken: result.accessToken,
      },
      message: 'Token refreshed successfully',
    });
  });

  static logout = asyncHandler(async (req: Request, res: Response) => {
    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Logout successful',
    });
  });

  static getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new CustomError('User not authenticated', 401);
    }

    const user = await AuthService.getProfile(req.user.userId);

    res.json({
      success: true,
      data: { user },
    });
  });

  static updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new CustomError('User not authenticated', 401);
    }

    // Validate request body
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const user = await AuthService.updateProfile(req.user.userId, value);

    res.json({
      success: true,
      data: { user },
      message: 'Profile updated successfully',
    });
  });



  static changePassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new CustomError('User not authenticated', 401);
    }

    // Validate request body
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const { currentPassword, newPassword } = value;
    await AuthService.changePassword(req.user.userId, currentPassword, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  });



  static verifyEmail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new CustomError('User not authenticated', 401);
    }

    await AuthService.verifyEmail(req.user.userId);

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  });

  // OAuth success callback
  static oauthSuccess = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    
    if (!user) {
      throw new CustomError('OAuth authentication failed', 401);
    }

    // Check if user is active
    if (user.status !== 'active') {
      // Redirect to frontend with pending status
      return res.redirect(`${process.env.CORS_ORIGIN}/auth/pending`);
    }

    // Generate tokens
    const accessToken = require('../utils/jwt').JwtUtils.generateToken(user);
    const refreshToken = require('../utils/jwt').JwtUtils.generateRefreshToken(user);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Redirect to frontend with access token
    res.redirect(`${process.env.CORS_ORIGIN}/auth/callback?token=${accessToken}`);
  });

  // OAuth failure callback
  static oauthFailure = asyncHandler(async (req: Request, res: Response) => {
    logger.error('OAuth authentication failed');
    res.redirect(`${process.env.CORS_ORIGIN}/auth/error`);
  });

  // Forgot password - request password reset
  static forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = forgotPasswordSchema.validate(req.body);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const { email } = value;
    const result = await passwordResetService.requestPasswordReset(email);

    res.json({
      success: true,
      data: {
        success: result.success,
        message: result.message,
      },
      message: result.message,
    });
  });

  // Validate reset token
  static validateResetToken = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    if (!token) {
      throw new CustomError('토큰이 필요합니다.', 400);
    }

    const result = await passwordResetService.validateResetToken(token);

    res.json({
      success: true,
      data: {
        success: result.valid,
        message: result.message,
      },
      message: result.message,
    });
  });

  // Reset password with token
  static resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = resetPasswordSchema.validate(req.body);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const { token, newPassword } = value;
    const result = await passwordResetService.resetPassword(token, newPassword);

    res.json({
      success: true,
      data: {
        success: result.success,
        message: result.message,
      },
      message: result.message,
    });
  });
}
