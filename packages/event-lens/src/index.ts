import { createApp } from './app';
import { config } from './config';
import { testClickHouseConnection, initClickHouseDatabase } from './config/clickhouse';
import { testMySQLConnection } from './config/mysql';
import logger from './utils/logger';
import { GatrixServerSDK } from '@gatrix/server-sdk';

// SDK instance for service discovery
let gatrixSdk: GatrixServerSDK | null = null;

async function start() {
  try {
    logger.info('🚀 Starting Event Lens Server...');

    // ClickHouse 데이터베이스 초기화 (먼저 실행)
    logger.info('Initializing ClickHouse database...');
    await initClickHouseDatabase();

    // 데이터베이스 연결 테스트
    logger.info('Testing database connections...');

    const clickhouseOk = await testClickHouseConnection();
    if (!clickhouseOk) {
      throw new Error('ClickHouse connection failed');
    }

    const mysqlOk = await testMySQLConnection();
    if (!mysqlOk) {
      throw new Error('MySQL connection failed');
    }

    // Fastify 앱 생성
    const app = await createApp();

    // 서버 시작
    await app.listen({
      port: config.port,
      host: '0.0.0.0',
    });

    logger.info(`✅ Event Lens Server running on port ${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Log Level: ${config.logLevel}`);

    // Register Event-Lens service to Service Discovery via SDK
    try {
      // Use APP_VERSION env var (set via Docker build-arg) or fallback to package.json
      let serverVersion = process.env.APP_VERSION || '0.0.0';
      if (serverVersion === '0.0.0') {
        try {
          const packageJson = require('../package.json');
          serverVersion = packageJson.version || '0.0.0';
        } catch (err) {
          logger.warn('Failed to load package.json version, using default 0.0.0');
        }
      }
      const backendUrl = process.env.GATRIX_URL || 'http://localhost:55000';
      const apiToken = process.env.API_TOKEN || 'gatrix-unsecured-server-api-token';

      gatrixSdk = new GatrixServerSDK({
        gatrixUrl: backendUrl,
        apiToken: apiToken,
        applicationName: 'event-lens',
        service: 'event-lens',
        group: process.env.SERVICE_GROUP || 'gatrix',
        environment: process.env.ENVIRONMENT || 'gatrix-env',
        logger: { level: 'info' },
        cache: {
          enabled: false, // Disable cache - not needed for service discovery only
          skipBackendReady: true, // Don't wait for backend - event-lens may start before backend
        },
        features: {
          gameWorld: false,
          popupNotice: false,
          survey: false,
          whitelist: false,
          serviceMaintenance: false,
          clientVersion: false,
          serviceNotice: false,
          banner: false,
        },
        metrics: {
          enabled: true,
          serverEnabled: true,
          port: parseInt(process.env.METRICS_PORT || '9400', 10),
          userMetricsEnabled: true,
        },
      });

      await gatrixSdk.initialize();

      // Manually register service
      const result = await gatrixSdk.registerService({
        labels: {
          service: 'event-lens',
          group: process.env.SERVICE_GROUP || 'gatrix',
          appVersion: serverVersion,
        },
        ports: {
          internalApi: config.port,
          metricsApi: parseInt(process.env.METRICS_PORT || '9400', 10),
        },
        status: 'ready',
        meta: {
          instanceName: 'event-lens-1',
        },
      });

      logger.info('Event-Lens service registered to Service Discovery via SDK', {
        instanceId: result.instanceId,
        version: serverVersion,
      });
    } catch (error: any) {
      logger.warn('Event-Lens service registration failed, continuing', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      try {
        // Unregister from Service Discovery via SDK
        if (gatrixSdk) {
          try {
            await gatrixSdk.unregisterService();
            logger.info('Event-Lens service unregistered from Service Discovery');
          } catch (error) {
            logger.warn('Error unregistering Event-Lens service:', error);
          }
        }

        await app.close();
        logger.info('✅ Server closed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to start server', { error: errorMessage });
    process.exit(1);
  }
}

start();
