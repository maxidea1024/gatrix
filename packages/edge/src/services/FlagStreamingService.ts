/**
 * Flag Streaming Service (Edge)
 *
 * Manages SSE and WebSocket connections for real-time feature flag change
 * notifications on the Edge server. Subscribes to Redis Pub/Sub channel
 * 'gatrix-sdk-events' to receive feature_flag.changed events published
 * by the backend FeatureFlagService.
 *
 * Edge clients connect via:
 *   - SSE: GET `/client/features/:environment/stream/sse`
 *   - WebSocket: GET `/client/features/:environment/stream/ws`
 *
 * Revision management uses Redis INCR for consistency across multiple Edge instances.
 */

import { Response } from 'express';
import { createClient, RedisClientType } from 'redis';
import WebSocket, { WebSocketServer } from 'ws';
import { config } from '../config/env';
import logger from '../config/logger';
import { sdkManager } from './sdkManager';

interface StreamingClient {
    id: string;
    environment: string;
    response: Response;
    connectedAt: Date;
    lastEventTime: Date;
}

interface WebSocketClient {
    id: string;
    environment: string;
    ws: WebSocket;
    connectedAt: Date;
    lastEventTime: Date;
    authenticated: boolean;
}

const SDK_EVENTS_CHANNEL = 'gatrix-sdk-events';
const REVISION_KEY_PREFIX = 'gatrix:streaming:revision:';

class FlagStreamingService {
    private static instance: FlagStreamingService;
    private sseClients: Map<string, StreamingClient> = new Map();
    private wsClients: Map<string, WebSocketClient> = new Map();
    private wss: WebSocketServer | null = null;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private cleanupInterval: NodeJS.Timeout | null = null;
    private subscriber: RedisClientType | null = null;
    private redisClient: RedisClientType | null = null;
    private started = false;

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
            socket: { host: config.redis.host, port: config.redis.port },
            password: config.redis.password || undefined,
        };

        // Create Redis client for commands (INCR, GET)
        try {
            this.redisClient = createClient(redisOptions);
            this.redisClient.on('error', (err) => {
                logger.error('Edge FlagStreamingService Redis client error:', err);
            });
            await this.redisClient.connect();
        } catch (err) {
            logger.error('Edge FlagStreamingService: Failed to connect Redis client:', err);
        }

        // Subscribe to Redis PubSub for SDK events
        try {
            this.subscriber = createClient(redisOptions);

            this.subscriber.on('error', (err) => {
                logger.error('Edge FlagStreamingService Redis subscriber error:', err);
            });

            await this.subscriber.connect();

            await this.subscriber.subscribe(SDK_EVENTS_CHANNEL, (payload: string) => {
                try {
                    const event = JSON.parse(payload) as { type: string; data: Record<string, any> };
                    if (event.type === 'feature_flag.changed') {
                        const environment = event.data.environment as string;
                        const changedKeys = (event.data.changedKeys as string[]) ?? [];
                        if (environment) {
                            // Refresh Edge's own cache BEFORE notifying clients
                            // so that clients re-fetching immediately get fresh data
                            this.refreshCacheThenNotify(environment, changedKeys);
                        }
                    }
                } catch (err) {
                    logger.error('Edge FlagStreamingService: Failed to parse SDK event:', err);
                }
            });

            logger.info(
                `Edge FlagStreamingService: Subscribed to Redis channel: ${SDK_EVENTS_CHANNEL}`
            );
        } catch (err) {
            logger.error('Edge FlagStreamingService: Failed to subscribe to Redis PubSub:', err);
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

        logger.info('Edge FlagStreamingService started (SSE + WebSocket)');
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
                await this.subscriber.unsubscribe(SDK_EVENTS_CHANNEL);
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
        logger.info('Edge FlagStreamingService stopped');
    }

    /**
     * Add a new SSE client connection
     */
    async addClient(clientId: string, environment: string, res: Response): Promise<void> {
        // Set SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable nginx buffering
        });

        const client: StreamingClient = {
            id: clientId,
            environment,
            response: res,
            connectedAt: new Date(),
            lastEventTime: new Date(),
        };

        this.sseClients.set(clientId, client);

        // Send initial 'connected' event with current global revision from Redis
        const globalRevision = await this.getGlobalRevision(environment);
        this.sendSseEvent(clientId, 'connected', { globalRevision });

        // Handle connection close
        res.on('close', () => {
            this.removeClient(clientId);
        });

        logger.debug(`Edge streaming SSE client connected: ${clientId} for env: ${environment}`);
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
        logger.debug(`Edge streaming SSE client disconnected: ${clientId}`);
    }

    /**
     * Add a new WebSocket client connection.
     * Called after HTTP upgrade is handled externally.
     */
    async addWebSocketClient(
        clientId: string,
        environment: string,
        ws: WebSocket
    ): Promise<void> {
        const client: WebSocketClient = {
            id: clientId,
            environment,
            ws,
            connectedAt: new Date(),
            lastEventTime: new Date(),
            authenticated: true,
        };

        this.wsClients.set(clientId, client);

        // Send initial 'connected' event with current global revision from Redis
        const globalRevision = await this.getGlobalRevision(environment);
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
            logger.warn(`Edge WebSocket client error ${clientId}:`, err);
            this.removeWebSocketClient(clientId);
        });

        logger.debug(`Edge WebSocket client connected: ${clientId} for env: ${environment}`);
    }

    /**
     * Remove a WebSocket client connection
     */
    removeWebSocketClient(clientId: string): void {
        const client = this.wsClients.get(clientId);
        if (!client) return;

        try {
            if (client.ws.readyState === WebSocket.OPEN || client.ws.readyState === WebSocket.CONNECTING) {
                client.ws.close();
            }
        } catch {
            // Connection may already be closed
        }

        this.wsClients.delete(clientId);
        logger.debug(`Edge WebSocket client disconnected: ${clientId}`);
    }

    /**
     * Refresh the Edge's feature flag cache, then notify all clients.
     * This ensures clients that immediately re-fetch after notification receive fresh data.
     */
    private async refreshCacheThenNotify(
        environment: string,
        changedKeys: string[]
    ): Promise<void> {
        try {
            const sdk = sdkManager.getSDK();
            if (sdk) {
                await sdk.featureFlag.refreshByEnvironment(environment);
                logger.debug(
                    `Edge FlagStreamingService: Cache refreshed for env=${environment} before notify`
                );
            }
        } catch (err) {
            logger.error(
                'Edge FlagStreamingService: Failed to refresh cache before notify:',
                err
            );
            // Still notify clients even if cache refresh fails
        }

        await this.notifyClients(environment, changedKeys);
    }

    private async notifyClients(environment: string, changedKeys: string[]): Promise<void> {
        const newRevision = await this.incrementGlobalRevision(environment);
        const payload = {
            globalRevision: newRevision,
            changedKeys,
            timestamp: Date.now(),
        };

        let notifiedCount = 0;

        // Notify SSE clients
        for (const [clientId, client] of this.sseClients) {
            if (client.environment === environment) {
                this.sendSseEvent(clientId, 'flags_changed', payload);
                notifiedCount++;
            }
        }

        // Notify WebSocket clients
        for (const [clientId, client] of this.wsClients) {
            if (client.environment === environment) {
                this.sendWebSocketEvent(clientId, 'flags_changed', payload);
                notifiedCount++;
            }
        }

        if (notifiedCount > 0) {
            logger.debug(
                `Edge FlagStreamingService: Notified ${notifiedCount} clients for env=${environment}, rev=${newRevision}, keys=[${changedKeys.join(',')}]`
            );
        }
    }

    /**
     * Send an SSE event to a specific client
     */
    private sendSseEvent(clientId: string, event: string, data: Record<string, any>): boolean {
        const client = this.sseClients.get(clientId);
        if (!client) return false;

        try {
            const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            client.response.write(message);
            client.lastEventTime = new Date();
            return true;
        } catch (error) {
            logger.warn(
                `Edge FlagStreamingService: Failed to send SSE event to client ${clientId}:`,
                error
            );
            this.removeClient(clientId);
            return false;
        }
    }

    /**
     * Send a WebSocket event to a specific client
     */
    private sendWebSocketEvent(clientId: string, event: string, data: Record<string, any>): boolean {
        const client = this.wsClients.get(clientId);
        if (!client || client.ws.readyState !== WebSocket.OPEN) return false;

        try {
            const message = JSON.stringify({ type: event, data });
            client.ws.send(message);
            client.lastEventTime = new Date();
            return true;
        } catch (error) {
            logger.warn(
                `Edge FlagStreamingService: Failed to send WS event to client ${clientId}:`,
                error
            );
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
                client.response.write(
                    `event: heartbeat\ndata: ${heartbeatData}\n\n`
                );
            } catch {
                this.removeClient(clientId);
            }
        }

        // WebSocket heartbeat
        const wsHeartbeat = JSON.stringify({ type: 'heartbeat', data: { timestamp: Date.now() } });
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
            if (client.ws.readyState === WebSocket.CLOSED || client.ws.readyState === WebSocket.CLOSING) {
                this.removeWebSocketClient(clientId);
            }
        }
    }

    /**
     * Get current global revision for an environment from Redis.
     * Falls back to 0 if Redis is unavailable.
     */
    private async getGlobalRevision(environment: string): Promise<number> {
        if (!this.redisClient) return 0;
        try {
            const val = await this.redisClient.get(`${REVISION_KEY_PREFIX}${environment}`);
            return val ? parseInt(val, 10) : 0;
        } catch (err) {
            logger.warn('Edge FlagStreamingService: Failed to get revision from Redis:', err);
            return 0;
        }
    }

    /**
     * Atomically increment and return new global revision for an environment via Redis INCR.
     * This ensures consistency across multiple Edge instances.
     */
    private async incrementGlobalRevision(environment: string): Promise<number> {
        if (!this.redisClient) return 0;
        try {
            return await this.redisClient.incr(`${REVISION_KEY_PREFIX}${environment}`);
        } catch (err) {
            logger.warn('Edge FlagStreamingService: Failed to increment revision in Redis:', err);
            return 0;
        }
    }

    /**
     * Get service statistics
     */
    getStats(): {
        totalClients: number;
        sseClients: number;
        wsClients: number;
        clientsByEnvironment: Record<string, number>;
    } {
        const clientsByEnvironment: Record<string, number> = {};
        for (const [, client] of this.sseClients) {
            clientsByEnvironment[client.environment] =
                (clientsByEnvironment[client.environment] || 0) + 1;
        }
        for (const [, client] of this.wsClients) {
            clientsByEnvironment[client.environment] =
                (clientsByEnvironment[client.environment] || 0) + 1;
        }

        return {
            totalClients: this.sseClients.size + this.wsClients.size,
            sseClients: this.sseClients.size,
            wsClients: this.wsClients.size,
            clientsByEnvironment,
        };
    }
}

export const flagStreamingService = FlagStreamingService.getInstance();
