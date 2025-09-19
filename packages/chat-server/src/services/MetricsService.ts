const promClient = require('prom-client');
const { register, collectDefaultMetrics, Counter, Histogram, Gauge } = promClient;
import express from 'express';
import { config } from '../config';
import { createLogger } from '../config/logger';

const logger = createLogger('MetricsService');

export class MetricsService {
  private static instance: MetricsService;
  private app: express.Application;
  private server: any;

  // Metrics
  public readonly connectedUsers: any;
  public readonly activeChannels: any;
  public readonly messagesPerSecond: any;
  public readonly messageLatency: any;
  public readonly broadcastLatency: any;
  public readonly redisOperations: any;
  public readonly memoryUsage: any;
  public readonly cpuUsage: any;
  public readonly websocketConnections: any;
  public readonly messageQueueSize: any;

  private constructor() {
    // Collect default metrics (CPU, memory, etc.)
    collectDefaultMetrics({ register });

    // Custom metrics for chat server
    this.connectedUsers = new Gauge({
      name: 'chat_connected_users_total',
      help: 'Total number of connected users',
      labelNames: ['server_id'],
    });

    this.activeChannels = new Gauge({
      name: 'chat_active_channels_total',
      help: 'Total number of active channels',
      labelNames: ['server_id'],
    });

    this.messagesPerSecond = new Counter({
      name: 'chat_messages_total',
      help: 'Total number of messages processed',
      labelNames: ['server_id', 'channel_id', 'message_type'],
    });

    this.messageLatency = new Histogram({
      name: 'chat_message_latency_seconds',
      help: 'Message processing latency',
      labelNames: ['server_id', 'operation'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    });

    this.broadcastLatency = new Histogram({
      name: 'chat_broadcast_latency_seconds',
      help: 'Message broadcast latency',
      labelNames: ['server_id', 'broadcast_type'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    });

    this.redisOperations = new Counter({
      name: 'chat_redis_operations_total',
      help: 'Total number of Redis operations',
      labelNames: ['server_id', 'operation', 'status'],
    });

    this.memoryUsage = new Gauge({
      name: 'chat_memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['server_id', 'type'],
    });

    this.cpuUsage = new Gauge({
      name: 'chat_cpu_usage_percent',
      help: 'CPU usage percentage',
      labelNames: ['server_id'],
    });

    this.websocketConnections = new Gauge({
      name: 'chat_websocket_connections_total',
      help: 'Total number of WebSocket connections',
      labelNames: ['server_id', 'transport'],
    });

    this.messageQueueSize = new Gauge({
      name: 'chat_message_queue_size',
      help: 'Size of message queue',
      labelNames: ['server_id', 'queue_type'],
    });

    this.app = express();
    this.setupRoutes();
  }

  public static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  private setupRoutes(): void {
    // Metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (error) {
        res.status(500).end(error);
      }
    });

    // Health check endpoint
    this.app.get(config.monitoring.healthCheckPath, (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid,
      });
    });

    // Readiness check endpoint
    this.app.get(config.monitoring.readinessCheckPath, (req, res) => {
      // Add checks for Redis, database, etc.
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          redis: 'ok', // TODO: Add actual Redis health check
          database: 'ok', // TODO: Add actual DB health check
        },
      });
    });
  }

  public start(): void {
    if (!config.monitoring.enabled) {
      logger.info('Metrics monitoring is disabled');
      return;
    }

    this.server = this.app.listen(config.monitoring.metricsPort, () => {
      logger.info(`Metrics server running on port ${config.monitoring.metricsPort}`);
    });

    // Start collecting custom metrics
    this.startMetricsCollection();
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.collectSystemMetrics();
    }, 5000); // Collect every 5 seconds
  }

  private collectSystemMetrics(): void {
    const serverId = process.env.SERVER_ID || 'unknown';
    
    // Memory usage
    const memUsage = process.memoryUsage();
    this.memoryUsage.set({ server_id: serverId, type: 'rss' }, memUsage.rss);
    this.memoryUsage.set({ server_id: serverId, type: 'heap_used' }, memUsage.heapUsed);
    this.memoryUsage.set({ server_id: serverId, type: 'heap_total' }, memUsage.heapTotal);
    this.memoryUsage.set({ server_id: serverId, type: 'external' }, memUsage.external);

    // CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    this.cpuUsage.set({ server_id: serverId }, (cpuUsage.user + cpuUsage.system) / 1000000);
  }

  // Helper methods for recording metrics
  public recordMessage(channelId: string, messageType: string): void {
    const serverId = process.env.SERVER_ID || 'unknown';
    this.messagesPerSecond.inc({ server_id: serverId, channel_id: channelId, message_type: messageType });
  }

  public recordMessageLatency(operation: string, latency: number): void {
    const serverId = process.env.SERVER_ID || 'unknown';
    this.messageLatency.observe({ server_id: serverId, operation }, latency);
  }

  public recordBroadcastLatency(broadcastType: string, latency: number): void {
    const serverId = process.env.SERVER_ID || 'unknown';
    this.broadcastLatency.observe({ server_id: serverId, broadcast_type: broadcastType }, latency);
  }

  public recordRedisOperation(operation: string, status: 'success' | 'error'): void {
    const serverId = process.env.SERVER_ID || 'unknown';
    this.redisOperations.inc({ server_id: serverId, operation, status });
  }

  public setConnectedUsers(count: number): void {
    const serverId = process.env.SERVER_ID || 'unknown';
    this.connectedUsers.set({ server_id: serverId }, count);
  }

  public setActiveChannels(count: number): void {
    const serverId = process.env.SERVER_ID || 'unknown';
    this.activeChannels.set({ server_id: serverId }, count);
  }

  public setWebSocketConnections(transport: string, count: number): void {
    const serverId = process.env.SERVER_ID || 'unknown';
    this.websocketConnections.set({ server_id: serverId, transport }, count);
  }

  public setMessageQueueSize(queueType: string, size: number): void {
    const serverId = process.env.SERVER_ID || 'unknown';
    this.messageQueueSize.set({ server_id: serverId, queue_type: queueType }, size);
  }

  public async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          logger.info('Metrics server stopped');
          resolve();
        });
      });
    }
  }
}

export const metricsService = MetricsService.getInstance();
