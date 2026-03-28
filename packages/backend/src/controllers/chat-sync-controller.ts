import { Request, Response } from 'express';
import { ChatServerService } from '../services/chat-server-service';
import { UserModel } from '../models/user';
import { AuthenticatedRequest } from '../middleware/auth';

import { createLogger } from '../config/logger';
const logger = createLogger('ChatSyncController');

const DEFAULT_AVATAR_URL =
  'https://cdn-icons-png.flaticon.com/512/847/847969.png';

export class ChatSyncController {
  /**
   * Sync the current user to Chat Server
   * POST /api/v1/chat/sync-user
   */
  static async syncCurrentUser(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'Authentication required' },
        });
      }

      // Fetch user info
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { message: 'User not found' },
        });
      }

      // Sync user info to chat server
      const chatServerService = ChatServerService.getInstance();
      await chatServerService.syncUser({
        id: user.id,
        username: user.email, // Backend User Model does not have username field
        name: user.name || user.email,
        email: user.email,
        avatarUrl: user.avatarUrl || DEFAULT_AVATAR_URL,
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
          username: user.email,
        },
      });
    } catch (error: any) {
      logger.error('Error syncing user to Chat Server:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to sync user to Chat Server' },
      });
    }
  }

  /**
   * Sync a specific user to Chat Server (Admin only)
   * POST /api/v1/chat/sync-user/:userId
   */
  static async syncUser(req: AuthenticatedRequest, res: Response) {
    try {
      const targetUserId = req.params.userId;

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid userId' },
        });
      }

      // Fetch user info
      const user = await UserModel.findById(targetUserId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { message: 'User not found' },
        });
      }

      // Sync user info to chat server
      const chatServerService = ChatServerService.getInstance();
      await chatServerService.syncUser({
        id: user.id,
        username: user.email,
        name: user.name || user.email,
        email: user.email,
        avatarUrl: user.avatarUrl || DEFAULT_AVATAR_URL,
        status: 'offline', // Default when admin triggers sync
        lastSeenAt: new Date().toISOString(),
        createdAt: user.createdAt?.toISOString(),
        updatedAt: user.updatedAt?.toISOString(),
      });

      logger.info(
        `User ${targetUserId} synced to Chat Server by admin ${req.user?.userId}`
      );

      res.json({
        success: true,
        data: {
          message: 'User synchronized successfully',
          userId: user.id,
          username: user.email,
        },
      });
    } catch (error: any) {
      logger.error('Error syncing user to Chat Server:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to sync user to Chat Server' },
      });
    }
  }

  /**
   * Sync all users to Chat Server (Admin only)
   * POST /api/v1/chat/sync-all-users
   *
   * Now handled through proxy.
   * Actual request: POST /api/v1/users/sync-users
   */
  static async syncAllUsers(req: AuthenticatedRequest, res: Response) {
    try {
      // Fetch all active users
      const result = await UserModel.findAll(1, 1000, { status: 'active' });
      const users = result.users;

      if (users.length === 0) {
        return res.json({
          success: true,
          data: {
            message: 'No users to sync',
            syncedCount: 0,
          },
        });
      }

      // Transform user data
      const userData = users.map((user) => ({
        id: user.id,
        username: user.email,
        name: user.name || user.email,
        email: user.email,
        avatarUrl: user.avatarUrl || DEFAULT_AVATAR_URL,
        status: 'offline' as const,
        lastSeenAt: new Date().toISOString(),
        createdAt: user.createdAt?.toISOString(),
        updatedAt: user.updatedAt?.toISOString(),
      }));

      // Send bulk sync request via proxy
      const chatServerService = ChatServerService.getInstance();
      await chatServerService.syncUsers(userData);

      logger.info(
        `${users.length} users synced to Chat Server by admin ${req.user?.userId}`
      );

      res.json({
        success: true,
        data: {
          message: 'All users synchronized successfully',
          syncedCount: users.length,
        },
      });
    } catch (error: any) {
      logger.error('Error syncing all users to Chat Server:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to sync users to Chat Server' },
      });
    }
  }

  /**
   * Check Chat Server connection status
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
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      logger.error('Error checking Chat Server health:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to check Chat Server health' },
      });
    }
  }

  /**
   * Issue token for Chat WebSocket connection
   * POST /api/v1/chat/token
   */
  static async getChatToken(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'Authentication required' },
        });
      }

      // Fetch user info
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { message: 'User not found' },
        });
      }

      // First sync user to chat server
      try {
        const chatServerService = ChatServerService.getInstance();
        await chatServerService.syncUser({
          id: user.id,
          username: user.email, // Use email as username
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl || undefined,
          status: 'online', // Default to online
        });
      } catch (syncError) {
        logger.warn(
          'Failed to sync user to chat server, but continuing with token generation:',
          syncError
        );
      }

      // Create JWT token for chat server
      const jwt = require('jsonwebtoken');
      const chatToken = jwt.sign(
        {
          userId: user.id,
          username: user.email, // Use email as username
          name: user.name,
          email: user.email,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
        },
        process.env.JWT_SECRET || 'your-secret-key'
      );

      res.json({
        success: true,
        data: {
          token: chatToken,
          user: {
            id: user.id,
            username: user.email, // Use email as username
            name: user.name,
            email: user.email,
          },
        },
      });
    } catch (error: any) {
      logger.error('Error generating chat token:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to generate chat token' },
      });
    }
  }
}
