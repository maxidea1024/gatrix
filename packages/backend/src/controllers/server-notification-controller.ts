import { Request, Response } from 'express';
import { pubSubService } from '../services/pub-sub-service';

import { createLogger } from '../config/logger';
const logger = createLogger('ServerNotificationController');

export interface ServerNotificationRequest extends Request {
  apiToken?: any;
}

class ServerNotificationController {
  // Send notification
  static async sendNotification(req: ServerNotificationRequest, res: Response) {
    try {
      const { userId, type, title, content, channelId, messageId, metadata } =
        req.body;

      // Validate required fields
      if (!userId || !type || !title || !content) {
        return res.status(400).json({
          success: false,
          error: 'userId, type, title, and content are required',
        });
      }

      // Validate supported notification types
      const supportedTypes = ['message', 'mention', 'channel_invite', 'system'];
      if (!supportedTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: `Unsupported notification type. Supported types: ${supportedTypes.join(', ')}`,
        });
      }

      // Build notification data
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
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
        targetUsers: [userId], // Send to specific user only
      };

      // Broadcast to all instances via PubSub → each instance fans out to its SSE clients
      await pubSubService.publishNotification(notificationData);
      const sentCount = 0; // Fan-out is handled asynchronously by each instance

      logger.info(`Notification sent to user ${userId}:`, {
        type,
        title,
        sentCount,
      });

      res.json({
        success: true,
        message: 'Notification sent successfully',
        data: {
          sentCount,
          userId,
          type,
          timestamp: notificationData.timestamp,
        },
      });
    } catch (error) {
      logger.error('Failed to send notification:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  // Send notification to multiple users
  static async sendBulkNotification(
    req: ServerNotificationRequest,
    res: Response
  ) {
    try {
      const { userIds, type, title, content, channelId, messageId, metadata } =
        req.body;

      // Validate required fields
      if (
        !Array.isArray(userIds) ||
        userIds.length === 0 ||
        !type ||
        !title ||
        !content
      ) {
        return res.status(400).json({
          success: false,
          error: 'userIds (array), type, title, and content are required',
        });
      }

      // Allow up to 1000 users
      if (userIds.length > 1000) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 1000 users allowed for bulk notification',
        });
      }

      // Validate supported notification types
      const supportedTypes = ['message', 'mention', 'channel_invite', 'system'];
      if (!supportedTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: `Unsupported notification type. Supported types: ${supportedTypes.join(', ')}`,
        });
      }

      // Build notification data
      const notificationData = {
        type: 'chat_notification',
        data: {
          notificationType: type,
          title,
          content,
          channelId,
          messageId,
          metadata,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
        targetUsers: userIds,
      };

      // Broadcast to all instances via PubSub → each instance fans out to its SSE clients
      await pubSubService.publishNotification(notificationData);
      const sentCount = 0; // Fan-out is handled asynchronously by each instance

      logger.info(`Bulk notification sent to ${userIds.length} users:`, {
        type,
        title,
        sentCount,
      });

      res.json({
        success: true,
        message: 'Bulk notification sent successfully',
        data: {
          sentCount,
          targetUserCount: userIds.length,
          type,
          timestamp: notificationData.timestamp,
        },
      });
    } catch (error) {
      logger.error('Failed to send bulk notification:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}

export default ServerNotificationController;
