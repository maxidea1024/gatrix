import { Request, Response } from 'express';
import { UserService } from '../services/userService';
import logger from '../config/logger';

export interface ServerUserRequest extends Request {
  apiToken?: any;
}

class ServerUserController {
  // 사용자 ID로 사용자 정보 조회
  static async getUserById(req: ServerUserRequest, res: Response) {
    try {
      const userId = parseInt(req.params.id);

      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid user ID'
        });
      }

      const user = await UserService.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: user.role,
          status: user.status,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      });

    } catch (error) {
      logger.error('Failed to get user by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // 여러 사용자 ID로 사용자 정보 조회
  static async getUsersByIds(req: ServerUserRequest, res: Response) {
    try {
      const { userIds } = req.body;

      if (!Array.isArray(userIds)) {
        return res.status(400).json({
          success: false,
          error: 'userIds must be an array'
        });
      }

      if (userIds.length === 0) {
        return res.json({
          success: true,
          data: []
        });
      }

      // 최대 100개까지만 허용
      if (userIds.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 100 user IDs allowed'
        });
      }

      // 모든 ID가 숫자인지 확인
      const validUserIds = userIds.filter(id => Number.isInteger(id) && id > 0);
      
      if (validUserIds.length === 0) {
        return res.json({
          success: true,
          data: []
        });
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

      res.json({
        success: true,
        data: users
      });

    } catch (error) {
      logger.error('Failed to get users by IDs:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
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

      // 간단한 구현: 빈 배열 반환 (테스트용)
      const mockUsers = [
        {
          id: 1,
          email: 'admin@gatrix.com',
          name: 'Admin',
          avatar: null,
          role: 'admin',
          status: 'active',
          lastLoginAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      res.json({
        success: true,
        data: {
          users: mockUsers,
          syncAt: new Date().toISOString(),
          lastSyncAt: since.toISOString(),
          total: mockUsers.length
        }
      });
    } catch (error) {
      logger.error('Failed to sync users:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

export default ServerUserController;
