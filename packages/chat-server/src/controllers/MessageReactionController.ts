import { Request, Response } from 'express';
import { MessageReactionModel } from '../models/MessageReaction';
import { MessageModel } from '../models/Message';
import { createLogger } from '../config/logger';
// import { WebSocketService } from '../services/WebSocketService';

const logger = createLogger('MessageReactionController');

export class MessageReactionController {
  /**
   * 메시지에 리액션 추가/제거 (토글)
   * POST /api/v1/messages/:messageId/reactions
   */
  static async toggleReaction(req: Request, res: Response) {
    try {
      const messageId = parseInt(req.params.messageId);
      const userId = parseInt(req.headers['x-user-id'] as string);
      const { emoji } = req.body;
      
      if (!messageId || !userId || !emoji) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: messageId, userId, emoji'
        });
      }
      
      // 메시지 존재 확인
      const message = await MessageModel.findById(messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          error: 'Message not found'
        });
      }
      
      // 리액션 토글
      const result = await MessageReactionModel.toggleReaction(messageId, userId, emoji);
      
      // 업데이트된 리액션 요약 조회
      const reactionSummary = await MessageReactionModel.getReactionSummary(messageId, userId);
      
      // WebSocket으로 실시간 업데이트 전송
      try {
        const { BroadcastService } = require('../services/BroadcastService');
        const broadcastService = BroadcastService.getInstance();

        if (broadcastService) {
          await broadcastService.broadcastToChannel(message.channelId, 'message_reaction_updated', {
            messageId,
            reactions: reactionSummary,
            action: result.action,
            emoji,
            userId
          });

          logger.info(`Reaction update broadcasted to channel ${message.channelId}`);
        } else {
          logger.warn('BroadcastService not available for reaction update');
        }
      } catch (broadcastError) {
        logger.error('Failed to broadcast reaction update:', broadcastError);
      }

      // 리액션 알림 전송 (메시지 작성자가 자신의 메시지에 리액션한 경우 제외)
      if (result.action === 'added' && message.userId !== userId) {
        try {
          const { GatrixApiService } = require('../services/GatrixApiService');
          const gatrixApi = GatrixApiService.getInstance();

          // 리액션을 추가한 사용자 정보 가져오기
          const { UserService } = require('../services/UserService');
          const reactingUser = await UserService.getUserById(userId);

          await gatrixApi.sendNotification({
            userId: message.userId,
            type: 'message',
            title: `${reactingUser?.name || 'Someone'} reacted to your message`,
            content: `${reactingUser?.name || 'Someone'} reacted with ${emoji} to your message`,
            channelId: message.channelId,
            messageId: messageId,
            metadata: {
              emoji,
              reactingUserId: userId,
              reactingUserName: reactingUser?.name
            }
          });

          logger.info(`Reaction notification sent to user ${message.userId}`);
        } catch (notificationError) {
          logger.error('Failed to send reaction notification:', notificationError);
        }
      }
      
      logger.info(`Reaction ${result.action}: User ${userId} ${result.action} ${emoji} to message ${messageId}`);

      return res.json({
        success: true,
        data: {
          action: result.action,
          reaction: result.reaction,
          reactions: reactionSummary
        }
      });
    } catch (error: any) {
      logger.error('Error toggling reaction:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to toggle reaction',
        message: error.message
      });
    }
  }
  
  /**
   * 메시지의 리액션 목록 조회
   * GET /api/v1/messages/:messageId/reactions
   */
  static async getReactions(req: Request, res: Response) {
    try {
      const messageId = parseInt(req.params.messageId);
      const userId = parseInt(req.headers['x-user-id'] as string);
      
      if (!messageId) {
        return res.status(400).json({
          success: false,
          error: 'Invalid message ID'
        });
      }
      
      // 메시지 존재 확인
      const message = await MessageModel.findById(messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          error: 'Message not found'
        });
      }
      
      const reactions = await MessageReactionModel.getReactionSummary(messageId, userId);

      return res.json({
        success: true,
        data: {
          messageId,
          reactions
        }
      });
    } catch (error: any) {
      logger.error('Error getting reactions:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get reactions',
        message: error.message
      });
    }
  }
  
  /**
   * 특정 리액션 제거
   * DELETE /api/v1/messages/:messageId/reactions/:emoji
   */
  static async removeReaction(req: Request, res: Response) {
    try {
      const messageId = parseInt(req.params.messageId);
      const userId = parseInt(req.headers['x-user-id'] as string);
      const emoji = req.params.emoji;
      
      if (!messageId || !userId || !emoji) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters'
        });
      }
      
      // 메시지 존재 확인
      const message = await MessageModel.findById(messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          error: 'Message not found'
        });
      }
      
      const removed = await MessageReactionModel.removeReaction(messageId, userId, emoji);
      
      if (!removed) {
        return res.status(404).json({
          success: false,
          error: 'Reaction not found'
        });
      }
      
      // 업데이트된 리액션 요약 조회
      const reactionSummary = await MessageReactionModel.getReactionSummary(messageId, userId);
      
      // WebSocket으로 실시간 업데이트 전송
      try {
        const { BroadcastService } = require('../services/BroadcastService');
        const broadcastService = BroadcastService.getInstance();

        if (broadcastService) {
          await broadcastService.broadcastToChannel(message.channelId, 'message_reaction_updated', {
            messageId,
            reactions: reactionSummary,
            action: 'removed',
            emoji,
            userId
          });

          logger.info(`Reaction removal broadcasted to channel ${message.channelId}`);
        } else {
          logger.warn('BroadcastService not available for reaction removal');
        }
      } catch (broadcastError) {
        logger.error('Failed to broadcast reaction removal:', broadcastError);
      }
      
      logger.info(`Reaction removed: User ${userId} removed ${emoji} from message ${messageId}`);

      return res.json({
        success: true,
        data: {
          action: 'removed',
          reactions: reactionSummary
        }
      });
    } catch (error: any) {
      logger.error('Error removing reaction:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to remove reaction',
        message: error.message
      });
    }
  }
}
