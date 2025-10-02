import { Request, Response } from 'express';
import { pubSubService } from '../services/PubSubService';
import logger from '../config/logger';

export interface ServerNotificationRequest extends Request {
  apiToken?: any;
}

class ServerNotificationController {
  // 알림 전송
  static async sendNotification(req: ServerNotificationRequest, res: Response) {
    try {
      const {
        userId,
        type,
        title,
        content,
        channelId,
        messageId,
        metadata
      } = req.body;

      // 필수 필드 검증
      if (!userId || !type || !title || !content) {
        return res.status(400).json({
          success: false,
          error: 'userId, type, title, and content are required'
        });
      }

      // 지원되는 알림 타입 검증
      const supportedTypes = ['message', 'mention', 'channel_invite', 'system'];
      if (!supportedTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: `Unsupported notification type. Supported types: ${supportedTypes.join(', ')}`
        });
      }


      // 알림 데이터 구성
      const notificationData = {
        type: 'chat_notification',
        data: {
          userId,
          notificationType: type,
          title,
          content,
          channelId,
          messageId,
          metadata,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date(),
        targetUsers: [userId] // 특정 사용자에게만 전송
      };

      // PubSub을 통해 전 인스턴스에 전파 → 각 인스턴스가 자신의 SSE 클라이언트로 팬아웃
      await pubSubService.publishNotification(notificationData);
      const sentCount = 0; // fan-out은 비동기적으로 각 인스턴스에서 처리됨

      logger.info(`Notification sent to user ${userId}:`, {
        type,
        title,
        sentCount
      });

      res.json({
        success: true,
        message: 'Notification sent successfully',
        data: {
          sentCount,
          userId,
          type,
          timestamp: notificationData.timestamp
        }
      });

    } catch (error) {
      logger.error('Failed to send notification:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // 여러 사용자에게 알림 전송
  static async sendBulkNotification(req: ServerNotificationRequest, res: Response) {
    try {
      const {
        userIds,
        type,
        title,
        content,
        channelId,
        messageId,
        metadata
      } = req.body;

      // 필수 필드 검증
      if (!Array.isArray(userIds) || userIds.length === 0 || !type || !title || !content) {
        return res.status(400).json({
          success: false,
          error: 'userIds (array), type, title, and content are required'
        });
      }

      // 최대 1000명까지만 허용
      if (userIds.length > 1000) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 1000 users allowed for bulk notification'
        });
      }

      // 지원되는 알림 타입 검증
      const supportedTypes = ['message', 'mention', 'channel_invite', 'system'];
      if (!supportedTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: `Unsupported notification type. Supported types: ${supportedTypes.join(', ')}`
        });
      }


      // 알림 데이터 구성
      const notificationData = {
        type: 'chat_notification',
        data: {
          notificationType: type,
          title,
          content,
          channelId,
          messageId,
          metadata,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date(),
        targetUsers: userIds
      };

      // PubSub으로 전 인스턴스에 전파 → 각 인스턴스가 자신의 SSE 클라이언트로 팬아웃
      await pubSubService.publishNotification(notificationData);
      const sentCount = 0; // fan-out은 비동기적으로 각 인스턴스에서 처리됨

      logger.info(`Bulk notification sent to ${userIds.length} users:`, {
        type,
        title,
        sentCount
      });

      res.json({
        success: true,
        message: 'Bulk notification sent successfully',
        data: {
          sentCount,
          targetUserCount: userIds.length,
          type,
          timestamp: notificationData.timestamp
        }
      });

    } catch (error) {
      logger.error('Failed to send bulk notification:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

export default ServerNotificationController;
