import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { config } from './config';
import logger from './config/logger';
import { WebSocketService } from './services/WebSocketService';
import { metricsService } from './services/MetricsService';
import { gatrixApiService } from './services/GatrixApiService';
import { userSyncService } from './services/UserSyncService';
import { redisManager } from './config/redis';
import { databaseManager } from './config/database';
import apiRoutes from './routes';

class ChatServerApp {
  private app: express.Application;
  private server: http.Server;
  private webSocketService: WebSocketService | null = null;

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", "ws:", "wss:"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // CORS
    this.app.use(cors({
      origin: config.cors.origin,
      credentials: config.cors.credentials,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(cookieParser());

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
      });
      next();
    });

    // Health check middleware
    this.app.use('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid,
        serverId: process.env.SERVER_ID || 'unknown',
        connections: this.webSocketService?.getConnectedUsersCount() || 0,
      });
    });

    // Readiness check
    this.app.use('/ready', async (req, res) => {
      try {
        // Check Redis connection
        const redisClient = redisManager.getClient();
        await redisClient.ping();

        // Check database connection
        const isDbConnected = await databaseManager.testConnection();

        if (!isDbConnected) {
          throw new Error('Database not ready');
        }

        res.json({
          status: 'ready',
          timestamp: new Date().toISOString(),
          checks: {
            redis: 'ok',
            database: 'ok',
            websocket: this.webSocketService ? 'ok' : 'not_initialized',
          },
        });
      } catch (error) {
        logger.error('Readiness check failed:', error);
        res.status(503).json({
          status: 'not_ready',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  private setupRoutes(): void {
    // API routes
    this.app.use('/api/v1', apiRoutes);

    // WebSocket info endpoint
    this.app.get('/ws/info', (req, res) => {
      res.json({
        serverId: process.env.SERVER_ID || 'unknown',
        connections: this.webSocketService?.getConnectedUsersCount() || 0,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`,
        timestamp: new Date().toISOString(),
      });
    });
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', error);

      if (res.headersSent) {
        return next(error);
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: config.isDevelopment ? error.message : 'Something went wrong',
        timestamp: new Date().toISOString(),
      });
    });

    // Uncaught exception handler
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      this.gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Unhandled promise rejection handler
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.gracefulShutdown('UNHANDLED_REJECTION');
    });

    // Graceful shutdown signals
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
  }

  public async initialize(): Promise<void> {
    try {
      // Initialize Redis
      await redisManager.initialize();
      logger.info('Redis connection established');

      // Initialize Database
      await databaseManager.initialize();
      logger.info('Database connection established');

      // Test Gatrix API connection
      const gatrixConnected = await gatrixApiService.testConnection();
      if (gatrixConnected) {
        logger.info('Gatrix API connection established');

        // Register chat server with Gatrix
        const registered = await gatrixApiService.registerChatServer();
        if (registered) {
          logger.info('Chat server registered with Gatrix');
        } else {
          logger.warn('Failed to register chat server with Gatrix');
        }
      } else {
        logger.warn('Gatrix API connection failed, continuing without integration');
      }

      // Start user synchronization service
      userSyncService.start();
      logger.info('User synchronization service started');

      // Initialize WebSocket service
      this.webSocketService = new WebSocketService(this.server);
      logger.info('WebSocket service initialized');

      // Start metrics service
      if (config.monitoring.enabled) {
        metricsService.start();
        logger.info('Metrics service started');
      }

      logger.info('Chat server initialization completed');
    } catch (error) {
      logger.error('Failed to initialize chat server:', error);
      throw error;
    }
  }

  public async start(): Promise<void> {
    try {
      await this.initialize();

      this.server.listen(config.port, config.host, () => {
        logger.info(`Chat server running on ${config.host}:${config.port}`, {
          environment: config.nodeEnv,
          serverId: process.env.SERVER_ID || 'unknown',
          pid: process.pid,
          timestamp: new Date().toISOString(),
        });

        if (config.monitoring.enabled) {
          logger.info(`Metrics available at http://${config.host}:${config.monitoring.metricsPort}/metrics`);
        }
      });

      // Handle server errors
      this.server.on('error', (error: any) => {
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
      logger.error('Failed to start chat server:', error);
      process.exit(1);
    }
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    try {
      // Stop accepting new connections
      this.server.close(() => {
        logger.info('HTTP server closed');
      });

      // Unregister chat server from Gatrix
      try {
        await gatrixApiService.unregisterChatServer();
        logger.info('Chat server unregistered from Gatrix');
      } catch (error) {
        logger.warn('Failed to unregister chat server from Gatrix:', error);
      }

      // Stop user synchronization service
      userSyncService.stop();
      logger.info('User synchronization service stopped');

      // Shutdown WebSocket service
      if (this.webSocketService) {
        await this.webSocketService.shutdown();
        logger.info('WebSocket service shutdown completed');
      }

      // Stop metrics service
      if (config.monitoring.enabled) {
        await metricsService.stop();
        logger.info('Metrics service stopped');
      }

      // Close database connections
      await databaseManager.close();
      logger.info('Database connections closed');

      // Close Redis connections
      await redisManager.disconnect();
      logger.info('Redis connections closed');

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  public getApp(): express.Application {
    return this.app;
  }

  public getServer(): http.Server {
    return this.server;
  }

  public getWebSocketService(): WebSocketService | null {
    return this.webSocketService;
  }
}

export default ChatServerApp;
