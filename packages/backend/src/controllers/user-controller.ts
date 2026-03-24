import { Response } from 'express';
import { UserService } from '../services/user-service';
import { TagService } from '../services/tag-service';
import { ChatServerService } from '../services/chat-server-service';
import { asyncHandler, GatrixError } from '../middleware/error-handler';
import { AuthenticatedRequest } from '../middleware/auth';
import { UserModel } from '../models/user';
import Joi from 'joi';
import { UserOnboardingService } from '../services/user-onboarding-service';
import { permissionService } from '../services/permission-service';

import { createLogger } from '../config/logger';
const logger = createLogger('UserController');

const DEFAULT_AVATAR_URL =
  'https://cdn-icons-png.flaticon.com/512/847/847969.png';

// Validation schemas
const getUsersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  status: Joi.string()
    .valid('pending', 'active', 'suspended', 'deleted')
    .optional(),
  search: Joi.string().max(100).optional(),
});

const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  email: Joi.string().email().optional(),
  avatarUrl: Joi.string().uri().optional().allow(''),
  status: Joi.string()
    .valid('pending', 'active', 'suspended', 'deleted')
    .optional(),
  email_verified: Joi.boolean().optional(),
  tagIds: Joi.array().items(Joi.string()).optional(),
});

const updateLanguageSchema = Joi.object({
  preferredLanguage: Joi.string().valid('en', 'ko', 'zh').required(),
});

const verifyEmailSchema = Joi.object({
  userId: Joi.string().required(),
});

const createUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  status: Joi.string()
    .valid('pending', 'active', 'suspended', 'deleted')
    .optional()
    .default('active'),
  emailVerified: Joi.boolean().optional().default(true),
  tagIds: Joi.array().items(Joi.string()).optional().default([]),
  autoJoinConfig: Joi.object().optional(),
});

export class UserController {
  static getAllUsers = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      // Validate query parameters
      const { error, value } = getUsersQuerySchema.validate(req.query);
      if (error) {
        throw new GatrixError(error.details[0].message, 400);
      }

      const { page, limit, status, search } = value;

      // Scope filtering by hierarchy: filter users visible based on actor's scope level
      let orgId: string | undefined;
      let excludeHigherScopeUsers = false;
      let actorScopeLevel = 1;
      if (req.user?.orgId) {
        actorScopeLevel = await permissionService.getUserMaxScopeLevel(
          req.user.id
        );
        const { SCOPE_LEVELS } = require('../utils/scope-hierarchy');
        if (actorScopeLevel > SCOPE_LEVELS.system) {
          orgId = req.user.orgId;
          excludeHigherScopeUsers = true;
        }
      }

      const filters = {
        status,
        search,
        orgId,
        excludeSystemAdmins: excludeHigherScopeUsers,
        actorScopeLevel,
      };
      const pagination = { page, limit };

      const result = await UserService.getAllUsers(filters, pagination);

      res.json({
        success: true,
        data: result,
      });
    }
  );

  static createUser = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { error, value } = createUserSchema.validate(req.body);
      if (error) {
        throw new GatrixError(error.details[0].message, 400);
      }

      const { tagIds, autoJoinConfig, ...userData } = value;
      const createdBy = req.user?.userId;

      // Create user
      let user = await UserService.createUser({
        ...userData,
        createdBy,
      });

      // Set tags
      if (tagIds && tagIds.length > 0) {
        logger.debug('Setting user tags for new user:', {
          userId: user.id,
          tagIds,
          createdBy,
        });
        await TagService.setTagsForEntity('user', user.id, tagIds, createdBy!);
        logger.debug('User tags set successfully for new user');

        // Reload user to include latest tag info
        user = await UserService.getUserById(user.id);
      }

      // Apply auto-join config if provided
      if (autoJoinConfig) {
        try {
          await UserOnboardingService.applyAutoJoinConfig(
            user.id,
            autoJoinConfig,
            createdBy || user.id
          );
          logger.info('Auto-join config applied for new user', {
            userId: user.id,
          });
        } catch (error) {
          logger.error('Failed to apply auto-join config for new user:', error);
          // User is already created, log the error but don't fail the request
        }
      }

      res.status(201).json({
        success: true,
        data: { user },
        message: 'User created successfully',
      });
    }
  );

  static getUserById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.params.id;

      if (!userId) {
        throw new GatrixError('Invalid user ID', 400);
      }

      const user = await UserService.getUserById(userId);

      res.json({
        success: true,
        data: { user },
      });
    }
  );

  static updateUser = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.params.id;

      if (!userId) {
        throw new GatrixError('Invalid user ID', 400);
      }

      // Validate request body
      logger.debug('Raw request body:', req.body);
      const { error, value } = updateUserSchema.validate(req.body);
      if (error) {
        logger.debug('Validation error:', error.details);
        throw new GatrixError(error.details[0].message, 400);
      }

      logger.debug('Validated value:', value);
      const { tagIds, ...userData } = value;
      const updatedBy = req.user?.userId;

      // Prevent managing users with higher scope level
      const actorScopeLevel = await permissionService.getUserMaxScopeLevel(
        req.user!.id
      );
      const targetScopeLevel =
        await permissionService.getUserMaxScopeLevel(userId);
      if (targetScopeLevel < actorScopeLevel) {
        throw new GatrixError(
          'Cannot modify users with higher scope level',
          403
        );
      }

      logger.debug('Update user request:', {
        userId,
        tagIds,
        userData,
        updatedBy,
      });

      let user = await UserService.updateUser(userId, userData);

      // Set tags (only if tagIds is provided)
      if (tagIds !== undefined) {
        logger.debug('Setting user tags:', { userId, tagIds, updatedBy });
        await TagService.setTagsForEntity('user', userId, tagIds, updatedBy!);
        logger.debug('User tags set successfully');

        // Reload user to get latest tag info after tag update
        user = await UserService.getUserById(userId);
      } else {
        logger.debug('No tagIds provided, skipping tag update');
      }

      res.json({
        success: true,
        data: { user },
        message: 'User updated successfully',
      });
    }
  );

  static deleteUser = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.params.id;

      if (!userId) {
        throw new GatrixError('Invalid user ID', 400);
      }

      // Prevent users from deleting themselves
      if (req.user?.userId === userId) {
        throw new GatrixError('You cannot delete your own account', 403);
      }

      // Prevent managing users with higher scope level
      const actorScopeLevel = await permissionService.getUserMaxScopeLevel(
        req.user!.id
      );
      const targetScopeLevel =
        await permissionService.getUserMaxScopeLevel(userId);
      if (targetScopeLevel < actorScopeLevel) {
        throw new GatrixError(
          'Cannot delete users with higher scope level',
          403
        );
      }

      await UserService.deleteUser(userId);

      res.json({
        success: true,
        message: 'User deleted successfully',
      });
    }
  );

  static approveUser = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.params.id;

      if (!userId) {
        throw new GatrixError('Invalid user ID', 400);
      }

      await UserService.activateUser(userId);
      const user = await UserService.getUserById(userId);

      res.json({
        success: true,
        data: { user },
        message: 'User approved successfully',
      });
    }
  );

  static rejectUser = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.params.id;

      if (!userId) {
        throw new GatrixError('Invalid user ID', 400);
      }

      await UserService.deleteUser(userId);

      res.json({
        success: true,
        message: 'User rejected successfully',
      });
    }
  );

  static suspendUser = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.params.id;

      if (!userId) {
        throw new GatrixError('Invalid user ID', 400);
      }

      // Prevent users from suspending themselves
      if (req.user?.userId === userId) {
        throw new GatrixError('You cannot suspend your own account', 403);
      }

      const user = await UserService.suspendUser(userId);

      res.json({
        success: true,
        data: { user },
        message: 'User suspended successfully',
      });
    }
  );

  static unsuspendUser = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.params.id;

      if (!userId) {
        throw new GatrixError('Invalid user ID', 400);
      }

      await UserService.activateUser(userId);
      const user = await UserService.getUserById(userId);

      res.json({
        success: true,
        data: { user },
        message: 'User unsuspended successfully',
      });
    }
  );

  static getPendingUsers = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const users = await UserService.getPendingUsers();

      res.json({
        success: true,
        data: { users },
      });
    }
  );

  static getUserStats = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const stats = await UserService.getUserStats();

      res.json({
        success: true,
        data: { stats },
      });
    }
  );

  // Search users (for chat system)
  static searchUsers = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { q: query, limit = 20, orgId } = req.query;

      if (!query || typeof query !== 'string') {
        throw new GatrixError('Search query is required', 400);
      }

      if (query.length < 2) {
        throw new GatrixError(
          'Search query must be at least 2 characters',
          400
        );
      }

      const searchLimit = Math.min(parseInt(limit as string) || 20, 50); // Max 50
      const searchOrgId = typeof orgId === 'string' ? orgId : undefined;

      const users = await UserService.searchUsers(
        query,
        searchLimit,
        searchOrgId
      );

      res.json({
        success: true,
        data: users,
      });
    }
  );

  // Self-service endpoints for regular users
  static getCurrentUser = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      if (!req.user) {
        throw new GatrixError('User not authenticated', 401);
      }

      const user = await UserService.getUserById(req.user.userId);

      res.json({
        success: true,
        data: { user },
      });
    }
  );

  static updateCurrentUser = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      if (!req.user) {
        throw new GatrixError('User not authenticated', 401);
      }

      // Validate request body (limited fields for self-update)
      const selfUpdateSchema = Joi.object({
        name: Joi.string().min(2).max(100).optional(),
        avatarUrl: Joi.string().uri().optional().allow(''),
        preferredLanguage: Joi.string().valid('en', 'ko', 'zh').optional(),
      });

      const { error, value } = selfUpdateSchema.validate(req.body);
      if (error) {
        throw new GatrixError(error.details[0].message, 400);
      }

      const user = await UserService.updateUser(req.user.userId, value);

      // Sync user info to chat server (runs in background)
      try {
        const chatServerService = ChatServerService.getInstance();
        await chatServerService.syncUser({
          id: user.id,
          username: user.email,
          name: user.name || user.email,
          email: user.email,
          avatarUrl: user.avatarUrl || DEFAULT_AVATAR_URL,
          status: 'online',
          lastSeenAt: new Date().toISOString(),
          createdAt: user.createdAt?.toISOString(),
          updatedAt: user.updatedAt?.toISOString(),
        });
      } catch (error) {
        // Log chat server sync failure but still return success to user
        logger.error('Failed to sync user to Chat Server:', error);
      }

      res.json({
        success: true,
        data: { user },
        message: 'Profile updated successfully',
      });
    }
  );

  // Admin force verify user email
  static verifyUserEmail = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.params.id;

      if (!userId) {
        throw new GatrixError('Invalid user ID', 400);
      }

      await UserService.verifyUserEmail(userId);

      res.json({
        success: true,
        message: 'User email verified successfully',
      });
    }
  );

  // Resend verification email to user
  static resendVerificationEmail = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.params.id;

      if (!userId) {
        throw new GatrixError('Invalid user ID', 400);
      }

      await UserService.resendVerificationEmail(userId);

      res.json({
        success: true,
        message: 'Verification email sent successfully',
      });
    }
  );

  /**
   * Update user's preferred language
   */
  static updateLanguage = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { error, value } = updateLanguageSchema.validate(req.body);
      if (error) {
        throw new GatrixError(error.details[0].message, 400);
      }

      const { preferredLanguage } = value;
      const userId = req.user!.userId;

      await UserService.updateUserLanguage(userId, preferredLanguage);

      res.json({
        success: true,
        message: 'Language preference updated successfully',
        data: {
          preferredLanguage,
        },
      });
    }
  );
  /**
   * Get current user's RBAC permissions (self-service, no admin required)
   */
  static getMyPermissions = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      if (!req.user) {
        throw new GatrixError('User not authenticated', 401);
      }

      const userId = req.user.userId;
      const permissions = await UserModel.getPermissions(userId);

      res.json({
        success: true,
        data: {
          userId,
          permissions,
        },
      });
    }
  );
}
