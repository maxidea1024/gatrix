import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import passwordResetService from '../services/PasswordResetService';
import { asyncHandler, GatrixError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import logger from '../config/logger';
import Joi from 'joi';

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  rememberMe: Joi.boolean().optional(),
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
  preferredLanguage: Joi.string().valid('en', 'ko', 'zh').optional(),
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
      throw new GatrixError(error.details[0].message, 400);
    }

    const { email, password, rememberMe } = value;
    const result = await AuthService.login({ email, password });

    // Log rememberMe preference for potential future use
    if (rememberMe) {
      logger.info(`User ${email} chose to be remembered`);
    }

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
      // Map validation errors to specific error codes
      const field = error.details[0].path[0];
      const type = error.details[0].type;

      if (field === 'email' && type === 'string.email') {
        throw new GatrixError('INVALID_EMAIL_FORMAT', 400);
      } else if (field === 'password' && type === 'string.min') {
        throw new GatrixError('PASSWORD_TOO_SHORT', 400);
      } else if (field === 'name' && type === 'string.min') {
        throw new GatrixError('NAME_TOO_SHORT', 400);
      } else if (field === 'name' && type === 'string.max') {
        throw new GatrixError('NAME_TOO_LONG', 400);
      } else if (type === 'any.required') {
        throw new GatrixError(`${String(field).toUpperCase()}_REQUIRED`, 400);
      }

      // Fallback to original message
      throw new GatrixError('VALIDATION_ERROR', 400);
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
      throw new GatrixError('Refresh token is required', 401);
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
      throw new GatrixError('User not authenticated', 401);
    }

    const user = await AuthService.getProfile(req.user.userId);

    res.json({
      success: true,
      data: { user },
    });
  });

  static updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new GatrixError('User not authenticated', 401);
    }

    // Validate request body
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      throw new GatrixError(error.details[0].message, 400);
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
      throw new GatrixError('User not authenticated', 401);
    }

    // Validate request body
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      throw new GatrixError(error.details[0].message, 400);
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
      throw new GatrixError('User not authenticated', 401);
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
      throw new GatrixError('OAuth authentication failed', 401);
    }

    // Check if user is active
    if (user.status !== 'active') {
      // Get frontend origin dynamically
      const referer = req.get('Referer');
      let frontendOrigin = process.env.CORS_ORIGIN;

      // If CORS_ORIGIN is wildcard or invalid, use default frontend URL
      if (!frontendOrigin || frontendOrigin === '*') {
        frontendOrigin = 'http://localhost:3000';
      }

      if (referer) {
        try {
          const refererUrl = new URL(referer);
          frontendOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
        } catch (e) {
          // Use default if referer parsing fails
          logger.debug('Failed to parse referer for pending redirect, using default:', { frontendOrigin });
        }
      }

      // Redirect to frontend with pending status
      return res.redirect(`${frontendOrigin}/auth/pending`);
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

    // Get frontend origin dynamically
    const referer = req.get('Referer');
    let frontendOrigin = process.env.CORS_ORIGIN;

    // If CORS_ORIGIN is wildcard or invalid, use default frontend URL
    if (!frontendOrigin || frontendOrigin === '*') {
      frontendOrigin = 'http://localhost:3000';
    }

    if (referer) {
      try {
        const refererUrl = new URL(referer);
        frontendOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
      } catch (e) {
        // Use default if referer parsing fails
        logger.debug('Failed to parse referer, using default frontend origin:', { frontendOrigin });
      }
    }

    logger.debug('🔄 OAuth success redirect:', {
      frontendOrigin,
      referer,
      tokenLength: accessToken.length
    });

    // Redirect to frontend with access token
    res.redirect(`${frontendOrigin}/auth/callback?token=${accessToken}`);
  });

  // OAuth failure callback
  static oauthFailure = asyncHandler(async (req: Request, res: Response) => {
    logger.error('OAuth authentication failed');

    // Try to get the origin from referer or use default
    const referer = req.get('Referer');
    let frontendOrigin = process.env.CORS_ORIGIN;

    // If CORS_ORIGIN is wildcard or invalid, use default frontend URL
    if (!frontendOrigin || frontendOrigin === '*') {
      frontendOrigin = 'http://localhost:3000';
    }

    if (referer) {
      try {
        const refererUrl = new URL(referer);
        frontendOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
      } catch (e) {
        // Use default if referer parsing fails
        logger.debug('Failed to parse referer for failure redirect, using default:', { frontendOrigin });
      }
    }

    const redirectUrl = `${frontendOrigin}/login?error=oauth_failed`;
    logger.debug('OAuth failure redirect URL:', { redirectUrl, referer, frontendOrigin });
    res.redirect(redirectUrl);
  });

  // Forgot password - request password reset
  static forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = forgotPasswordSchema.validate(req.body);
    if (error) {
      throw new GatrixError(error.details[0].message, 400);
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
      throw new GatrixError('토큰이 필요합니다.', 400);
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
      throw new GatrixError(error.details[0].message, 400);
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
