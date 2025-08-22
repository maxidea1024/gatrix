import { Response } from 'express';
import { UserService } from '../services/userService';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import logger from '../config/logger';
import Joi from 'joi';

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
});

export class UserController {
  static getAllUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Validate query parameters
    const { error, value } = getUsersQuerySchema.validate(req.query);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
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

  static getUserById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      throw new CustomError('Invalid user ID', 400);
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
      throw new CustomError('Invalid user ID', 400);
    }

    // Validate request body
    const { error, value } = updateUserSchema.validate(req.body);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    // Prevent users from modifying their own role or status (except admins)
    if (req.user?.userId === userId && req.user?.role !== 'admin') {
      if (value.role || value.status) {
        throw new CustomError('You cannot modify your own role or status', 403);
      }
    }

    const user = await UserService.updateUser(userId, value);

    res.json({
      success: true,
      data: { user },
      message: 'User updated successfully',
    });
  });

  static deleteUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      throw new CustomError('Invalid user ID', 400);
    }

    // Prevent users from deleting themselves
    if (req.user?.userId === userId) {
      throw new CustomError('You cannot delete your own account', 403);
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
      throw new CustomError('Invalid user ID', 400);
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
      throw new CustomError('Invalid user ID', 400);
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
      throw new CustomError('Invalid user ID', 400);
    }

    // Prevent users from suspending themselves
    if (req.user?.userId === userId) {
      throw new CustomError('You cannot suspend your own account', 403);
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
      throw new CustomError('Invalid user ID', 400);
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
      throw new CustomError('Invalid user ID', 400);
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
      throw new CustomError('Invalid user ID', 400);
    }

    // Prevent users from demoting themselves
    if (req.user?.userId === userId) {
      throw new CustomError('You cannot demote your own account', 403);
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

  // Self-service endpoints for regular users
  static getCurrentUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new CustomError('User not authenticated', 401);
    }

    const user = await UserService.getUserById(req.user.userId);

    res.json({
      success: true,
      data: { user },
    });
  });

  static updateCurrentUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new CustomError('User not authenticated', 401);
    }

    // Validate request body (limited fields for self-update)
    const selfUpdateSchema = Joi.object({
      name: Joi.string().min(2).max(100).optional(),
      avatarUrl: Joi.string().uri().optional().allow(''),
    });

    const { error, value } = selfUpdateSchema.validate(req.body);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const user = await UserService.updateUser(req.user.userId, value);

    res.json({
      success: true,
      data: { user },
      message: 'Profile updated successfully',
    });
  });
}
