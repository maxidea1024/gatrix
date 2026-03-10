/**
 * Flag Streaming Service (Edge)
 *
 * Manages SSE and WebSocket connections for real-time feature flag change
 * notifications on the Edge server. Subscribes to Redis Pub/Sub channel
 * 'gatrix-sdk-events' to receive feature_flag.changed events published
 * by the backend FeatureFlagService.
 *
 * Edge clients connect via:
 *   - SSE: GET `/client/features/stream/sse`
 *   - WebSocket: GET `/client/features/stream/ws`
 *
 * Revision management uses Redis INCR for consistency across multiple Edge instances.
 */

import { Response } from 'express';
import Redis from 'ioredis';
import WebSocket, { WebSocketServer } from 'ws';
import { config } from '../config/env';
import { createLogger } from '../config/logger';

const logger = createLogger('FlagStreaming');
import { sdkManager } from './sdk-manager';

interface StreamingClient {
  id: string;
  environmentId: string;
  response: Response;
  connectedAt: Date;
  lastEventTime: Date;
}

interface WebSocketClient {
  id: string;
  environmentId: string;
  ws: WebSocket;
  connectedAt: Date;
  lastEventTime: Date;
  authenticated: boolean;
}

const SDK_EVENTS_PREFIX = 'gatrix-sdk-events';
const REVISION_KEY_PREFIX = 'gatrix:streaming:revision:';

interface StreamingStats {
  startTime: string;
  sse: {
    connectionAttempts: number;
    connectionSuccesses: number;
    authFailures: number;
    currentConnections: number;
    eventsSent: number;
    bytesSent: number;
  };
  ws: {
    connectionAttempts: number;
    connectionSuccesses: number;
    authFailures: number;
    currentConnections: number;
    eventsSent: number;
    bytesSent: number;
  };
  totalCurrentConnections: number;
  clientsByEnvironment: Record<string, { sse: number; ws: number }>;
}

class FlagStreamingService {
  private static instance: FlagStreamingService;
  private sseClients: Map<string, StreamingClient> = new Map();
  private wsClients: Map<string, WebSocketClient> = new Map();
  private wss: WebSocketServer | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private subscriber: Redis | null = null;
  private redisClient: Redis | null = null;
  private started = false;
  private startTime: Date = new Date();

  // Stats counters
  private sseConnectionAttempts = 0;
  private sseConnectionSuccesses = 0;
  private sseAuthFailures = 0;
  private sseEventsSent = 0;
  private sseBytesSent = 0;
  private wsConnectionAttempts = 0;
  private wsConnectionSuccesses = 0;
  private wsAuthFailures = 0;
  private wsEventsSent = 0;
  private wsBytesSent = 0;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): FlagStreamingService {
    if (!FlagStreamingService.instance) {
      FlagStreamingService.instance = new FlagStreamingService();
    }
    return FlagStreamingService.instance;
  }

  /**
   * Start the service: subscribe to Redis PubSub and start heartbeat/cleanup timers
   */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    const redisOptions = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db,
      lazyConnect: true,
      maxRetriesPerRequest: null,
    };

    // Create Redis client for commands (INCR, GET)
    try {
      this.redisClient = new Redis(redisOptions);
      this.redisClient.on('error', (err) => {
        logger.error('Redis client error:', err);
      });
      await this.redisClient.connect();
    } catch (err) {
      logger.error('Failed to connect Redis client:', err);
    }

    // Subscribe to Redis PubSub for SDK events
    try {
      this.subscriber = new Redis(redisOptions);

      this.subscriber.on('error', (err) => {
        logger.error('Redis subscriber error:', err);
      });

      await this.subscriber.connect();

      this.subscriber.on(
        'pmessage',
        (_pattern: string, _channel: string, message: string) => {
          try {
            const event = JSON.parse(message) as {
              type: string;
              data: Record<string, any>;
            };
            if (event.type === 'feature_flag.changed') {
              const environmentId = event.data.environmentId as string;
              const changedKeys = (event.data.changedKeys as string[]) ?? [];
              if (environmentId) {
                // Refresh Edge's own cache BEFORE notifying clients
                // so that clients re-fetching immediately get fresh data
                this.refreshCacheThenNotify(environmentId, changedKeys);
              }
            }
          } catch (err) {
            logger.error('Failed to parse SDK event:', err);
          }
        }
      );

      await this.subscriber.psubscribe(`${SDK_EVENTS_PREFIX}:*`);

      logger.info(`Subscribed to Redis pattern: ${SDK_EVENTS_PREFIX}:*`);
    } catch (err) {
      logger.error('Failed to subscribe to Redis PubSub:', err);
    }

    // Heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000);

    // Cleanup stale connections every 60 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections();
    }, 60000);

    // Create WebSocket server (noServer mode — upgrade handled externally)
    this.wss = new WebSocketServer({ noServer: true });

    logger.info('started (SSE + WebSocket)');
  }

  /**
   * Get the WebSocketServer instance for handling HTTP upgrade requests.
   */
  getWebSocketServer(): WebSocketServer | null {
    return this.wss;
  }

  /**
   * Stop the service
   */
  async stop(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Disconnect all SSE clients
    for (const [clientId] of this.sseClients) {
      this.removeClient(clientId);
    }

    // Disconnect all WebSocket clients
    for (const [clientId] of this.wsClients) {
      this.removeWebSocketClient(clientId);
    }

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    // Disconnect Redis subscriber
    if (this.subscriber) {
      try {
        await this.subscriber.punsubscribe(`${SDK_EVENTS_PREFIX}:*`);
        await this.subscriber.quit();
      } catch {
        // Ignore cleanup errors
      }
      this.subscriber = null;
    }

    // Disconnect Redis client
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {
        // Ignore cleanup errors
      }
      this.redisClient = null;
    }

    this.started = false;
    logger.info('stopped');
  }

  /**
   * Record an SSE auth failure (called externally when auth rejects)
   */
  recordSseAuthFailure(): void {
    this.sseConnectionAttempts++;
    this.sseAuthFailures++;
  }

  /**
   * Record a WebSocket auth failure (called externally when auth rejects)
   */
  recordWsAuthFailure(): void {
    this.wsConnectionAttempts++;
    this.wsAuthFailures++;
  }

  /**
   * Add a new SSE client connection
   */
  async addClient(
    clientId: string,
    environmentId: string,
    res: Response
  ): Promise<void> {
    this.sseConnectionAttempts++;
    this.sseConnectionSuccesses++;

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    const client: StreamingClient = {
      id: clientId,
      environmentId,
      response: res,
      connectedAt: new Date(),
      lastEventTime: new Date(),
    };

    this.sseClients.set(clientId, client);

    // Send initial 'connected' event with current global revision from Redis
    const globalRevision = await this.getGlobalRevision(environmentId);
    this.sendSseEvent(clientId, 'connected', { globalRevision });

    // Handle connection close
    res.on('close', () => {
      this.removeClient(clientId);
    });

    logger.debug(`SSE client connected: ${clientId} for env: ${environmentId}`);
  }

  /**
   * Remove a SSE client connection
   */
  removeClient(clientId: string): void {
    const client = this.sseClients.get(clientId);
    if (!client) return;

    try {
      if (!client.response.writableEnded) {
        client.response.end();
      }
    } catch {
      // Connection may already be closed
    }

    this.sseClients.delete(clientId);
    logger.debug(`SSE client disconnected: ${clientId}`);
  }

  /**
   * Add a new WebSocket client connection.
   * Called after HTTP upgrade is handled externally.
   */
  async addWebSocketClient(
    clientId: string,
    environmentId: string,
    ws: WebSocket
  ): Promise<void> {
    this.wsConnectionAttempts++;
    this.wsConnectionSuccesses++;

    const client: WebSocketClient = {
      id: clientId,
      environmentId,
      ws,
      connectedAt: new Date(),
      lastEventTime: new Date(),
      authenticated: true,
    };

    this.wsClients.set(clientId, client);

    // Send initial 'connected' event with current global revision from Redis
    const globalRevision = await this.getGlobalRevision(environmentId);
    this.sendWebSocketEvent(clientId, 'connected', { globalRevision });

    // Handle WebSocket messages (ping/pong, etc.)
    ws.on('message', (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') {
          this.sendWebSocketEvent(clientId, 'pong', { timestamp: Date.now() });
        }
      } catch {
        // Ignore malformed messages
      }
    });

    // Handle connection close
    ws.on('close', () => {
      this.removeWebSocketClient(clientId);
    });

    ws.on('error', (err) => {
      logger.warn(`client error ${clientId}:`, err);
      this.removeWebSocketClient(clientId);
    });

    logger.debug(`client connected: ${clientId} for env: ${environmentId}`);
  }

  /**
   * Remove a WebSocket client connection
   */
  removeWebSocketClient(clientId: string): void {
    const client = this.wsClients.get(clientId);
    if (!client) return;

    try {
      if (
        client.ws.readyState === WebSocket.OPEN ||
        client.ws.readyState === WebSocket.CONNECTING
      ) {
        client.ws.close();
      }
    } catch {
      // Connection may already be closed
    }

    this.wsClients.delete(clientId);
    logger.debug(`client disconnected: ${clientId}`);
  }

  /**
   * Refresh the Edge's feature flag cache, then notify all clients.
   * This ensures clients that immediately re-fetch after notification receive fresh data.
   */
  private async refreshCacheThenNotify(
    environmentId: string,
    changedKeys: string[]
  ): Promise<void> {
    try {
      const sdk = sdkManager.getSDK();
      if (sdk) {
        // SDK cache uses environmentId as key directly (no longer token-based)
        await sdk.featureFlag.refreshByEnvironment(environmentId);
        logger.debug(`Cache refreshed for env=${environmentId} before notify`);
      }
    } catch (err) {
      logger.error('Failed to refresh cache before notify:', err);
      // Still notify clients even if cache refresh fails
    }

    await this.notifyClients(environmentId, changedKeys);
  }

  private async notifyClients(
    environmentId: string,
    changedKeys: string[]
  ): Promise<void> {
    const newRevision = await this.incrementGlobalRevision(environmentId);
    const payload = {
      globalRevision: newRevision,
      changedKeys,
      timestamp: Date.now(),
    };

    let notifiedCount = 0;

    // Notify SSE clients
    for (const [clientId, client] of this.sseClients) {
      if (client.environmentId === environmentId) {
        this.sendSseEvent(clientId, 'flags_changed', payload);
        notifiedCount++;
      }
    }

    // Notify WebSocket clients
    for (const [clientId, client] of this.wsClients) {
      if (client.environmentId === environmentId) {
        this.sendWebSocketEvent(clientId, 'flags_changed', payload);
        notifiedCount++;
      }
    }

    if (notifiedCount > 0) {
      logger.debug(
        `Notified ${notifiedCount} clients for env=${environmentId}, rev=${newRevision}, keys=[${changedKeys.join(',')}]`
      );
    }
  }

  /**
   * Send an SSE event to a specific client
   */
  private sendSseEvent(
    clientId: string,
    event: string,
    data: Record<string, any>
  ): boolean {
    const client = this.sseClients.get(clientId);
    if (!client) return false;

    try {
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      client.response.write(message);
      client.lastEventTime = new Date();
      this.sseEventsSent++;
      this.sseBytesSent += Buffer.byteLength(message, 'utf8');
      return true;
    } catch (error) {
      logger.warn(`Failed to send SSE event to client ${clientId}:`, error);
      this.removeClient(clientId);
      return false;
    }
  }

  /**
   * Send a WebSocket event to a specific client
   */
  private sendWebSocketEvent(
    clientId: string,
    event: string,
    data: Record<string, any>
  ): boolean {
    const client = this.wsClients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return false;

    try {
      const message = JSON.stringify({ type: event, data });
      client.ws.send(message);
      client.lastEventTime = new Date();
      this.wsEventsSent++;
      this.wsBytesSent += Buffer.byteLength(message, 'utf8');
      return true;
    } catch (error) {
      logger.warn(`Failed to send WS event to client ${clientId}:`, error);
      this.removeWebSocketClient(clientId);
      return false;
    }
  }

  /**
   * Send heartbeat to all connected clients (SSE + WebSocket)
   */
  private sendHeartbeat(): void {
    const heartbeatData = JSON.stringify({ timestamp: Date.now() });

    // SSE heartbeat
    for (const [clientId, client] of this.sseClients) {
      try {
        client.response.write(`event: heartbeat\ndata: ${heartbeatData}\n\n`);
      } catch {
        this.removeClient(clientId);
      }
    }

    // WebSocket heartbeat
    const wsHeartbeat = JSON.stringify({
      type: 'heartbeat',
      data: { timestamp: Date.now() },
    });
    for (const [clientId, client] of this.wsClients) {
      try {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(wsHeartbeat);
        }
      } catch {
        this.removeWebSocketClient(clientId);
      }
    }
  }

  /**
   * Remove connections that are no longer writable
   */
  private cleanupStaleConnections(): void {
    // Cleanup SSE
    for (const [clientId, client] of this.sseClients) {
      if (client.response.writableEnded || client.response.destroyed) {
        this.removeClient(clientId);
      }
    }

    // Cleanup WebSocket
    for (const [clientId, client] of this.wsClients) {
      if (
        client.ws.readyState === WebSocket.CLOSED ||
        client.ws.readyState === WebSocket.CLOSING
      ) {
        this.removeWebSocketClient(clientId);
      }
    }
  }

  /**
   * Get current global revision for an environment from Redis.
   * Falls back to 0 if Redis is unavailable.
   */
  private async getGlobalRevision(environmentId: string): Promise<number> {
    if (!this.redisClient) return 0;
    try {
      const val = await this.redisClient.get(
        `${REVISION_KEY_PREFIX}${environmentId}`
      );
      return val ? parseInt(val, 10) : 0;
    } catch (err) {
      logger.warn('Failed to get revision from Redis:', err);
      return 0;
    }
  }

  /**
   * Atomically increment and return new global revision for an environment via Redis INCR.
   * This ensures consistency across multiple Edge instances.
   */
  private async incrementGlobalRevision(
    environmentId: string
  ): Promise<number> {
    if (!this.redisClient) return 0;
    try {
      return await this.redisClient.incr(
        `${REVISION_KEY_PREFIX}${environmentId}`
      );
    } catch (err) {
      logger.warn('Failed to increment revision in Redis:', err);
      return 0;
    }
  }

  /**
   * Get service statistics (legacy)
   */
  getStats(): {
    totalClients: number;
    sseClients: number;
    wsClients: number;
    clientsByEnvironment: Record<string, number>;
  } {
    const clientsByEnvironment: Record<string, number> = {};
    for (const [, client] of this.sseClients) {
      clientsByEnvironment[client.environmentId] =
        (clientsByEnvironment[client.environmentId] || 0) + 1;
    }
    for (const [, client] of this.wsClients) {
      clientsByEnvironment[client.environmentId] =
        (clientsByEnvironment[client.environmentId] || 0) + 1;
    }

    return {
      totalClients: this.sseClients.size + this.wsClients.size,
      sseClients: this.sseClients.size,
      wsClients: this.wsClients.size,
      clientsByEnvironment,
    };
  }

  /**
   * Get detailed streaming statistics including connection counts, traffic, and environment breakdown
   */
  getDetailedStats(): StreamingStats {
    // Build per-environment breakdown
    const clientsByEnvironment: Record<string, { sse: number; ws: number }> = {};
    for (const [, client] of this.sseClients) {
      if (!clientsByEnvironment[client.environmentId]) {
        clientsByEnvironment[client.environmentId] = { sse: 0, ws: 0 };
      }
      clientsByEnvironment[client.environmentId].sse++;
    }
    for (const [, client] of this.wsClients) {
      if (!clientsByEnvironment[client.environmentId]) {
        clientsByEnvironment[client.environmentId] = { sse: 0, ws: 0 };
      }
      clientsByEnvironment[client.environmentId].ws++;
    }

    return {
      startTime: this.startTime.toISOString(),
      sse: {
        connectionAttempts: this.sseConnectionAttempts,
        connectionSuccesses: this.sseConnectionSuccesses,
        authFailures: this.sseAuthFailures,
        currentConnections: this.sseClients.size,
        eventsSent: this.sseEventsSent,
        bytesSent: this.sseBytesSent,
      },
      ws: {
        connectionAttempts: this.wsConnectionAttempts,
        connectionSuccesses: this.wsConnectionSuccesses,
        authFailures: this.wsAuthFailures,
        currentConnections: this.wsClients.size,
        eventsSent: this.wsEventsSent,
        bytesSent: this.wsBytesSent,
      },
      totalCurrentConnections: this.sseClients.size + this.wsClients.size,
      clientsByEnvironment,
    };
  }
}

export const flagStreamingService = FlagStreamingService.getInstance();
