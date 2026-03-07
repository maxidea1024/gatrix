import { Request, Response } from 'express';
import { UserService } from '../services/user-service';
import { UserModel } from '../models/user';
import { createLogger } from '../config/logger';

const logger = createLogger('ServerUserController');
import {
  sendBadRequest,
  sendNotFound,
  sendInternalError,
  sendSuccessResponse,
  ErrorCodes,
} from '../utils/api-response';

export interface ServerUserRequest extends Request {
  apiToken?: any;
}

class ServerUserController {
  // Used자 ID로 User info 조회
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

  // 여러 Used자 ID로 User info 조회
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

      // 최대 100개까지만 허용
      if (userIds.length > 100) {
        return sendBadRequest(res, 'Maximum 100 user IDs allowed', {
          maxAllowed: 100,
          received: userIds.length,
        });
      }

      // 모든 ID가 숫자인지 Confirm
      const validUserIds = userIds.filter((id) => Number.isInteger(id) && id > 0);

      if (validUserIds.length === 0) {
        return sendSuccessResponse(res, []);
      }

      // User info 조회
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
          // 개별 Used자 조회 Failed는 Ignore하고 계속 진행
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

  // Used자 동기화 Query data (채팅 서버용)
  static async syncUsers(req: ServerUserRequest, res: Response) {
    try {
      const { lastSyncAt } = req.query;

      // 기본적으로 최근 24시간 내 업데이트된 Used자 조회
      const since = lastSyncAt
        ? new Date(lastSyncAt as string)
        : new Date(Date.now() - 24 * 60 * 60 * 1000);

      logger.info('User sync request:', { lastSyncAt, since });

      // 실제 데이터베이스에서 Used자 조회
      const users = await UserModel.getUsersForSync(since);

      // 채팅 서버에서 기대하는 형식으로 변환
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
