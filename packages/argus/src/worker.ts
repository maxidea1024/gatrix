import { ErrorWorker } from './workers/error-worker';
import { testClickHouseConnection } from './config/clickhouse';
import { testMySQLConnection } from './config/mysql';
import { createLogger } from './utils/logger';

const logger = createLogger('worker');

async function start() {
  try {
    logger.info('Starting Argus Workers...');

    // Test database connections
    logger.info('Testing database connections...');

    const clickhouseOk = await testClickHouseConnection();
    if (!clickhouseOk) {
      throw new Error('ClickHouse connection failed');
    }

    const mysqlOk = await testMySQLConnection();
    if (!mysqlOk) {
      throw new Error('MySQL connection failed');
    }

    // Start workers
    const errorWorker = new ErrorWorker();
    await errorWorker.start();

    logger.info('All workers started successfully');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down workers...`);

      try {
        await errorWorker.close();

        logger.info('All workers closed');
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
