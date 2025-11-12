/**
 * Idle Test Server
 *
 * A simple server that only listens to SDK events in real-time
 * No business logic, just event monitoring
 */

import { GatrixServerSDK } from '../src/GatrixServerSDK';
import os from 'os';

async function main() {
  console.log('[idle-server] Starting Idle Server...');

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
    console.log('[idle-server] Initializing SDK...');
    await sdk.initialize();
    console.log('[idle-server] SDK initialized successfully');

    // Register service
    console.log('[idle-server] Registering service...');
    const internalIp = Object.values(os.networkInterfaces())
      .flat()
      .find(addr => addr?.family === 'IPv4' && !addr.internal)?.address || 'localhost';

    const { instanceId, externalAddress } = await sdk.registerService({
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
    console.log(`[idle-server] Service registered with ID: ${instanceId}`);
    console.log(`[idle-server] External address: ${externalAddress}`);

    // Listen to SDK events
    console.log('[idle-server] Setting up event listeners...');

    // Listen to all events
    sdk.on('*', (event) => {
      console.log('[idle-server] EVENT received:', {
        type: event.type,
        timestamp: new Date().toISOString(),
        data: event.data,
      });
    });

    // Listen to specific events
    sdk.on('gameworld.created', (event) => {
      console.log('[idle-server] GAMEWORLD CREATED:', event.data);
      printCachedData();
    });

    sdk.on('gameworld.updated', (event) => {
      console.log('[idle-server] GAMEWORLD UPDATED:', event.data);
      printCachedData();
    });

    sdk.on('gameworld.deleted', (event) => {
      console.log('[idle-server] GAMEWORLD DELETED:', event.data);
      printCachedData();
    });

    sdk.on('gameworld.order_changed', (event) => {
      console.log('[idle-server] GAMEWORLD ORDER CHANGED:', event.data);
      printCachedData();
    });

    sdk.on('popup.created', (event) => {
      console.log('[idle-server] POPUP CREATED:', event.data);
      printCachedData();
    });

    sdk.on('popup.updated', (event) => {
      console.log('[idle-server] POPUP UPDATED:', event.data);
      printCachedData();
    });

    sdk.on('popup.deleted', (event) => {
      console.log('[idle-server] POPUP DELETED:', event.data);
      printCachedData();
    });

    sdk.on('survey.created', (event) => {
      console.log('[idle-server] SURVEY CREATED:', event.data);
      printCachedData();
    });

    sdk.on('survey.updated', (event) => {
      console.log('[idle-server] SURVEY UPDATED:', event.data);
      printCachedData();
    });

    sdk.on('survey.deleted', (event) => {
      console.log('[idle-server] SURVEY DELETED:', event.data);
      printCachedData();
    });

    sdk.on('survey.settings.updated', (event) => {
      console.log('[idle-server] SURVEY SETTINGS UPDATED:', event.data);
      printCachedData();
    });

    // Helper function to print cached data
    function printCachedData() {
      console.log('\n========== CACHED DATA (JSON) ==========');

      const surveysData = sdk.getCachedSurveys();
      const cachedData = {
        gameWorlds: sdk.getCachedGameWorlds(),
        popupNotices: sdk.getCachedPopupNotices(),
        surveys: surveysData,
        timestamp: new Date().toISOString(),
      };

      console.log(JSON.stringify(cachedData, null, 2));
      console.log('\n========================================\n');
    }

    console.log('[idle-server] Idle server is running and listening to events...');
    console.log('[idle-server] Press Ctrl+C to stop');

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('[idle-server] Received SIGTERM, shutting down gracefully...');
      await handleShutdown();
    });

    process.on('SIGINT', async () => {
      console.log('[idle-server] Received SIGINT, shutting down gracefully...');
      await handleShutdown();
    });

    async function handleShutdown() {
      try {
        console.log('[idle-server] Unregistering service...');
        await sdk.serviceDiscovery.unregister();
        console.log('[idle-server] Service unregistered');
        process.exit(0);
      } catch (error) {
        console.error('[idle-server] Error during shutdown:', error);
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('[idle-server] Fatal error:', error);
    process.exit(1);
  }
}

main();

