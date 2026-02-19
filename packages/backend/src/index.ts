import { config } from './config';
import { createServer } from 'http';
import type { SSENotificationBusMessage } from './services/PubSubService';
import type { GatrixServerSDK } from '@gatrix/server-sdk';

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
let httpServer: any;
let lifecycleCleanupScheduler: any;

// Backend service instance ID for service discovery
let backendInstanceId: string | null = null;
// GatrixServerSDK instance for service discovery
export let gatrixSdk: GatrixServerSDK | null = null;

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

  // Set a hard timeout to force exit if graceful shutdown takes too long
  const SHUTDOWN_TIMEOUT = 10000; // 10 seconds
  const shutdownTimer = setTimeout(() => {
    if (logger) {
      logger.warn('Graceful shutdown timeout exceeded, forcing exit');
    } else {
      console.warn('Graceful shutdown timeout exceeded, forcing exit');
    }
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  try {
    // 1. Close HTTP server first (stop accepting new connections)
    if (httpServer) {
      await new Promise<void>((resolve) => {
        const serverCloseTimeout = setTimeout(() => {
          if (logger) logger.warn('HTTP server close timeout, forcing');
          resolve();
        }, 5000);

        httpServer.close((err: any) => {
          clearTimeout(serverCloseTimeout);
          if (err) {
            if (logger) logger.warn('Error closing HTTP server:', err);
          } else {
            if (logger) logger.info('HTTP server closed');
          }
          resolve();
        });
      });
    }

    // 2. Close ApiTokenUsageService
    if (apiTokenUsageService) {
      try {
        await apiTokenUsageService.shutdown();
      } catch (error) {
        if (logger) logger.warn('Error shutting down ApiTokenUsageService:', error);
      }
    }

    // 3. Close Queue service
    if (queueService) {
      try {
        await queueService.shutdown();
      } catch (error) {
        if (logger) logger.warn('Error shutting down Queue service:', error);
      }
    }

    // 4. Close PubSub service
    if (pubSubService) {
      try {
        await pubSubService.shutdown();
      } catch (error) {
        if (logger) logger.warn('Error shutting down PubSub service:', error);
      }
    }

    // 5. Unregister backend service from service discovery via SDK
    if (gatrixSdk && backendInstanceId) {
      try {
        await gatrixSdk.unregisterService();
        await gatrixSdk.close();
        if (logger) logger.info('Backend service unregistered from Service Discovery via SDK');
      } catch (error) {
        if (logger) logger.warn('Error unregistering backend service via SDK:', error);
      }
    }

    // 6. Close database connections
    if (database) {
      await database.close();
    }

    // 7. Close Redis connection
    if (redisClient) {
      try {
        await redisClient.disconnect();
      } catch (error) {
        if (logger) logger.warn('Error disconnecting Redis:', error);
      }
    }

    // 8. Stop lifecycle cleanup scheduler
    if (lifecycleCleanupScheduler) {
      try {
        lifecycleCleanupScheduler.stopLifecycleCleanupScheduler();
      } catch (error) {
        if (logger) logger.warn('Error stopping lifecycle cleanup scheduler:', error);
      }
    }

    // 9. Clear etcd cleanup interval
    if ((global as any).etcdCleanupInterval) {
      clearInterval((global as any).etcdCleanupInterval);
      if (logger) logger.info('etcd cleanup interval cleared');
    }

    clearTimeout(shutdownTimer);
    if (logger) {
      logger.info('Graceful shutdown completed');
    } else {
      console.log('Graceful shutdown completed');
    }
    process.exit(0);
  } catch (error) {
    clearTimeout(shutdownTimer);
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

    // Initialize Flag Streaming Service (SSE for SDK clients)
    try {
      const { flagStreamingService } = await import('./services/FlagStreamingService');
      await flagStreamingService.start();
      logger.info('Flag Streaming Service initialized');
    } catch (error) {
      logger.warn('Flag Streaming Service initialization failed, continuing:', error);
    }

    // Initialize Queue service
    try {
      await queueService.initialize();
      logger.info('Queue service initialized successfully');
    } catch (error) {
      logger.warn('Queue service initialization failed, continuing without queues:', error);
    }

    // Initialize ApiTokenUsageService (QueueService 초기화 뒤에 실행)
    try {
      await apiTokenUsageService.initialize();
      logger.info('ApiTokenUsageService initialized successfully');
    } catch (error) {
      logger.warn(
        'ApiTokenUsageService initialization failed, continuing without token usage tracking:',
        error
      );
    }

    // Initialize Impact Metrics Service
    try {
      const { impactMetricsService } = await import('./services/ImpactMetricsService');
      impactMetricsService.initialize();
      logger.info('Impact Metrics Service initialized');
    } catch (error) {
      logger.warn('Failed to initialize Impact Metrics Service:', error);
    }

    // Initialize system-defined KV items for all environments
    try {
      const { initializeAllSystemKV } = await import('./utils/systemKV');
      await initializeAllSystemKV();
      logger.info('System KV items initialized for all environments');
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

    // Initialize Service Discovery watch (for Redis keyspace notifications)
    try {
      const serviceDiscoveryMode = process.env.SERVICE_DISCOVERY_MODE || 'redis';
      const serviceDiscoveryService = (await import('./services/serviceDiscoveryService')).default;

      if (serviceDiscoveryMode === 'redis') {
        // Start watching for Redis keyspace notifications (TTL expiration)
        // This is required for automatic cleanup of expired services
        await serviceDiscoveryService.watchServices((event) => {
          logger.debug(
            `Service Discovery event: ${event.type} ${event.instance.labels.service}:${event.instance.instanceId}`
          );
        });
        logger.info('Redis Service Discovery watch initialized (keyspace notifications enabled)');
      } else if (serviceDiscoveryMode === 'etcd') {
        // Start watching for service changes (required for SSE updates)
        await serviceDiscoveryService.watchServices((event) => {
          logger.debug(
            `Service Discovery event: ${event.type} ${event.instance.labels.service}:${event.instance.instanceId}`
          );
        });
        logger.info('etcd Service Discovery watch initialized');

        // Start automatic monitoring with Leader Election
        // Only the elected leader will perform finding unresponsive services and cleanup
        await serviceDiscoveryService.startMonitoring();
        logger.info('etcd auto-cleanup initialized (with Leader Election)');
      }
    } catch (error) {
      logger.warn('Service Discovery initialization failed, continuing:', error);
    }

    // Register lifecycle event cleanup job (BullMQ-based)
    try {
      lifecycleCleanupScheduler = await import('./services/lifecycleCleanupScheduler');
      await lifecycleCleanupScheduler.initializeLifecycleCleanupJob();
      logger.info('Lifecycle event cleanup job registered');
    } catch (error) {
      logger.warn('Lifecycle cleanup job registration failed, continuing:', error);
    }

    // Start HTTP server (WebSocket? 梨꾪똿?쒕쾭?먯꽌 吏곸젒 泥섎━)
    const server = createServer(app);
    httpServer = server; // Store reference for graceful shutdown

    // Handle WebSocket upgrade for flag streaming
    server.on('upgrade', async (request, socket, head) => {
      try {
        const url = new URL(request.url || '', `http://${request.headers.host}`);
        const wsPathMatch = url.pathname.match(/^\/api\/v1\/client\/features\/([^/]+)\/stream\/ws$/);

        if (!wsPathMatch) {
          socket.destroy();
          return;
        }

        const environment = wsPathMatch[1];
        const apiToken = url.searchParams.get('x-api-token')
          || url.searchParams.get('apiToken')
          || url.searchParams.get('token');

        if (!apiToken) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        // Validate token
        const { ApiAccessToken } = await import('./models/ApiAccessToken');
        const tokenData = await ApiAccessToken.validateAndUse(apiToken);
        if (!tokenData) {
          // Check special tokens
          const isUnsecured = apiToken === 'gatrix-unsecured-client-api-token';
          if (!isUnsecured) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }
        }

        const { flagStreamingService } = await import('./services/FlagStreamingService');
        const wss = flagStreamingService.getWebSocketServer();
        if (!wss) {
          socket.destroy();
          return;
        }

        wss.handleUpgrade(request, socket, head, async (ws) => {
          const { ulid } = await import('ulid');
          const clientId = `flag-ws-${ulid()}`;
          await flagStreamingService.addWebSocketClient(clientId, environment, ws);
        });
      } catch (err) {
        logger.error('WebSocket upgrade error:', err);
        socket.destroy();
      }
    });

    server.listen(config.port, async () => {
      logger.info(
        `Server running on port ${config.port} in ${config.nodeEnv} mode`,
        appInstance.getLogInfo()
      );
      logger.info(`Health check available at http://127.0.0.1:${config.port}/health`);
      logger.info(`API available at http://127.0.0.1:${config.port}/api/v1`);
      logger.info(`Chat API proxy available at http://127.0.0.1:${config.port}/api/v1/chat`);
      logger.info(`Queue service ready: ${queueService.isReady()}`);
      logger.info(`PubSub service ready: ${pubSubService.isReady()}`);

      // Register Backend service to Service Discovery via SDK
      // Must be done AFTER server starts listening
      try {
        const { GatrixServerSDK } = await import('@gatrix/server-sdk');
        // Use APP_VERSION env var (set via Docker build-arg) or fallback to package.json
        let serverVersion = process.env.APP_VERSION || '0.0.0';
        if (serverVersion === '0.0.0') {
          try {
            const packageJson = await import('../package.json');
            serverVersion = packageJson.version || '0.0.0';
          } catch (err) {
            logger.warn('Failed to load package.json version, using default 0.0.0');
          }
        }

        const backendUrl = `http://localhost:${config.port}`;
        const apiToken = process.env.API_TOKEN || 'gatrix-unsecured-server-api-token';

        gatrixSdk = new GatrixServerSDK({
          gatrixUrl: backendUrl,
          apiToken: apiToken,
          applicationName: 'backend',
          service: 'backend',
          group: process.env.SERVICE_GROUP || 'gatrix',
          environment: process.env.ENVIRONMENT || 'gatrix-env',
          logger: { level: 'info' },
          cache: {
            enabled: false, // Backend doesn't need caching - it IS the data source
            skipBackendReady: true, // Backend must skip waiting for itself
          },
          // Disable all features since backend doesn't need cached data from itself
          features: {
            serviceNotice: false,
            banner: false,
          },
          // Enable metrics
          metrics: {
            enabled: true,
            serverEnabled: true,
            port: parseInt(process.env.METRICS_PORT || '9400', 10),
            userMetricsEnabled: true,
          },
        });

        await gatrixSdk.initialize();

        const result = await gatrixSdk.registerService({
          labels: {
            service: 'backend',
            group: process.env.SERVICE_GROUP || 'gatrix',
            appVersion: serverVersion,
          },
          ports: {
            internalApi: config.port,
            metricsApi: parseInt(process.env.METRICS_PORT || '9400', 10),
          },
          status: 'ready',
          meta: {
            instanceName: 'backend-1',
          },
        });

        backendInstanceId = result.instanceId;
        logger.info('Backend service registered to Service Discovery via SDK', {
          instanceId: backendInstanceId,
          version: serverVersion,
        });
      } catch (error) {
        logger.warn('Backend service registration failed, continuing', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
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
