import { createApp } from './app';
import { config } from './config';
import { testClickHouseConnection, initClickHouseDatabase } from './config/clickhouse';
import { testMySQLConnection } from './config/mysql';
import logger from './utils/logger';

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

    // Register Event-Lens service to Service Discovery
    let eventLensInstanceId: string | null = null;
    try {
      const os = await import('os');
      const { ulid } = await import('ulid');

      // Get primary IP address (first non-loopback IPv4)
      const interfaces = os.networkInterfaces();
      let internalIp = 'localhost';
      for (const name of Object.keys(interfaces)) {
        const iface = interfaces[name];
        if (iface) {
          for (const addr of iface) {
            if (addr.family === 'IPv4' && !addr.internal) {
              internalIp = addr.address;
              break;
            }
          }
          if (internalIp !== 'localhost') break;
        }
      }

      // Import axios for HTTP request
      const axios = await import('axios');
      const backendUrl = process.env.GATRIX_URL || 'http://localhost:55000';
      const apiToken = process.env.API_TOKEN || 'gatrix-unsecured-server-api-token';

      eventLensInstanceId = ulid();
      const eventLensInstance = {
        instanceId: eventLensInstanceId,
        labels: {
          service: 'event-lens',
          group: 'development',
        },
        hostname: os.hostname(),
        internalAddress: internalIp,
        ports: {
          http: [config.port],
        },
        status: 'ready' as const,
        meta: {
          instanceName: 'event-lens-1',
          startTime: new Date().toISOString(),
        },
      };

      try {
        await axios.default.post(
          `${backendUrl}/api/v1/server/services/register`,
          eventLensInstance,
          {
            headers: {
              'X-API-Token': apiToken,
              'X-Application-Name': 'event-lens',
            },
          }
        );
        logger.info('Event-Lens service registered to Service Discovery', { instanceId: eventLensInstanceId });
      } catch (regError: any) {
        const regErrorMsg = regError?.response?.status ? `HTTP ${regError.response.status}` : (regError instanceof Error ? regError.message : 'Unknown error');
        logger.warn('Event-Lens service registration failed:', regErrorMsg);
      }

      // Start heartbeat to keep service alive
      const heartbeatInterval = setInterval(async () => {
        try {
          await axios.default.post(
            `${backendUrl}/api/v1/server/services/status`,
            {
              instanceId: eventLensInstanceId,
              labels: {
                service: 'event-lens',
                group: 'development',
              },
              status: 'ready',
            },
            {
              headers: {
                'X-API-Token': apiToken,
                'X-Application-Name': 'event-lens',
              },
            }
          );
        } catch (error: any) {
          const hbErrorMsg = error?.response?.status ? `HTTP ${error.response.status}` : (error instanceof Error ? error.message : 'Unknown error');
          logger.warn('Event-Lens heartbeat failed:', hbErrorMsg);
        }
      }, 10000); // Send heartbeat every 10 seconds

      // Store interval for graceful shutdown
      (global as any).eventLensHeartbeatInterval = heartbeatInterval;
    } catch (error: any) {
      logger.warn('Event-Lens service registration failed, continuing:', error instanceof Error ? error.message : String(error));
    }

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      try {
        // Clear heartbeat interval
        if ((global as any).eventLensHeartbeatInterval) {
          clearInterval((global as any).eventLensHeartbeatInterval);
          logger.info('Event-Lens heartbeat interval cleared');
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

