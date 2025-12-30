import { Request, Response } from 'express';
import { UserService } from '../services/userService';
import { UserModel } from '../models/User';
import logger from '../config/logger';
import {
  sendBadRequest,
  sendNotFound,
  sendInternalError,
  sendSuccessResponse,
  ErrorCodes,
} from '../utils/apiResponse';

export interface ServerUserRequest extends Request {
  apiToken?: any;
}

class ServerUserController {
  // 사용자 ID로 사용자 정보 조회
  static async getUserById(req: ServerUserRequest, res: Response) {
    try {
      const userId = parseInt(req.params.id);

      if (isNaN(userId)) {
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
        role: user.role,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      });

    } catch (error) {
      return sendInternalError(res, 'Failed to get user by ID', error, ErrorCodes.RESOURCE_FETCH_FAILED);
    }
  }

  // 여러 사용자 ID로 사용자 정보 조회
  static async getUsersByIds(req: ServerUserRequest, res: Response) {
    try {
      const { userIds } = req.body;

      if (!Array.isArray(userIds)) {
        return sendBadRequest(res, 'userIds must be an array', { field: 'userIds' });
      }

      if (userIds.length === 0) {
        return sendSuccessResponse(res, []);
      }

      // 최대 100개까지만 허용
      if (userIds.length > 100) {
        return sendBadRequest(res, 'Maximum 100 user IDs allowed', { maxAllowed: 100, received: userIds.length });
      }

      // 모든 ID가 숫자인지 확인
      const validUserIds = userIds.filter(id => Number.isInteger(id) && id > 0);

      if (validUserIds.length === 0) {
        return sendSuccessResponse(res, []);
      }

      // 사용자 정보 조회
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
              role: user.role,
              status: user.status,
              lastLoginAt: user.lastLoginAt,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt
            });
          }
        } catch (error) {
          logger.warn(`Failed to get user ${userId}:`, error);
          // 개별 사용자 조회 실패는 무시하고 계속 진행
        }
      }

      return sendSuccessResponse(res, users);

    } catch (error) {
      return sendInternalError(res, 'Failed to get users by IDs', error, ErrorCodes.RESOURCE_FETCH_FAILED);
    }
  }

  // 사용자 동기화 데이터 조회 (채팅 서버용)
  static async syncUsers(req: ServerUserRequest, res: Response) {
    try {
      const { lastSyncAt } = req.query;

      // 기본적으로 최근 24시간 내 업데이트된 사용자 조회
      const since = lastSyncAt
        ? new Date(lastSyncAt as string)
        : new Date(Date.now() - 24 * 60 * 60 * 1000);

      logger.info('User sync request:', { lastSyncAt, since });

      // 실제 데이터베이스에서 사용자 조회
      const users = await UserModel.getUsersForSync(since);

      // 채팅 서버에서 기대하는 형식으로 변환
      const syncUsers = users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl || null,
        role: user.role,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }));

      return sendSuccessResponse(res, {
        users: syncUsers,
        syncAt: new Date().toISOString(),
        lastSyncAt: since.toISOString(),
        total: syncUsers.length
      });
    } catch (error) {
      return sendInternalError(res, 'Failed to sync users', error, ErrorCodes.RESOURCE_FETCH_FAILED);
    }
  }
}

export default ServerUserController;
