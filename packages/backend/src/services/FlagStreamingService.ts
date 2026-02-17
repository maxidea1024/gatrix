/**
 * Flag Streaming Service
 *
 * Manages SSE connections for real-time feature flag change notifications.
 * Clients connect via `/client/features/:environment/stream` and receive
 * invalidation signals when flags change, triggering them to re-fetch.
 *
 * Subscribes to Redis Pub/Sub channel 'gatrix-sdk-events' to receive
 * feature_flag.changed events published by FeatureFlagService.invalidateCache().
 */

import { Response } from 'express';
import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import logger from '../config/logger';

interface StreamingClient {
    id: string;
    environment: string;
    response: Response;
    connectedAt: Date;
    lastEventTime: Date;
}

const SDK_EVENTS_CHANNEL = 'gatrix-sdk-events';

class FlagStreamingService {
    private static instance: FlagStreamingService;
    private clients: Map<string, StreamingClient> = new Map();
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private cleanupInterval: NodeJS.Timeout | null = null;
    private globalRevisions: Map<string, number> = new Map();
    private subscriber: RedisClientType | null = null;
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
     * Start the service: subscribe to Redis PubSub and start heartbeat
     */
    async start(): Promise<void> {
        if (this.started) return;
        this.started = true;

        // Subscribe to Redis PubSub for SDK events
        try {
            this.subscriber = createClient({
                socket: { host: config.redis.host, port: config.redis.port },
                password: config.redis.password || undefined,
            });

            this.subscriber.on('error', (err) => {
                logger.error('FlagStreamingService Redis subscriber error:', err);
            });

            await this.subscriber.connect();

            await this.subscriber.subscribe(SDK_EVENTS_CHANNEL, (payload: string) => {
                try {
                    const event = JSON.parse(payload) as { type: string; data: Record<string, any> };
                    if (event.type === 'feature_flag.changed') {
                        const environment = event.data.environment as string;
                        if (environment) {
                            this.notifyClients(environment);
                        }
                    }
                } catch (err) {
                    logger.error('FlagStreamingService: Failed to parse SDK event:', err);
                }
            });

            logger.info(`FlagStreamingService: Subscribed to Redis channel: ${SDK_EVENTS_CHANNEL}`);
        } catch (err) {
            logger.error('FlagStreamingService: Failed to subscribe to Redis PubSub:', err);
        }

        // Heartbeat every 30 seconds
        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, 30000);

        // Cleanup stale connections every 60 seconds
        this.cleanupInterval = setInterval(() => {
            this.cleanupStaleConnections();
        }, 60000);

        logger.info('FlagStreamingService started');
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

        // Disconnect all clients
        for (const [clientId] of this.clients) {
            this.removeClient(clientId);
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

        this.started = false;
        logger.info('FlagStreamingService stopped');
    }

    /**
     * Add a new SSE client connection
     */
    addClient(clientId: string, environment: string, res: Response): void {
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

        this.clients.set(clientId, client);

        // Send initial 'connected' event with current global revision
        const globalRevision = this.getGlobalRevision(environment);
        this.sendEvent(clientId, 'connected', { globalRevision });

        // Handle connection close
        res.on('close', () => {
            this.removeClient(clientId);
        });

        logger.debug(`Streaming client connected: ${clientId} for env: ${environment}`);
    }

    /**
     * Remove a client connection
     */
    removeClient(clientId: string): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        try {
            if (!client.response.writableEnded) {
                client.response.end();
            }
        } catch {
            // Connection may already be closed
        }

        this.clients.delete(clientId);
        logger.debug(`Streaming client disconnected: ${clientId}`);
    }

    /**
     * Notify all clients subscribed to a specific environment
     */
    private notifyClients(environment: string): void {
        const newRevision = this.incrementGlobalRevision(environment);

        let notifiedCount = 0;
        for (const [clientId, client] of this.clients) {
            if (client.environment === environment) {
                this.sendEvent(clientId, 'flags_changed', {
                    globalRevision: newRevision,
                    changedKeys: [],
                    timestamp: Date.now(),
                });
                notifiedCount++;
            }
        }

        if (notifiedCount > 0) {
            logger.debug(
                `FlagStreamingService: Notified ${notifiedCount} clients for env=${environment}, rev=${newRevision}`
            );
        }
    }

    /**
     * Send an SSE event to a specific client
     */
    private sendEvent(clientId: string, event: string, data: Record<string, any>): boolean {
        const client = this.clients.get(clientId);
        if (!client) return false;

        try {
            const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            client.response.write(message);
            client.lastEventTime = new Date();
            return true;
        } catch (error) {
            logger.warn(`FlagStreamingService: Failed to send event to client ${clientId}:`, error);
            this.removeClient(clientId);
            return false;
        }
    }

    /**
     * Send heartbeat to all connected clients
     */
    private sendHeartbeat(): void {
        for (const [clientId, client] of this.clients) {
            try {
                client.response.write(
                    `event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`
                );
            } catch {
                this.removeClient(clientId);
            }
        }
    }

    /**
     * Remove connections that are no longer writable
     */
    private cleanupStaleConnections(): void {
        for (const [clientId, client] of this.clients) {
            if (client.response.writableEnded || client.response.destroyed) {
                this.removeClient(clientId);
            }
        }
    }

    /**
     * Get current global revision for an environment
     */
    private getGlobalRevision(environment: string): number {
        return this.globalRevisions.get(environment) ?? 0;
    }

    /**
     * Increment and return new global revision for an environment
     */
    private incrementGlobalRevision(environment: string): number {
        const current = this.globalRevisions.get(environment) ?? 0;
        const next = current + 1;
        this.globalRevisions.set(environment, next);
        return next;
    }

    /**
     * Get service statistics
     */
    getStats(): {
        totalClients: number;
        clientsByEnvironment: Record<string, number>;
        globalRevisions: Record<string, number>;
    } {
        const clientsByEnvironment: Record<string, number> = {};
        for (const [, client] of this.clients) {
            clientsByEnvironment[client.environment] =
                (clientsByEnvironment[client.environment] || 0) + 1;
        }

        return {
            totalClients: this.clients.size,
            clientsByEnvironment,
            globalRevisions: Object.fromEntries(this.globalRevisions),
        };
    }
}

export const flagStreamingService = FlagStreamingService.getInstance();
