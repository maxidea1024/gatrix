import { EventWorker } from './workers/event-worker';
import { ProfileWorker } from './workers/profile-worker';
import { SessionWorker } from './workers/session-worker';
import { testClickHouseConnection } from './config/clickhouse';
import { testMySQLConnection } from './config/mysql';
import logger from './utils/logger';

async function start() {
  try {
    logger.info('🚀 Starting Event Lens Workers...');

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

    // Workers 시작
    const eventWorker = new EventWorker();
    const profileWorker = new ProfileWorker();
    const sessionWorker = new SessionWorker();

    logger.info('✅ All workers started successfully');

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down workers...`);
      
      try {
        await eventWorker.close();
        await profileWorker.close();
        await sessionWorker.close();
        
        logger.info('✅ All workers closed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error: any) {
    logger.error('Failed to start workers', { error: error.message });
    process.exit(1);
  }
}

start();

