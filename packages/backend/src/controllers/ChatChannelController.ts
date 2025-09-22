import { Request, Response } from 'express';
import { ChatServerService } from '../services/ChatServerService';
import { createLogger } from '../config/logger';
import { JWTPayload } from '../types/auth';

const logger = createLogger('ChatChannelController');

/**
 * Chat Channel Controller
 * Frontend와 Chat Server 사이의 프록시 역할
 */
export class ChatChannelController {
  private static chatServerService = ChatServerService.getInstance();

  /**
   * 사용자의 채널 목록 조회
   */
  static async getMyChannels(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user as JWTPayload;
      if (!user) {
        res.status(401).json({
          success: false,
          error: { message: 'Authentication required' }
        });
        return;
      }

      // Chat Server에서 사용자 채널 목록 조회
      const response = await ChatChannelController.chatServerService.getUserChannels(user.userId);

      res.json({
        success: true,
        data: response // Chat Server의 응답을 그대로 전달 (data: [], pagination: {...})
      });

    } catch (error) {
      logger.error('Error getting user channels:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get channels' }
      });
    }
  }

  /**
   * 채널 생성
   */
  static async createChannel(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user as JWTPayload;
      if (!user) {
        res.status(401).json({
          success: false,
          error: { message: 'Authentication required' }
        });
        return;
      }

      const { name, description, type = 'public' } = req.body;

      if (!name) {
        res.status(400).json({
          success: false,
          error: { message: 'Channel name is required' }
        });
        return;
      }

      // Chat Server에서 채널 생성
      const channel = await ChatChannelController.chatServerService.createChannel({
        name,
        description,
        type,
        createdBy: user.userId
      });

      res.status(201).json({
        success: true,
        data: { channel }
      });

    } catch (error) {
      logger.error('Error creating channel:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to create channel' }
      });
    }
  }

  /**
   * 채널 정보 조회
   */
  static async getChannel(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user as JWTPayload;
      if (!user) {
        res.status(401).json({
          success: false,
          error: { message: 'Authentication required' }
        });
        return;
      }

      const { channelId } = req.params;

      // Chat Server에서 채널 정보 조회
      const channel = await ChatChannelController.chatServerService.getChannel(parseInt(channelId));

      if (!channel) {
        res.status(404).json({
          success: false,
          error: { message: 'Channel not found' }
        });
        return;
      }

      res.json({
        success: true,
        data: { channel }
      });

    } catch (error) {
      logger.error('Error getting channel:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get channel' }
      });
    }
  }

  /**
   * 채널 메시지 조회
   */
  static async getChannelMessages(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user as JWTPayload;
      if (!user) {
        res.status(401).json({
          success: false,
          error: { message: 'Authentication required' }
        });
        return;
      }

      const { channelId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      // Chat Server에서 채널 메시지 조회
      const messages = await ChatChannelController.chatServerService.getChannelMessages(
        parseInt(channelId),
        {
          page: parseInt(page as string),
          limit: parseInt(limit as string)
        }
      );

      res.json({
        success: true,
        data: { messages }
      });

    } catch (error) {
      logger.error('Error getting channel messages:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get messages' }
      });
    }
  }

  /**
   * 사용자 목록 조회
   */
  static async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user as JWTPayload;
      if (!user) {
        res.status(401).json({
          success: false,
          error: { message: 'Authentication required' }
        });
        return;
      }

      const { search } = req.query;

      // Chat Server에서 사용자 목록 조회
      const users = await ChatChannelController.chatServerService.getUsers(user.userId, search as string);

      res.json({
        success: true,
        data: users
      });

    } catch (error) {
      logger.error('Error getting users:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to get users' }
      });
    }
  }
}
