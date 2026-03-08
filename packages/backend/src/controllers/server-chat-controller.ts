import { Request, Response } from 'express';

import { createLogger } from '../config/logger';
const logger = createLogger('ServerChatController');

export interface ServerChatRequest extends Request {
  apiToken?: any;
}

// 메모리에 채팅 서버 정보 Save (실제로는 DB Used)
const chatServers = new Map<string, any>();
const chatStats = new Map<string, any>();

class ServerChatController {
  // 채팅 서버 Register
  static async registerServer(req: ServerChatRequest, res: Response) {
    try {
      const { serverId, host, port, maxConnections, capabilities } = req.body;

      // Validate required fields
      if (!serverId || !host || !port) {
        return res.status(400).json({
          success: false,
          error: 'serverId, host, and port are required',
        });
      }

      // 서버 정보 Save
      const serverInfo = {
        serverId,
        host,
        port,
        maxConnections: maxConnections || 10000,
        capabilities: capabilities || [],
        status: 'active',
        registeredAt: new Date(),
        lastHeartbeat: new Date(),
        apiTokenId: req.apiToken?.id,
      };

      chatServers.set(serverId, serverInfo);

      logger.info(`Chat server registered:`, {
        serverId,
        host,
        port,
        maxConnections: serverInfo.maxConnections,
      });

      res.json({
        success: true,
        message: 'Chat server registered successfully',
        data: {
          serverId,
          status: 'registered',
          registeredAt: serverInfo.registeredAt,
        },
      });
    } catch (error) {
      logger.error('Failed to register chat server:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  // 채팅 서버 Register Unregister
  static async unregisterServer(req: ServerChatRequest, res: Response) {
    try {
      const serverId = req.body.serverId || req.params.serverId;

      if (!serverId) {
        return res.status(400).json({
          success: false,
          error: 'serverId is required',
        });
      }

      const serverInfo = chatServers.get(serverId);

      if (!serverInfo) {
        return res.status(404).json({
          success: false,
          error: 'Chat server not found',
        });
      }

      // Remove server info
      chatServers.delete(serverId);
      chatStats.delete(serverId);

      logger.info(`Chat server unregistered: ${serverId}`);

      res.json({
        success: true,
        message: 'Chat server unregistered successfully',
        data: {
          serverId,
          status: 'unregistered',
          unregisteredAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to unregister chat server:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  // Report chat statistics
  static async reportStats(req: ServerChatRequest, res: Response) {
    try {
      const {
        serverId,
        connectedUsers,
        activeChannels,
        messagesPerSecond,
        timestamp,
      } = req.body;

      // Validate required fields
      if (
        !serverId ||
        connectedUsers === undefined ||
        activeChannels === undefined
      ) {
        return res.status(400).json({
          success: false,
          error: 'serverId, connectedUsers, and activeChannels are required',
        });
      }

      // Check if server is registered
      const serverInfo = chatServers.get(serverId);
      if (!serverInfo) {
        return res.status(404).json({
          success: false,
          error: 'Chat server not registered',
        });
      }

      // Save statistics info
      const statsData = {
        serverId,
        connectedUsers,
        activeChannels,
        messagesPerSecond: messagesPerSecond || 0,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        reportedAt: new Date(),
      };

      chatStats.set(serverId, statsData);

      // Update server heartbeat
      serverInfo.lastHeartbeat = new Date();
      chatServers.set(serverId, serverInfo);

      logger.debug(`Chat stats reported for server ${serverId}:`, {
        connectedUsers,
        activeChannels,
        messagesPerSecond,
      });

      res.json({
        success: true,
        message: 'Chat statistics reported successfully',
        data: {
          serverId,
          reportedAt: statsData.reportedAt,
        },
      });
    } catch (error) {
      logger.error('Failed to report chat stats:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  // Report chat activity
  static async reportActivity(req: ServerChatRequest, res: Response) {
    try {
      const { userId, channelId, messageCount, lastActivityAt } = req.body;

      // Validate required fields
      if (!userId || !channelId || messageCount === undefined) {
        return res.status(400).json({
          success: false,
          error: 'userId, channelId, and messageCount are required',
        });
      }

      // Log activity info
      logger.info(`Chat activity reported:`, {
        userId,
        channelId,
        messageCount,
        lastActivityAt: lastActivityAt || new Date(),
      });

      res.json({
        success: true,
        message: 'Chat activity reported successfully',
        data: {
          userId,
          channelId,
          reportedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to report chat activity:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  // Get registered chat server list (for admin)
  static async getRegisteredServers(req: ServerChatRequest, res: Response) {
    try {
      const servers = Array.from(chatServers.values());

      res.json({
        success: true,
        data: {
          servers,
          totalCount: servers.length,
        },
      });
    } catch (error) {
      logger.error('Failed to get registered servers:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
}

export default ServerChatController;
