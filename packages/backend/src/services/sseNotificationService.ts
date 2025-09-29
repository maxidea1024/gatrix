import { Response } from 'express';
import { EventEmitter } from 'events';
import logger from '../config/logger';

export interface SSEClient {
  id: string;
  userId?: number;
  response: Response;
  lastPing: Date;
  subscriptions: Set<string>;
}

export interface NotificationEvent {
  type: string;
  data: any;
  timestamp: Date;
  targetUsers?: number[];
  targetChannels?: string[];
}

export class SSENotificationService extends EventEmitter {
  private static instance: SSENotificationService;
  private clients: Map<string, SSEClient> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.startPingInterval();
    this.startCleanupInterval();
  }

  public static getInstance(): SSENotificationService {
    if (!SSENotificationService.instance) {
      SSENotificationService.instance = new SSENotificationService();
    }
    return SSENotificationService.instance;
  }

  /**
   * Add a new SSE client
   */
  public addClient(clientId: string, response: Response, userId?: number): void {
    // Set SSE headers
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });
    // Immediately flush headers and send a comment to start the stream
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (response as any).flushHeaders?.();
    try {
      response.write(': connected\n\n');
    } catch (_) {
      // ignore
    }

    // Ensure headers are flushed immediately (important for SSE)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (response as any).flushHeaders?.();

    const client: SSEClient = {
      id: clientId,
      userId,
      response,
      lastPing: new Date(),
      subscriptions: new Set(),
    };

    this.clients.set(clientId, client);

    // Send initial connection event
    logger.info(`Sending initial connection event to client ${clientId}`);
    this.sendToClient(clientId, {
      type: 'connection',
      data: { clientId, connected: true },
      timestamp: new Date(),
    });
    logger.info(`Initial connection event sent to client ${clientId}`);

    // Handle client disconnect
    response.on('close', () => {
      this.removeClient(clientId);
    });

    logger.info(`SSE client connected: ${clientId}${userId ? ` (user: ${userId})` : ''}`);
  }

  /**
   * Remove a client
   */
  public removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.response.end();
      } catch (error) {
        // Client already disconnected
      }
      this.clients.delete(clientId);
      logger.info(`SSE client disconnected: ${clientId}`);
    }
  }

  /**
   * Subscribe client to specific channels
   */
  public subscribe(clientId: string, channels: string[]): void {
    const client = this.clients.get(clientId);
    if (client) {
      channels.forEach(channel => client.subscriptions.add(channel));
      logger.debug(`Client ${clientId} subscribed to channels: ${channels.join(', ')}`);
    }
  }

  /**
   * Unsubscribe client from specific channels
   */
  public unsubscribe(clientId: string, channels: string[]): void {
    const client = this.clients.get(clientId);
    if (client) {
      channels.forEach(channel => client.subscriptions.delete(channel));
      logger.debug(`Client ${clientId} unsubscribed from channels: ${channels.join(', ')}`);
    }
  }

  /**
   * Send event to specific client
   */
  public sendToClient(clientId: string, event: NotificationEvent): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    try {
      // SSE 표준 형식: data: {JSON}\n\n
      const eventData = `data: ${JSON.stringify({
        type: event.type,
        data: event.data,
        timestamp: event.timestamp.toISOString(),
      })}\n\n`;

      logger.debug(`Sending SSE event to client ${clientId}:`, {
        type: event.type,
        data: event.data,
        eventData: eventData.replace(/\n/g, '\\n')
      });

      client.response.write(eventData);
      return true;
    } catch (error) {
      logger.error(`Error sending event to client ${clientId}:`, error);
      this.removeClient(clientId);
      return false;
    }
  }

  /**
   * Send event to specific user
   */
  public sendToUser(userId: number, event: NotificationEvent): number {
    let sentCount = 0;
    
    this.clients.forEach((client) => {
      if (client.userId === userId) {
        if (this.sendToClient(client.id, event)) {
          sentCount++;
        }
      }
    });

    return sentCount;
  }

  /**
   * Send event to all clients subscribed to specific channels
   */
  public sendToChannels(channels: string[], event: NotificationEvent): number {
    let sentCount = 0;

    this.clients.forEach((client) => {
      const hasSubscription = channels.some(channel => client.subscriptions.has(channel));
      if (hasSubscription) {
        if (this.sendToClient(client.id, event)) {
          sentCount++;
        }
      }
    });

    return sentCount;
  }

  /**
   * Broadcast event to all connected clients
   */
  public broadcast(event: NotificationEvent): number {
    let sentCount = 0;

    this.clients.forEach((client) => {
      if (this.sendToClient(client.id, event)) {
        sentCount++;
      }
    });

    return sentCount;
  }

  /**
   * Send targeted notification
   */
  public sendNotification(event: NotificationEvent): number {
    let totalSent = 0;

    // Send to specific users
    if (event.targetUsers && event.targetUsers.length > 0) {
      event.targetUsers.forEach(userId => {
        totalSent += this.sendToUser(userId, event);
      });
    }

    // Send to specific channels
    if (event.targetChannels && event.targetChannels.length > 0) {
      totalSent += this.sendToChannels(event.targetChannels, event);
    }

    // If no specific targets, broadcast to all
    if (!event.targetUsers && !event.targetChannels) {
      totalSent = this.broadcast(event);
    }

    return totalSent;
  }

  /**
   * Send ping to all clients to keep connections alive
   */
  private sendPing(): void {
    const pingEvent: NotificationEvent = {
      type: 'ping',
      data: { timestamp: new Date().toISOString() },
      timestamp: new Date(),
    };

    this.clients.forEach((client) => {
      if (this.sendToClient(client.id, pingEvent)) {
        client.lastPing = new Date();
      }
    });
  }

  /**
   * Start ping interval to keep connections alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Start cleanup interval to remove stale connections
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const now = new Date();
      const staleThreshold = 2 * 60 * 1000; // 2 minutes

      this.clients.forEach((client, clientId) => {
        if (now.getTime() - client.lastPing.getTime() > staleThreshold) {
          logger.warn(`Removing stale SSE client: ${clientId}`);
          this.removeClient(clientId);
        }
      });
    }, 60000); // Check every minute
  }

  /**
   * Get service statistics
   */
  public getStats(): {
    totalClients: number;
    clientsByUser: Record<number, number>;
    subscriptionCounts: Record<string, number>;
  } {
    const clientsByUser: Record<number, number> = {};
    const subscriptionCounts: Record<string, number> = {};

    this.clients.forEach((client) => {
      if (client.userId) {
        clientsByUser[client.userId] = (clientsByUser[client.userId] || 0) + 1;
      }

      client.subscriptions.forEach(subscription => {
        subscriptionCounts[subscription] = (subscriptionCounts[subscription] || 0) + 1;
      });
    });

    return {
      totalClients: this.clients.size,
      clientsByUser,
      subscriptionCounts,
    };
  }

  /**
   * Shutdown the service
   */
  public shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all client connections
    this.clients.forEach((client, clientId) => {
      this.removeClient(clientId);
    });

    logger.info('SSE Notification Service shutdown complete');
  }
}

/**
 * Remote Config specific notification helpers
 */
export class RemoteConfigNotifications {
  private static sseService = SSENotificationService.getInstance();

  /**
   * Notify about config changes
   */
  static notifyConfigChange(configId: number, action: 'created' | 'updated' | 'deleted' | 'campaign_started' | 'campaign_ended', config: any): void {
    const event: NotificationEvent = {
      type: 'remote_config_change',
      data: {
        configId,
        action,
        config,
      },
      timestamp: new Date(),
      targetChannels: ['remote_config', 'admin'],
    };

    const sentCount = this.sseService.sendNotification(event);
    logger.info(`Remote config change notification sent to ${sentCount} clients`);
  }

  /**
   * Notify about deployment
   */
  static notifyDeployment(deploymentId: number, configs: any[]): void {
    const event: NotificationEvent = {
      type: 'remote_config_deployment',
      data: {
        deploymentId,
        configCount: configs.length,
        configs,
      },
      timestamp: new Date(),
      targetChannels: ['remote_config', 'admin'],
    };

    const sentCount = this.sseService.sendNotification(event);
    logger.info(`Remote config deployment notification sent to ${sentCount} clients`);
  }

  /**
   * Notify about campaign status change
   */
  static notifyCampaignStatusChange(campaignId: number, isActive: boolean, reason: string): void {
    const event: NotificationEvent = {
      type: 'campaign_status_change',
      data: {
        campaignId,
        isActive,
        reason,
      },
      timestamp: new Date(),
      targetChannels: ['remote_config', 'campaigns', 'admin'],
    };

    const sentCount = this.sseService.sendNotification(event);
    logger.info(`Campaign status change notification sent to ${sentCount} clients`);
  }
}

export default SSENotificationService;
