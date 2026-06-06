import { createApp } from './app';
import { config } from './config';
import { optic } from '@gatrix/argus-optic';
import { testMySQLConnection } from './config/mysql';
import { ensureStorageBucket } from './config/minio';
import { createLogger } from './utils/logger';
import { dsnStore } from './utils/dsn-store';

const logger = createLogger('api');

async function start() {
  try {
    logger.info('Starting Argus API Server...');

    // Initialize ClickHouse database
    logger.info('Initializing ClickHouse database...');
    await optic.initDatabase();

    // Test database connections
    logger.info('Testing database connections...');

    const clickhouseOk = await optic.testConnection();
    if (!clickhouseOk) {
      throw new Error('ClickHouse connection failed');
    }

    const mysqlOk = await testMySQLConnection();
    if (!mysqlOk) {
      throw new Error('MySQL connection failed');
    }

    // Ensure MinIO bucket exists
    await ensureStorageBucket();

    // Initialize in-memory stores (must be ready before routes handle requests)
    logger.info('Initializing in-memory stores...');
    await dsnStore.init();

    // Create Fastify app
    const app = await createApp();

    // Start server
    await app.listen({
      port: config.port,
      host: '0.0.0.0',
    });

    logger.info(`Argus API Server running on port ${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      try {
        await app.close();
        await dsnStore.close();
        logger.info('Server closed');
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
    logger.error('Failed to start API server', { error: errorMessage });
    process.exit(1);
  }
}

start();
