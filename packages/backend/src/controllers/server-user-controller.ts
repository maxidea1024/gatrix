import { Request, Response } from 'express';
import { UserService } from '../services/user-service';
import { UserModel } from '../models/user';
import {
  sendBadRequest,
  sendNotFound,
  sendInternalError,
  sendSuccessResponse,
  ErrorCodes,
} from '../utils/api-response';

import { createLogger } from '../config/logger';
const logger = createLogger('ServerUserController');

export interface ServerUserRequest extends Request {
  apiToken?: any;
}

class ServerUserController {
  // Get user info by user ID
  static async getUserById(req: ServerUserRequest, res: Response) {
    try {
      const userId = req.params.id;

      if (!userId) {
        return sendBadRequest(res, 'Invalid user ID', { field: 'id' });
      }

      const user = await UserService.getUserById(userId);

      if (!user) {
        return sendNotFound(res, 'User not found', ErrorCodes.USER_NOT_FOUND);
      }

      return sendSuccessResponse(res, {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,

        status: user.status,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    } catch (error) {
      return sendInternalError(
        res,
        'Failed to get user by ID',
        error,
        ErrorCodes.RESOURCE_FETCH_FAILED
      );
    }
  }

  // Get user info by multiple user IDs
  static async getUsersByIds(req: ServerUserRequest, res: Response) {
    try {
      const { userIds } = req.body;

      if (!Array.isArray(userIds)) {
        return sendBadRequest(res, 'userIds must be an array', {
          field: 'userIds',
        });
      }

      if (userIds.length === 0) {
        return sendSuccessResponse(res, []);
      }

      // Allow up to 100 IDs
      if (userIds.length > 100) {
        return sendBadRequest(res, 'Maximum 100 user IDs allowed', {
          maxAllowed: 100,
          received: userIds.length,
        });
      }

      // Validate all IDs are strings
      const validUserIds = userIds.filter(
        (id) => Number.isInteger(id) && id > 0
      );

      if (validUserIds.length === 0) {
        return sendSuccessResponse(res, []);
      }

      // Fetch user info
      const users = [];
      for (const userId of validUserIds) {
        try {
          const user = await UserService.getUserById(userId);
          if (user) {
            users.push({
              id: user.id,
              email: user.email,
              name: user.name,
              avatarUrl: user.avatarUrl,

              status: user.status,
              lastLoginAt: user.lastLoginAt,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            });
          }
        } catch (error) {
          logger.warn(`Failed to get user ${userId}:`, error);
          // Ignore individual user fetch failures and continue
        }
      }

      return sendSuccessResponse(res, users);
    } catch (error) {
      return sendInternalError(
        res,
        'Failed to get users by IDs',
        error,
        ErrorCodes.RESOURCE_FETCH_FAILED
      );
    }
  }

  // Sync user data (for chat server)
  static async syncUsers(req: ServerUserRequest, res: Response) {
    try {
      const { lastSyncAt } = req.query;

      // By default, fetch users updated within the last 24 hours
      const since = lastSyncAt
        ? new Date(lastSyncAt as string)
        : new Date(Date.now() - 24 * 60 * 60 * 1000);

      logger.info('User sync request:', { lastSyncAt, since });

      // Fetch users from database
      const users = await UserModel.getUsersForSync(since);

      // Transform to chat server expected format
      const syncUsers = users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl || null,

        status: user.status,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));

      return sendSuccessResponse(res, {
        users: syncUsers,
        syncAt: new Date().toISOString(),
        lastSyncAt: since.toISOString(),
        total: syncUsers.length,
      });
    } catch (error) {
      return sendInternalError(
        res,
        'Failed to sync users',
        error,
        ErrorCodes.RESOURCE_FETCH_FAILED
      );
    }
  }
}

export default ServerUserController;
