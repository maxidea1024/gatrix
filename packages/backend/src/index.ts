import { config } from './config';
import { createServer } from 'http';
import type { SSENotificationBusMessage } from './services/PubSubService';

// Lazy imports to avoid initialization at import time
let app: any;
let logger: any;
let database: any;
let redisClient: any;
let pubSubService: any;
let queueService: any;
let apiTokenUsageService: any;
let setDatabaseTimezoneToUTC: any;
let appInstance: any;
let SSENotificationService: any;

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  if (logger) {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
  } else {
    console.log(`Received ${signal}. Starting graceful shutdown...`);
  }

  try {
    // Close ApiTokenUsageService
    if (apiTokenUsageService) {
      try {
        await apiTokenUsageService.shutdown();
      } catch (error) {
        if (logger) logger.warn('Error shutting down ApiTokenUsageService:', error);
      }
    }

    // Close Queue service
    if (queueService) {
      try {
        await queueService.shutdown();
      } catch (error) {
        if (logger) logger.warn('Error shutting down Queue service:', error);
      }
    }

    // Close PubSub service
    if (pubSubService) {
      try {
        await pubSubService.shutdown();
      } catch (error) {
        if (logger) logger.warn('Error shutting down PubSub service:', error);
      }
    }

    // Close database connections
    if (database) {
      await database.close();
    }

    // Close Redis connection
    if (redisClient) {
      try {
        await redisClient.disconnect();
      } catch (error) {
        if (logger) logger.warn('Error disconnecting Redis:', error);
      }
    }

    if (logger) {
      logger.info('Graceful shutdown completed');
    } else {
      console.log('Graceful shutdown completed');
    }
    process.exit(0);
  } catch (error) {
    if (logger) {
      logger.error('Error during graceful shutdown:', error);
    } else {
      console.error('Error during graceful shutdown:', error);
    }
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    // Initialize modules at runtime to avoid import-time initialization issues
    logger = (await import('./config/logger')).default;

    // Initialize knex and Objection.js BEFORE database
    await import('./config/knex');

    database = (await import('./config/database')).default;
    redisClient = (await import('./config/redis')).default;

    const pubSubModule = await import('./services/PubSubService');
    pubSubService = pubSubModule.pubSubService;

    const queueModule = await import('./services/QueueService');
    queueService = queueModule.queueService;

    apiTokenUsageService = (await import('./services/ApiTokenUsageService')).default;
    app = (await import('./app')).default;

    const dbTimezoneModule = await import('./utils/dbTimezoneCheck');
    setDatabaseTimezoneToUTC = dbTimezoneModule.setDatabaseTimezoneToUTC;

    const appInstanceModule = await import('./utils/AppInstance');
    appInstance = appInstanceModule.appInstance;

    SSENotificationService = (await import('./services/sseNotificationService')).default;

    logger.info('Starting Gatrix Backend Server...');

    // Test database connection
    const dbConnected = await database.testConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }
    logger.info('Database connection established successfully');

    // Run database migrations
    try {
      logger.info('Running database migrations...');
      const { runMigrations } = await import('./database/migrate');
      await runMigrations();
      logger.info('Database migrations completed successfully');
    } catch (error) {
      logger.error('Database migrations failed:', error);
      throw error;
    }

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

    // Initialize ApiTokenUsageService (QueueService 珥덇린???꾩뿉 ?ㅽ뻾)
    try {
      await apiTokenUsageService.initialize();
      logger.info('ApiTokenUsageService initialized successfully');
    } catch (error) {
      logger.warn('ApiTokenUsageService initialization failed, continuing without token usage tracking:', error);
    }

    // Initialize system-defined KV items
    try {
      const { initializeSystemKV } = await import('./utils/systemKV');
      await initializeSystemKV();
      logger.info('System KV items initialized successfully');
    } catch (error) {
      logger.warn('System KV initialization failed, continuing:', error);
    }

    // Initialize Planning Data (reward lookup)
    try {
      const { PlanningDataService } = await import('./services/PlanningDataService');
      await PlanningDataService.initialize();
      logger.info('Planning data initialized successfully');
    } catch (error) {
      logger.warn('Planning data initialization failed, continuing:', error);
    }

    // Start HTTP server (WebSocket? 梨꾪똿?쒕쾭?먯꽌 吏곸젒 泥섎━)
    const server = createServer(app);

    server.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`, appInstance.getLogInfo());
      logger.info(`Health check available at http://127.0.0.1:${config.port}/health`);
      logger.info(`API available at http://127.0.0.1:${config.port}/api/v1`);
      logger.info(`Chat API proxy available at http://127.0.0.1:${config.port}/api/v1/chat`);
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
    if (logger) {
      logger.error('Failed to start server:', error);
    } else {
      console.error('Failed to start server:', error);
    }
    process.exit(1);
  }
};

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
