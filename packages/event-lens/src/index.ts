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

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);
      
      try {
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
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

start();

