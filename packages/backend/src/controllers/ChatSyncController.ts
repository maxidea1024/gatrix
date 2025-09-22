import { Request, Response } from 'express';
import { ChatServerService } from '../services/ChatServerService';
import { UserModel } from '../models/User';
import { AuthenticatedRequest } from '../middleware/auth';
import logger from '../config/logger';

export class ChatSyncController {
  /**
   * 현재 사용자를 Chat Server에 동기화
   * POST /api/v1/chat/sync-user
   */
  static async syncCurrentUser(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'Authentication required' }
        });
      }

      // 사용자 정보 조회
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { message: 'User not found' }
        });
      }

      // Chat Server에 사용자 정보 동기화
      const chatServerService = ChatServerService.getInstance();
      await chatServerService.syncUser({
        id: user.id,
        username: user.email, // Backend User 모델에는 username이 없음
        name: user.name || user.email,
        email: user.email,
        avatar: '', // Backend User 모델에는 avatar가 없음
        status: 'online',
        lastSeenAt: new Date().toISOString(),
        createdAt: user.createdAt?.toISOString(),
        updatedAt: user.updatedAt?.toISOString(),
      });

      logger.info(`User ${userId} synced to Chat Server`);

      res.json({
        success: true,
        data: {
          message: 'User synchronized successfully',
          userId: user.id,
          username: user.email
        }
      });
    } catch (error: any) {
      logger.error('Error syncing user to Chat Server:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to sync user to Chat Server' }
      });
    }
  }

  /**
   * 특정 사용자를 Chat Server에 동기화 (관리자 전용)
   * POST /api/v1/chat/sync-user/:userId
   */
  static async syncUser(req: AuthenticatedRequest, res: Response) {
    try {
      const targetUserId = parseInt(req.params.userId);

      if (isNaN(targetUserId)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid userId' }
        });
      }

      // 사용자 정보 조회
      const user = await UserModel.findById(targetUserId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { message: 'User not found' }
        });
      }

      // Chat Server에 사용자 정보 동기화
      const chatServerService = ChatServerService.getInstance();
      await chatServerService.syncUser({
        id: user.id,
        username: user.email,
        name: user.name || user.email,
        email: user.email,
        avatar: '',
        status: 'offline', // 관리자가 동기화하는 경우 기본값
        lastSeenAt: new Date().toISOString(),
        createdAt: user.createdAt?.toISOString(),
        updatedAt: user.updatedAt?.toISOString(),
      });

      logger.info(`User ${targetUserId} synced to Chat Server by admin ${req.user?.userId}`);

      res.json({
        success: true,
        data: {
          message: 'User synchronized successfully',
          userId: user.id,
          username: user.email
        }
      });
    } catch (error: any) {
      logger.error('Error syncing user to Chat Server:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to sync user to Chat Server' }
      });
    }
  }

  /**
   * 모든 사용자를 Chat Server에 동기화 (관리자 전용)
   * POST /api/v1/chat/sync-all-users
   */
  static async syncAllUsers(req: AuthenticatedRequest, res: Response) {
    try {
      // 모든 활성 사용자 조회 (간단한 방식으로 수정)
      const result = await UserModel.findAll(1, 1000, { status: 'active' });
      const users = result.users;

      if (users.length === 0) {
        return res.json({
          success: true,
          data: {
            message: 'No users to sync',
            syncedCount: 0
          }
        });
      }

      // Chat Server에 사용자 정보 동기화
      const chatServerService = ChatServerService.getInstance();
      const userData = users.map(user => ({
        id: user.id,
        username: user.email,
        name: user.name || user.email,
        email: user.email,
        avatar: '',
        status: 'offline' as const,
        lastSeenAt: new Date().toISOString(),
        createdAt: user.createdAt?.toISOString(),
        updatedAt: user.updatedAt?.toISOString(),
      }));

      await chatServerService.syncUsers(userData);

      logger.info(`${users.length} users synced to Chat Server by admin ${req.user?.userId}`);

      res.json({
        success: true,
        data: {
          message: 'All users synchronized successfully',
          syncedCount: users.length
        }
      });
    } catch (error: any) {
      logger.error('Error syncing all users to Chat Server:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to sync users to Chat Server' }
      });
    }
  }

  /**
   * Chat Server 연결 상태 확인
   * GET /api/v1/chat/health
   */
  static async healthCheck(req: Request, res: Response) {
    try {
      const chatServerService = ChatServerService.getInstance();
      const isHealthy = await chatServerService.healthCheck();

      res.json({
        success: true,
        data: {
          chatServerHealthy: isHealthy,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      logger.error('Error checking Chat Server health:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to check Chat Server health' }
      });
    }
  }

  /**
   * Chat WebSocket 연결용 토큰 발급
   * POST /api/v1/chat/token
   */
  static async getChatToken(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'Authentication required' }
        });
      }

      // 사용자 정보 조회
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { message: 'User not found' }
        });
      }

      // 먼저 사용자를 Chat Server에 동기화
      try {
        const chatServerService = ChatServerService.getInstance();
        await chatServerService.syncUser({
          id: user.id,
          username: user.email, // email을 username으로 사용
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl || undefined,
          status: 'online' // 기본값으로 online 설정
        });
      } catch (syncError) {
        logger.warn('Failed to sync user to chat server, but continuing with token generation:', syncError);
      }

      // Chat Server용 JWT 토큰 생성
      const jwt = require('jsonwebtoken');
      const chatToken = jwt.sign(
        {
          userId: user.id,
          username: user.email, // email을 username으로 사용
          name: user.name,
          email: user.email,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24시간
        },
        process.env.JWT_SECRET || 'your-secret-key'
      );

      res.json({
        success: true,
        data: {
          token: chatToken,
          user: {
            id: user.id,
            username: user.email, // email을 username으로 사용
            name: user.name,
            email: user.email
          }
        }
      });

    } catch (error: any) {
      logger.error('Error generating chat token:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to generate chat token' }
      });
    }
  }

}
