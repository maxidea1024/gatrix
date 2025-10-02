import app from './app';
import { config } from './config';
import logger from './config/logger';
import database from './config/database';
import redisClient from './config/redis';
import { pubSubService, SSENotificationBusMessage } from './services/PubSubService';
import { queueService } from './services/QueueService';
import apiTokenUsageService from './services/ApiTokenUsageService';
import { checkDatabaseTimezone, setDatabaseTimezoneToUTC } from './utils/dbTimezoneCheck';
import { appInstance } from './utils/AppInstance';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { io as ioClient } from 'socket.io-client';
import SSENotificationService from './services/sseNotificationService';

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    // Close ApiTokenUsageService
    try {
      await apiTokenUsageService.shutdown();
    } catch (error) {
      logger.warn('Error shutting down ApiTokenUsageService:', error);
    }

    // Close Queue service
    try {
      await queueService.shutdown();
    } catch (error) {
      logger.warn('Error shutting down Queue service:', error);
    }

    // Close PubSub service
    try {
      await pubSubService.shutdown();
    } catch (error) {
      logger.warn('Error shutting down PubSub service:', error);
    }

    // Close database connections
    await database.close();

    // Close Redis connection
    try {
      await redisClient.disconnect();
    } catch (error) {
      logger.warn('Error disconnecting Redis:', error);
    }

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await database.testConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }
    logger.info('Database connection established successfully');

    // Check and configure database timezone
    try {
      await setDatabaseTimezoneToUTC();
      logger.info('Database timezone configured for UTC');
    } catch (error) {
      logger.warn('Failed to configure database timezone, continuing:', error);
    }

    // Connect to Redis (optional)
    try {
      await redisClient.connect();
      logger.info('Redis connection established successfully');
    } catch (error) {
      logger.warn('Redis connection failed, continuing without Redis:', error);
    }

    // Initialize PubSub service
    try {
      await pubSubService.initialize();
      logger.info('PubSub service initialized successfully');
    } catch (error) {
      logger.warn('PubSub service initialization failed, continuing without PubSub:', error);
    }

    // Bridge PubSub SSE messages to local SSE service fan-out
    try {
      pubSubService.on('sse-notification', (msg: SSENotificationBusMessage) => {
        try {
          const sse = SSENotificationService.getInstance();
          sse.sendNotification({
            type: msg.type,
            data: msg.data,
            timestamp: new Date(msg.timestamp || Date.now()),
            targetUsers: msg.targetUsers,
            targetChannels: msg.targetChannels,
            excludeUsers: msg.excludeUsers,
          });
        } catch (err) {
          logger.error('Failed to fan-out SSE from PubSub message:', err);
        }
      });
      logger.info('SSE PubSub bridge is set up');
    } catch (error) {
      logger.warn('Failed to set up SSE PubSub bridge:', error);
    }

    // Initialize Queue service
    try {
      await queueService.initialize();
      logger.info('Queue service initialized successfully');
    } catch (error) {
      logger.warn('Queue service initialization failed, continuing without queues:', error);
    }

    // Initialize ApiTokenUsageService (QueueService 초기화 후에 실행)
    try {
      await apiTokenUsageService.initialize();
      logger.info('ApiTokenUsageService initialized successfully');
    } catch (error) {
      logger.warn('ApiTokenUsageService initialization failed, continuing without token usage tracking:', error);
    }

    // Start HTTP server (WebSocket은 채팅서버에서 직접 처리)
    const server = createServer(app);

    server.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`, appInstance.getLogInfo());
      logger.info(`Health check available at http://localhost:${config.port}/health`);
      logger.info(`API available at http://localhost:${config.port}/api/v1`);
      logger.info(`Chat API proxy available at http://localhost:${config.port}/api/v1/chat`);
      logger.info(`Queue service ready: ${queueService.isReady()}`);
      logger.info(`PubSub service ready: ${pubSubService.isReady()}`);
    });

    // Handle server errors
    server.on('error', (error: any) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof config.port === 'string' ? 'Pipe ' + config.port : 'Port ' + config.port;

      switch (error.code) {
        case 'EACCES':
          logger.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
