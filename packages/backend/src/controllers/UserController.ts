import { Response } from 'express';
import { UserService } from '../services/userService';
import { UserTagService } from '../services/UserTagService';
import { ChatServerService } from '../services/ChatServerService';
import { asyncHandler, GatrixError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import { UserModel } from '../models/User';
import Joi from 'joi';
import logger from '../config/logger';

const DEFAULT_AVATAR_URL = 'https://cdn-icons-png.flaticon.com/512/847/847969.png';

// Validation schemas
const getUsersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  role: Joi.string().valid('admin', 'user').optional(),
  status: Joi.string().valid('pending', 'active', 'suspended', 'deleted').optional(),
  search: Joi.string().max(100).optional(),
});

const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  email: Joi.string().email().optional(),
  avatarUrl: Joi.string().uri().optional().allow(''),
  role: Joi.string().valid('admin', 'user').optional(),
  status: Joi.string().valid('pending', 'active', 'suspended', 'deleted').optional(),
  email_verified: Joi.boolean().optional(),
  tagIds: Joi.array().items(Joi.number().integer().positive()).optional(),
});

const setUserTagsSchema = Joi.object({
  tagIds: Joi.array().items(Joi.number().integer().positive()).required(),
});

const updateLanguageSchema = Joi.object({
  preferredLanguage: Joi.string().valid('en', 'ko', 'zh').required(),
});

const addUserTagSchema = Joi.object({
  tagId: Joi.number().integer().positive().required(),
});

const verifyEmailSchema = Joi.object({
  userId: Joi.number().integer().positive().required(),
});

const createUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('admin', 'user').optional().default('user'),
  status: Joi.string().valid('pending', 'active', 'suspended', 'deleted').optional().default('active'),
  emailVerified: Joi.boolean().optional().default(true),
  tagIds: Joi.array().items(Joi.number().integer().positive()).optional().default([]),
});

const setEnvironmentAccessSchema = Joi.object({
  allowAllEnvironments: Joi.boolean().required(),
  environments: Joi.array().items(Joi.string().min(1).max(127)).default([]),
});

export class UserController {
  static getAllUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Validate query parameters
    const { error, value } = getUsersQuerySchema.validate(req.query);
    if (error) {
      throw new GatrixError(error.details[0].message, 400);
    }

    const { page, limit, role, status, search } = value;

    const filters = { role, status, search };
    const pagination = { page, limit };

    const result = await UserService.getAllUsers(filters, pagination);

    res.json({
      success: true,
      data: result,
    });
  });

  static createUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { error, value } = createUserSchema.validate(req.body);
    if (error) {
      throw new GatrixError(error.details[0].message, 400);
    }

    const { tagIds, ...userData } = value;
    const createdBy = req.user?.userId;

    // 사용자 생성
    let user = await UserService.createUser({
      ...userData,
      createdBy,
    });

    // 태그 설정
    if (tagIds && tagIds.length > 0) {
      logger.debug('Setting user tags for new user:', { userId: user.id, tagIds, createdBy });
      await UserTagService.setUserTags(user.id, tagIds, createdBy!);
      logger.debug('User tags set successfully for new user');

      // 태그 설정 후 사용자 정보를 다시 로드하여 최신 태그 정보 포함
      user = await UserService.getUserById(user.id);
    }

    res.status(201).json({
      success: true,
      data: { user },
      message: 'User created successfully',
    });
  });

  static getUserById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      throw new GatrixError('Invalid user ID', 400);
    }

    const user = await UserService.getUserById(userId);

    res.json({
      success: true,
      data: { user },
    });
  });

  static updateUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
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

    logger.debug('Update user request:', { userId, tagIds, userData, updatedBy });

    // Prevent users from modifying their own role or status (except admins)
    if (req.user?.userId === userId && req.user?.role !== 'admin') {
      if (userData.role || userData.status) {
        throw new GatrixError('You cannot modify your own role or status', 403);
      }
    }

    let user = await UserService.updateUser(userId, userData);

    // 태그 설정 (tagIds가 제공된 경우에만)
    if (tagIds !== undefined) {
      logger.debug('Setting user tags:', { userId, tagIds, updatedBy });
      await UserTagService.setUserTags(userId, tagIds, updatedBy!);
      logger.debug('User tags set successfully');

      // 태그 업데이트 후 사용자 정보를 다시 로드하여 최신 태그 정보 포함
      user = await UserService.getUserById(userId);
    } else {
      logger.debug('No tagIds provided, skipping tag update');
    }

    res.json({
      success: true,
      data: { user },
      message: 'User updated successfully',
    });
  });

  static deleteUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      throw new GatrixError('Invalid user ID', 400);
    }

    // Prevent users from deleting themselves
    if (req.user?.userId === userId) {
      throw new GatrixError('You cannot delete your own account', 403);
    }

    await UserService.deleteUser(userId);

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  });

  static approveUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      throw new GatrixError('Invalid user ID', 400);
    }

    await UserService.activateUser(userId);
    const user = await UserService.getUserById(userId);

    res.json({
      success: true,
      data: { user },
      message: 'User approved successfully',
    });
  });

  static rejectUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      throw new GatrixError('Invalid user ID', 400);
    }

    await UserService.deleteUser(userId);

    res.json({
      success: true,
      message: 'User rejected successfully',
    });
  });

  static suspendUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
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
  });

  static unsuspendUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      throw new GatrixError('Invalid user ID', 400);
    }

    await UserService.activateUser(userId);
    const user = await UserService.getUserById(userId);

    res.json({
      success: true,
      data: { user },
      message: 'User unsuspended successfully',
    });
  });

  static promoteToAdmin = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      throw new GatrixError('Invalid user ID', 400);
    }

    const user = await UserService.promoteToAdmin(userId);

    res.json({
      success: true,
      data: { user },
      message: 'User promoted to admin successfully',
    });
  });

  static demoteFromAdmin = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      throw new GatrixError('Invalid user ID', 400);
    }

    // Prevent users from demoting themselves
    if (req.user?.userId === userId) {
      throw new GatrixError('You cannot demote your own account', 403);
    }

    const user = await UserService.demoteFromAdmin(userId);

    res.json({
      success: true,
      data: { user },
      message: 'User demoted from admin successfully',
    });
  });

  static getPendingUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const users = await UserService.getPendingUsers();

    res.json({
      success: true,
      data: { users },
    });
  });

  static getUserStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const stats = await UserService.getUserStats();

    res.json({
      success: true,
      data: { stats },
    });
  });

  // 사용자 검색 (채팅 시스템용)
  static searchUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { q: query, limit = 20 } = req.query;

    if (!query || typeof query !== 'string') {
      throw new GatrixError('Search query is required', 400);
    }

    if (query.length < 2) {
      throw new GatrixError('Search query must be at least 2 characters', 400);
    }

    const searchLimit = Math.min(parseInt(limit as string) || 20, 50); // 최대 50개로 제한

    const users = await UserService.searchUsers(query, searchLimit);

    res.json({
      success: true,
      data: users,
    });
  });

  // Self-service endpoints for regular users
  static getCurrentUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new GatrixError('User not authenticated', 401);
    }

    const user = await UserService.getUserById(req.user.userId);

    res.json({
      success: true,
      data: { user },
    });
  });

  static updateCurrentUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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

    // Chat Server에 사용자 정보 동기화 (백그라운드에서 실행)
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
      // Chat Server 동기화 실패는 로그만 남기고 사용자에게는 성공 응답
      logger.error('Failed to sync user to Chat Server:', error);
    }

    res.json({
      success: true,
      data: { user },
      message: 'Profile updated successfully',
    });
  });

  // 태그 관련 엔드포인트들
  static getUserTags = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      throw new GatrixError('Invalid user ID', 400);
    }

    const tags = await UserTagService.getUserTags(userId);

    res.json({
      success: true,
      data: tags,
    });
  });

  static setUserTags = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      throw new GatrixError('Invalid user ID', 400);
    }

    const { error, value } = setUserTagsSchema.validate(req.body);
    if (error) {
      throw new GatrixError(error.details[0].message, 400);
    }

    const { tagIds } = value;
    const updatedBy = req.user?.userId;

    await UserTagService.setUserTags(userId, tagIds, updatedBy!);

    res.json({
      success: true,
      message: 'User tags updated successfully',
    });
  });

  static addUserTag = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      throw new GatrixError('Invalid user ID', 400);
    }

    const { error, value } = addUserTagSchema.validate(req.body);
    if (error) {
      throw new GatrixError(error.details[0].message, 400);
    }

    const { tagId } = value;
    const createdBy = req.user?.userId;

    await UserTagService.addUserTag(userId, tagId, createdBy!);

    res.json({
      success: true,
      message: 'Tag added to user successfully',
    });
  });

  static removeUserTag = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.id);
    const tagId = parseInt(req.params.tagId);

    if (isNaN(userId) || isNaN(tagId)) {
      throw new GatrixError('Invalid user ID or tag ID', 400);
    }

    await UserTagService.removeUserTag(userId, tagId);

    res.json({
      success: true,
      message: 'Tag removed from user successfully',
    });
  });

  // 관리자가 사용자 이메일을 강제 인증 처리
  static verifyUserEmail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      throw new GatrixError('Invalid user ID', 400);
    }

    await UserService.verifyUserEmail(userId);

    res.json({
      success: true,
      message: 'User email verified successfully',
    });
  });

  // 사용자에게 이메일 인증 메일 재전송
  static resendVerificationEmail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      throw new GatrixError('Invalid user ID', 400);
    }

    await UserService.resendVerificationEmail(userId);

    res.json({
      success: true,
      message: 'Verification email sent successfully',
    });
  });

  /**
   * Update user's preferred language
   */
  static updateLanguage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
        preferredLanguage
      }
    });
  });

  // Environment access endpoints

  /**
   * Get user's environment access settings
   */
  static getEnvironmentAccess = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      throw new GatrixError('Invalid user ID', 400);
    }

    const access = await UserModel.getEnvironmentAccess(userId);

    res.json({
      success: true,
      data: access
    });
  });

  /**
   * Set user's environment access
   */
  static setEnvironmentAccess = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      throw new GatrixError('Invalid user ID', 400);
    }

    const { error, value } = setEnvironmentAccessSchema.validate(req.body);
    if (error) {
      throw new GatrixError(error.details[0].message, 400);
    }

    const { allowAllEnvironments, environments } = value;
    const updatedBy = req.user!.userId;

    await UserModel.setEnvironmentAccess(userId, allowAllEnvironments, environments, updatedBy);

    res.json({
      success: true,
      message: 'Environment access updated successfully'
    });
  });

  /**
   * Get current user's accessible environments
   */
  static getMyEnvironmentAccess = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;

    const accessibleEnvs = await UserModel.getAccessibleEnvironments(userId);

    res.json({
      success: true,
      data: {
        allowAllEnvironments: accessibleEnvs === 'all',
        environments: accessibleEnvs === 'all' ? [] : accessibleEnvs
      }
    });
  });
}
