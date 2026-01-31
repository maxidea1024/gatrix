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
  // Use '*' for wildcard mode (all environments) or specific environment
  const environments = process.env.ENVIRONMENTS || '*';

  // SDK will provide its Registry for HTTP metrics to merge into
  const sdk = new GatrixServerSDK({
    gatrixUrl: process.env.GATRIX_URL || 'http://localhost:45000',
    apiToken: process.env.API_TOKEN || 'gatrix-unsecured-server-api-token',
    applicationName: 'idle',
    service: 'idle', // Required: service name for identification
    group: process.env.SERVICE_GROUP || 'development', // Required: service group
    environment: targetEnvironment, // Required: environment (for metrics/service discovery)
    // Use multi-environment mode: '*' for all environments, or array for specific ones
    environments: environments === '*' ? '*' : environments.split(','),

    // Redis for events
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '46379'),
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
      featureFlag: true,  // Enable feature flags
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

    // Add flush-metrics endpoint for testing
    metricsServer.app.post('/flush-metrics', async (_req, res) => {
      logger.info('Received flush metrics request via HTTP');
      try {
        sdk.featureFlag.stopMetricsCollection(); // This will flush remaining metrics
        sdk.featureFlag.startMetricsCollection(); // Restart collection
        res.json({ success: true, message: 'Metrics flushed' });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Add test-evaluate endpoint for testing
    metricsServer.app.post('/test-evaluate', async (_req, res) => {
      logger.info('Received test evaluate request via HTTP');
      const results: any[] = [];
      const flags = sdk.featureFlag.getCached(targetEnvironment);
      for (const flag of flags) {
        // Use 100 random users per flag for better statistical distribution
        for (let i = 0; i < 100; i++) {
          const userId = `user-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          const result = sdk.featureFlag.evaluate(flag.name, { userId }, targetEnvironment);
          results.push({ flag: flag.name, enabled: result.enabled, variant: result.variant?.name });
        }
      }
      res.json({ success: true, evaluations: results.length });
    });

    // Register service
    logger.info('Registering service...');

    const serviceGroup = process.env.SERVICE_GROUP || 'development';
    const serviceRegion = process.env.SERVICE_REGION || 'default';

    const { instanceId, hostname, internalAddress, externalAddress } = await sdk.registerService({
      labels: {
        service: 'idle',
        group: serviceGroup,
        region: serviceRegion,
        env: targetEnvironment,
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

    // Auto-evaluate feature flags periodically to generate metrics
    const AUTO_EVAL_INTERVAL = 10000; // 10 seconds
    const autoEvalInterval = setInterval(() => {
      const flags = sdk.featureFlag.getCached(targetEnvironment);
      let evalCount = 0;
      for (const flag of flags) {
        // Evaluate each flag with a random user
        const userId = `auto-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        sdk.featureFlag.evaluate(flag.name, { userId }, targetEnvironment);
        evalCount++;
      }
      logger.debug('Auto-evaluated feature flags', { count: evalCount, environment: targetEnvironment });
    }, AUTO_EVAL_INTERVAL);

    // Clean up interval on shutdown
    const originalShutdown = handleShutdown;
    const handleShutdownWithCleanup = async () => {
      clearInterval(autoEvalInterval);
      await originalShutdown();
    };
    metricsServer.app.post('/shutdown', async (_req, res) => {
      res.json({ success: true, message: 'Shutting down...' });
      await handleShutdownWithCleanup();
    });

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

    // Feature Flag Events
    sdk.on('feature_flag.updated', (event) => {
      logger.info('FEATURE FLAG UPDATED', event.data);
      printFeatureFlags();
      testFeatureFlagEvaluation();
    });

    sdk.on('feature_flag.created', (event) => {
      logger.info('FEATURE FLAG CREATED', event.data);
      printFeatureFlags();
    });

    sdk.on('feature_flag.deleted', (event) => {
      logger.info('FEATURE FLAG DELETED', event.data);
      printFeatureFlags();
    });

    // Feature flag test function
    function testFeatureFlagEvaluation() {
      logger.info('=== Feature Flag Evaluation Test ===');
      const flags = sdk.featureFlag.getCached(targetEnvironment);

      if (flags.length === 0) {
        logger.info('No feature flags available for testing');
        return;
      }

      const testContexts = [
        { userId: 'user-001', sessionId: 'session-001' },
        { userId: 'user-002', sessionId: 'session-002' },
        { userId: 'admin-001', role: 'admin' },
        { userId: 'premium-user', plan: 'premium' },
      ];

      for (const flag of flags.slice(0, 3)) {
        logger.info(`Testing flag: ${flag.name}`);
        for (const ctx of testContexts) {
          const result = sdk.featureFlag.evaluate(flag.name, ctx, targetEnvironment);
          logger.info(`  ${ctx.userId} => enabled=${result.enabled}, reason=${result.reason}${result.variant ? ', variant=' + result.variant.name : ''}`);
        }

        // Test stickiness: same user should get same result
        const stickyCtx = { userId: 'sticky-test-user' };
        const results = [];
        for (let i = 0; i < 5; i++) {
          results.push(sdk.featureFlag.evaluate(flag.name, stickyCtx, targetEnvironment).enabled);
        }
        const allSame = results.every(r => r === results[0]);
        logger.info(`  Stickiness test: ${allSame ? 'PASS' : 'FAIL'} [${results.join(', ')}]`);
      }
    }

    // Print feature flags helper
    function printFeatureFlags() {
      const flags = sdk.featureFlag.getCached(targetEnvironment);
      logger.info('FEATURE FLAGS:', {
        count: flags.length,
        flags: flags.map(f => ({
          name: f.name,
          isEnabled: f.isEnabled,
          strategies: f.strategies.length,
          variants: f.variants?.length || 0,
        })),
      });
    }

    // Helper function to print cached data
    // In multi-environment mode, use targetEnvironment for environment-specific data
    function printCachedData() {
      const featureFlags = sdk.featureFlag.getCached(targetEnvironment);
      const cachedData = {
        gameWorlds: sdk.getGameWorlds(targetEnvironment),
        popupNotices: sdk.getPopupNotices(targetEnvironment),
        surveys: sdk.getSurveys(targetEnvironment),
        whitelists: sdk.whitelist.getAllCached(),
        maintenance: sdk.getServiceMaintenanceStatus(targetEnvironment),
        banners: sdk.getBanners(targetEnvironment),
        clientVersions: sdk.getClientVersions(targetEnvironment),
        serviceNotices: sdk.getServiceNotices(targetEnvironment),
        storeProducts: sdk.getStoreProducts(targetEnvironment),
        featureFlags: featureFlags.length,
        timestamp: new Date().toISOString(),
      };

      logger.info('CACHED DATA', JSON.stringify(cachedData, null, 2));
    }

    // Print initial cached data
    logger.info('Initial cached data:');
    printCachedData();
    printFeatureFlags();
    testFeatureFlagEvaluation();

    // Continuous metrics generation for testing
    let continuousEvalEnabled = true;
    const EVAL_INTERVAL_MS = 10000; // Evaluate every 10 seconds
    const FLUSH_INTERVAL_MS = 60000; // Flush every 60 seconds

    async function continuousEvaluation() {
      while (continuousEvalEnabled) {
        const flags = sdk.featureFlag.getCached(targetEnvironment);
        let evalCount = 0;

        for (const flag of flags) {
          // Simulate multiple users evaluating each flag
          const userCount = Math.floor(Math.random() * 20) + 5; // 5-25 users
          for (let i = 0; i < userCount; i++) {
            const userId = `user-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            sdk.featureFlag.evaluate(flag.name, { userId }, targetEnvironment);
            evalCount++;
          }
        }

        logger.info(`Continuous evaluation: ${evalCount} evaluations for ${flags.length} flags`);
        await new Promise(resolve => setTimeout(resolve, EVAL_INTERVAL_MS));
      }
    }

    // Start continuous evaluation in background
    continuousEvaluation();

    // Periodic metrics flush
    setInterval(() => {
      logger.info('Periodic metrics flush...');
      sdk.featureFlag.stopMetricsCollection();
      sdk.featureFlag.startMetricsCollection();
    }, FLUSH_INTERVAL_MS);

    logger.info('Idle server is running with continuous metrics generation...');
    logger.info(`Evaluating every ${EVAL_INTERVAL_MS / 1000}s, flushing every ${FLUSH_INTERVAL_MS / 1000}s`);
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

