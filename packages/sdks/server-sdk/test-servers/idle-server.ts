/**
 * Idle Test Server
 *
 * A simple server that only listens to SDK events in real-time
 * No business logic, just event monitoring
 */

import { GatrixServerSDK, getLogger } from '../src/index';
import os from 'os';

const logger = getLogger('IDLE-SERVER');

async function main() {
  logger.info('Starting Idle Server...');

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

    // Register service
    logger.info('Registering service...');
    const internalIp = Object.values(os.networkInterfaces())
      .flat()
      .find(addr => addr?.family === 'IPv4' && !addr.internal)?.address || 'localhost';

    const { instanceId, hostname, internalAddress, externalAddress } = await sdk.registerService({
      labels: {
        service: 'idle',
        group: 'development',
      },
      hostname: os.hostname(),
      internalAddress: internalIp,
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

    // Helper function to print cached data
    function printCachedData() {
      const surveysData = sdk.getCachedSurveys();
      const cachedData = {
        gameWorlds: sdk.getCachedGameWorlds(),
        popupNotices: sdk.getCachedPopupNotices(),
        surveys: surveysData,
        timestamp: new Date().toISOString(),
      };

      logger.info('CACHED DATA', cachedData);
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

