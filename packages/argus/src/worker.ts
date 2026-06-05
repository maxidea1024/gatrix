import { ErrorWorker } from './workers/error-worker';
import { TransactionWorker } from './workers/transaction-worker';
import { SessionWorker } from './workers/session-worker';
import { FeedbackWorker } from './workers/feedback-worker';
import { MetricWorker } from './workers/metric-worker';
import { UptimeWorker } from './workers/uptime-worker';
import { CronSupervisorWorker } from './workers/cron-supervisor-worker';
import { testClickHouseConnection } from './config/clickhouse';
import { testMySQLConnection } from './config/mysql';
import { createLogger } from './utils/logger';
import { alertRuleStore } from './utils/alert-rule-store';
import { dsnStore } from './utils/dsn-store';

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

    // Initialize in-memory stores (must complete before workers start)
    logger.info('Initializing in-memory stores...');
    await alertRuleStore.init();
    await dsnStore.init();

    // Start all workers
    const errorWorker = new ErrorWorker();
    const transactionWorker = new TransactionWorker();
    const sessionWorker = new SessionWorker();
    const feedbackWorker = new FeedbackWorker();
    const metricWorker = new MetricWorker();
    const uptimeWorker = new UptimeWorker();
    const cronSupervisorWorker = new CronSupervisorWorker();

    await errorWorker.start();
    await transactionWorker.start();
    await sessionWorker.start();
    await feedbackWorker.start();
    await metricWorker.start();
    await uptimeWorker.start();
    await cronSupervisorWorker.start();

    logger.info('All workers started successfully', {
      workers: ['error', 'transaction', 'session', 'feedback', 'metric', 'uptime', 'cron'],
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down workers...`);

      try {
        await Promise.all([
          errorWorker.close(),
          transactionWorker.close(),
          sessionWorker.close(),
          feedbackWorker.close(),
          metricWorker.close(),
          uptimeWorker.close(),
          cronSupervisorWorker.close(),
        ]);

        // Close stores after workers
        await alertRuleStore.close();
        await dsnStore.close();

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
