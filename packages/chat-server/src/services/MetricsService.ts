const promClient = require('prom-client');
const { register, collectDefaultMetrics, Counter, Histogram, Gauge } = promClient;
import type express from 'express';
import { config } from '../config';
import { createLogger } from '../config/logger';
import os from 'os';
import { ulid } from 'ulid';

const logger = createLogger('MetricsService');

/**
 * MetricsService for Chat Server
 * - Attaches /metrics endpoint to existing Express app
 * - Collects default Node.js metrics and custom chat metrics
 * - No side effects on import
 */
export const initMetrics = (app: express.Application): void => {
  try {
    const enabled = config.monitoring?.enabled === true || String(process.env.MONITORING_ENABLED).toLowerCase() === 'true';
    if (!enabled) return;

    // Get instance information
    const hostname = `${os.hostname()}:${process.pid}`;
    const instanceId = ulid();

    // Get primary IP address (first non-loopback IPv4)
    const interfaces = os.networkInterfaces();
    let ip = 'unknown';
    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (iface) {
        for (const addr of iface) {
          if (addr.family === 'IPv4' && !addr.internal) {
            ip = addr.address;
            break;
          }
        }
        if (ip !== 'unknown') break;
      }
    }

    // Set default labels with instance information
    register.setDefaultLabels({
      service: 'chat-server',
      instanceId,
      hostname,
      ip
    });

    // Collect default metrics (CPU, memory, etc.)
    collectDefaultMetrics({ register });

    // Custom metrics for chat server
    const connectedUsers = new Gauge({
      name: 'chat_connected_users_total',
      help: 'Total number of connected users',
      labelNames: ['server_id'],
    });

    const activeChannels = new Gauge({
      name: 'chat_active_channels_total',
      help: 'Total number of active channels',
      labelNames: ['server_id'],
    });

    const messagesPerSecond = new Counter({
      name: 'chat_messages_total',
      help: 'Total number of messages processed',
      labelNames: ['server_id', 'channel_id', 'message_type'],
    });

    const messageLatency = new Histogram({
      name: 'chat_message_latency_seconds',
      help: 'Message processing latency',
      labelNames: ['server_id', 'operation'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    });

    const broadcastLatency = new Histogram({
      name: 'chat_broadcast_latency_seconds',
      help: 'Message broadcast latency',
      labelNames: ['server_id', 'broadcast_type'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    });

    const redisOperations = new Counter({
      name: 'chat_redis_operations_total',
      help: 'Total number of Redis operations',
      labelNames: ['server_id', 'operation', 'status'],
    });

    const memoryUsage = new Gauge({
      name: 'chat_memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['server_id', 'type'],
    });

    const cpuUsage = new Gauge({
      name: 'chat_cpu_usage_percent',
      help: 'CPU usage percentage',
      labelNames: ['server_id'],
    });

    const websocketConnections = new Gauge({
      name: 'chat_websocket_connections_total',
      help: 'Total number of WebSocket connections',
      labelNames: ['server_id', 'transport'],
    });

    const messageQueueSize = new Gauge({
      name: 'chat_message_queue_size',
      help: 'Size of message queue',
      labelNames: ['server_id', 'queue_type'],
    });

    // Metrics endpoint
    app.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (error) {
        res.status(500).end(String(error));
      }
    });

    // Health check endpoint
    app.get(config.monitoring.healthCheckPath, (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid,
      });
    });

    // Readiness check endpoint
    app.get(config.monitoring.readinessCheckPath, async (req, res) => {
      const checks: any = {};
      let overallStatus = 'ready';

      // Redis health check
      try {
        const { redisManager } = require('../config/redis');
        const redisClient = redisManager.getClient();
        await redisClient.ping();
        checks.redis = 'ok';
      } catch (error) {
        checks.redis = 'error';
        overallStatus = 'not_ready';
      }

      // Database health check
      try {
        const { databaseManager } = require('../config/database');
        const db = databaseManager.getConnection();
        await db.raw('SELECT 1');
        checks.database = 'ok';
      } catch (error) {
        checks.database = 'error';
        overallStatus = 'not_ready';
      }

      res.status(overallStatus === 'ready' ? 200 : 503).json({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        checks,
      });
    });

    // Start collecting custom metrics
    setInterval(() => {
      const serverId = process.env.SERVER_ID || 'unknown';

      // Memory usage
      const memUsageData = process.memoryUsage();
      memoryUsage.set({ server_id: serverId, type: 'rss' }, memUsageData.rss);
      memoryUsage.set({ server_id: serverId, type: 'heap_used' }, memUsageData.heapUsed);
      memoryUsage.set({ server_id: serverId, type: 'heap_total' }, memUsageData.heapTotal);
      memoryUsage.set({ server_id: serverId, type: 'external' }, memUsageData.external);

      // CPU usage (simplified)
      const cpuUsageData = process.cpuUsage();
      cpuUsage.set({ server_id: serverId }, (cpuUsageData.user + cpuUsageData.system) / 1000000);
    }, 5000); // Collect every 5 seconds

    // Export metrics helpers for use in other services
    (app as any).chatMetrics = {
      connectedUsers,
      activeChannels,
      messagesPerSecond,
      messageLatency,
      broadcastLatency,
      redisOperations,
      memoryUsage,
      cpuUsage,
      websocketConnections,
      messageQueueSize,
    };

  } catch (err) {
    // Do not crash app because of metrics init
    logger.warn('[Metrics] Initialization skipped due to error:', err);
  }
};

// Helper to get metrics from app
export const getMetrics = (app: express.Application): any => {
  return (app as any).chatMetrics || {};
};

export default { initMetrics, getMetrics };
