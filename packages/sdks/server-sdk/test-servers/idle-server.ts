/**
 * Idle Test Server
 *
 * A simple server that only listens to SDK events in real-time
 * No business logic, just event monitoring
 */

import { GatrixServerSDK, getLogger, createMetricsServer } from '../src/index';

const logger = getLogger('IDLE-SERVER');

async function main() {
  logger.info('Starting Idle Server...');

  // Support command line argument for port: npx ts-node idle-server.ts 11001
  const portArg = process.argv[2];
  const metricsPort = portArg ? parseInt(portArg) : parseInt(process.env.METRICS_PORT || '9999');
  const instanceName = process.env.INSTANCE_NAME || `idle-${metricsPort}`;

  // Determine target environment from environment variable
  const targetEnvironment = process.env.ENVIRONMENT || 'development';

  // SDK will provide its Registry for HTTP metrics to merge into
  const sdk = new GatrixServerSDK({
    gatrixUrl: process.env.GATRIX_URL || 'http://localhost:55000',
    apiToken: process.env.API_TOKEN || 'gatrix-unsecured-server-api-token',
    applicationName: 'idle',
    service: 'idle', // Required: service name for identification
    group: process.env.SERVICE_GROUP || 'development', // Required: service group
    environment: targetEnvironment, // Required: environment
    // Use multi-environment mode with specific environment for proper environment-based API calls
    environments: [targetEnvironment],

    // Redis for events
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '56379'),
    },

    // Cache configuration
    cache: {
      enabled: true,
      ttl: 100,
      refreshMethod: 'event', // Use event-based refresh (requires Redis)
    },

    // Enable all features for testing
    features: {
      clientVersion: true,
      serviceNotice: true,
      banner: true,
      storeProduct: true,
    },

    // Logger configuration
    logger: {
      level: 'info',
      timeOffset: 9,
      timestampFormat: 'local',
    },

    // Metrics configuration
    metrics: {
      port: metricsPort, // Metrics server port
    },
  });

  // Create metrics server (standalone, consistent port)
  const metricsServer = createMetricsServer({
    port: metricsPort,
    applicationName: 'idle',
    service: 'idle',
    group: process.env.SERVICE_GROUP || 'development',
    environment: process.env.ENVIRONMENT || 'env_dev',
    logger,
  });

  // Shutdown handler for graceful shutdown via HTTP
  async function handleShutdown() {
    try {
      logger.info('Stopping metrics server...');
      await metricsServer.stop();
      logger.info('Unregistering service...');
      await sdk.serviceDiscovery.unregister();
      logger.info('Service unregistered');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  }

  try {
    logger.info('Initializing SDK...');
    await sdk.initialize();
    logger.info('SDK initialized successfully');

    // Start metrics server
    metricsServer.start();

    // Add shutdown endpoint to metrics server
    metricsServer.app.post('/shutdown', async (_req, res) => {
      logger.info('Received shutdown request via HTTP');
      res.json({ success: true, message: 'Shutting down...' });
      // Delay to allow response to be sent
      setTimeout(() => handleShutdown(), 100);
    });

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
        internalApi: metricsPort,
        externalApi: metricsPort,
      },
      status: 'ready',
      meta: {
        instanceName,
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

      console.log(JSON.stringify(sdk.getActivePopupNotices(), null, 2));
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

    sdk.on('maintenance.settings.updated', (event) => {
      logger.info('MAINTENANCE SETTINGS UPDATED', event.data);
      printCachedData();
    });

    sdk.on('maintenance.started', (event) => {
      logger.info('MAINTENANCE STARTED', event.data);
      printCachedData();
    });

    sdk.on('maintenance.ended', (event) => {
      logger.info('MAINTENANCE ENDED', event.data);
      printCachedData();
    });

    sdk.on('banner.updated', (event) => {
      logger.info('BANNER UPDATED', event.data);
      printCachedData();
    });

    sdk.on('client_version.updated', (event) => {
      logger.info('CLIENT VERSION UPDATED', event.data);
      printCachedData();
    });

    sdk.on('service_notice.updated', (event) => {
      logger.info('SERVICE NOTICE UPDATED', event.data);
      printCachedData();
    });

    sdk.on('store_product.updated', (event) => {
      logger.info('STORE PRODUCT UPDATED', event.data);
      printCachedData();
    });

    sdk.on('environment.created', (event) => {
      logger.info('ENVIRONMENT CREATED', event.data);
      printCachedData();
    });

    sdk.on('environment.deleted', (event) => {
      logger.info('ENVIRONMENT DELETED', event.data);
      printCachedData();
    });

    // Helper function to print cached data
    function printCachedData() {
      const surveysData = sdk.getSurveys();
      const cachedData = {
        gameWorlds: sdk.getGameWorlds(),
        popupNotices: sdk.getPopupNotices(),
        surveys: surveysData,
        whitelists: sdk.whitelist.getCached(),
        maintenance: sdk.getServiceMaintenanceStatus(),
        banners: sdk.getBanners(),
        clientVersions: sdk.getClientVersions(),
        serviceNotices: sdk.getServiceNotices(),
        storeProducts: sdk.getStoreProducts(),
        timestamp: new Date().toISOString(),
      };

      logger.info('CACHED DATA', JSON.stringify(cachedData, null, 2));
    }

    logger.info('Idle server is running and listening to events...');
    logger.info('Press Ctrl+C to stop or POST to /shutdown endpoint');

    // Handle graceful shutdown via signals
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await handleShutdown();
    });

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await handleShutdown();
    });
  } catch (error) {
    logger.error('Fatal error', { error });
    process.exit(1);
  }
}

main();

