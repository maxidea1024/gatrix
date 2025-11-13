/**
 * Idle Test Server
 *
 * A simple server that only listens to SDK events in real-time
 * No business logic, just event monitoring
 */

import { GatrixServerSDK, getLogger, attachExpressMetrics } from '../src/index';
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';

const logger = getLogger('IDLE-SERVER');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}


// Helper function to write full JSON to file
function writeFullCachedData(data: any): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(logsDir, `cached-data-${timestamp}.json`);
  fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf-8');
  logger.info(`Full cached data written to: ${filename}`);
}

async function main() {
  logger.info('Starting Idle Server...');

  // Initialize Express app for metrics
  const app = express();
  const metricsPort = parseInt(process.env.METRICS_PORT || '9999');

  // SDK will provide its Registry for HTTP metrics to merge into
  const sdk = new GatrixServerSDK({
    gatrixUrl: process.env.GATRIX_URL || 'http://localhost:55000',
    apiToken: process.env.API_TOKEN || 'gatrix-unsecured-server-api-token',
    applicationName: 'idle',

    // Redis for events
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },

    // Cache configuration
    cache: {
      enabled: true,
      ttl: 300,
      refreshMethod: 'event', // Use event-based refresh (requires Redis)
    },

    // Logger configuration
    logger: {
      level: 'info',
      timeOffset: 9,
      timestampFormat: 'local',
    },
  });

  try {
    logger.info('Initializing SDK...');
    await sdk.initialize();
    logger.info('SDK initialized successfully');

    // Attach HTTP metrics and start server
    attachExpressMetrics(app, { enabled: true, metricsPath: '/metrics', registry: sdk.getMetricsRegistry?.() });
    app.listen(metricsPort, () => {
      logger.info(`Metrics server listening on port ${metricsPort}`);
    });

    // Write initial cached data to file
    const surveysData = sdk.getCachedSurveys();
    const initialCachedData = {
      gameWorlds: sdk.getCachedGameWorlds(),
      popupNotices: sdk.getCachedPopupNotices(),
      surveys: surveysData,
      whitelists: sdk.whitelist.getCached(),
      timestamp: new Date().toISOString(),
    };
    writeFullCachedData(initialCachedData);

    // Register service
    logger.info('Registering service...');

    const { instanceId, hostname, internalAddress, externalAddress } = await sdk.registerService({
      labels: {
        service: 'idle',
        group: 'development',
      },
      // hostname: os.hostname(),
      // internalAddress: internalIp,
      ports: {
        http: [9999],
      },
      status: 'ready',
      meta: {
        instanceName: 'idle-1',
        startTime: new Date().toISOString(),
      },
    });
    logger.info('Service registered with ID', { instanceId, hostname, internalAddress, externalAddress });

    // Listen to SDK events
    logger.info('Setting up event listeners...');

    // Listen to all events
    sdk.on('*', (event) => {
      logger.info('EVENT received', {
        type: event.type,
        timestamp: new Date().toISOString(),
        data: event.data,
      });
    });

    // Listen to specific events
    sdk.on('gameworld.created', (event) => {
      logger.info('GAMEWORLD CREATED', event.data);
      printCachedData();
    });

    sdk.on('gameworld.updated', (event) => {
      logger.info('GAMEWORLD UPDATED', event.data);
      printCachedData();
    });

    sdk.on('gameworld.deleted', (event) => {
      logger.info('GAMEWORLD DELETED', event.data);
      printCachedData();
    });

    sdk.on('gameworld.order_changed', (event) => {
      logger.info('GAMEWORLD ORDER CHANGED', event.data);
      printCachedData();
    });

    sdk.on('popup.created', (event) => {
      logger.info('POPUP CREATED', event.data);
      printCachedData();
    });

    sdk.on('popup.updated', (event) => {
      logger.info('POPUP UPDATED', event.data);
      printCachedData();
    });

    sdk.on('popup.deleted', (event) => {
      logger.info('POPUP DELETED', event.data);
      printCachedData();
    });

    sdk.on('survey.created', (event) => {
      logger.info('SURVEY CREATED', event.data);
      printCachedData();
    });

    sdk.on('survey.updated', (event) => {
      logger.info('SURVEY UPDATED', event.data);
      printCachedData();
    });

    sdk.on('survey.deleted', (event) => {
      logger.info('SURVEY DELETED', event.data);
      printCachedData();
    });

    sdk.on('survey.settings.updated', (event) => {
      logger.info('SURVEY SETTINGS UPDATED', event.data);
      printCachedData();
    });

    sdk.on('whitelist.updated', (event) => {
      logger.info('WHITELIST UPDATED', event.data);
      printCachedData();
    });

    // Helper function to print cached data
    function printCachedData() {
      const surveysData = sdk.getCachedSurveys();
      const cachedData = {
        gameWorlds: sdk.getCachedGameWorlds(),
        popupNotices: sdk.getCachedPopupNotices(),
        surveys: surveysData,
        whitelists: sdk.whitelist.getCached(),
        timestamp: new Date().toISOString(),
      };

      logger.info('CACHED DATA', JSON.stringify(cachedData, null, 2));
      writeFullCachedData(cachedData);
    }

    logger.info('Idle server is running and listening to events...');
    logger.info('Press Ctrl+C to stop');

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await handleShutdown();
    });

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await handleShutdown();
    });

    async function handleShutdown() {
      try {
        logger.info('Unregistering service...');
        await sdk.serviceDiscovery.unregister();
        logger.info('Service unregistered');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    }
  } catch (error) {
    logger.error('Fatal error', { error });
    process.exit(1);
  }
}

main();

