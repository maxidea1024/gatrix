/**
 * Maintenance Watcher Test
 *
 * Simple script to test maintenance.started, maintenance.ended, and maintenance.updated events
 */

import { GatrixServerSDK, getLogger } from '../src/index';

const logger = getLogger('MAINTENANCE-TEST');

async function main() {
  logger.info('Starting Maintenance Watcher Test...');

  const sdk = new GatrixServerSDK({
    gatrixUrl: process.env.GATRIX_URL || 'http://localhost:55000',
    apiToken: process.env.API_TOKEN || 'gatrix-unsecured-server-api-token',
    applicationName: 'maintenance-test',

    // Redis for events
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '56379'),
    },

    // Cache configuration - event method for real-time updates
    cache: {
      enabled: true,
      ttl: 60,
      refreshMethod: 'event', // Use Redis PubSub for real-time updates
    },

    // Logger configuration
    logger: {
      level: 'debug',
      timeOffset: 9,
      timestampFormat: 'local',
    },
  });

  try {
    logger.info('Initializing SDK...');
    await sdk.initialize();
    logger.info('SDK initialized successfully');

    // Listen to local maintenance events (these come from MaintenanceWatcher)
    // Prefixed with 'local.' to distinguish from backend events
    sdk.on('local.maintenance.started', (event) => {
      logger.info('🔴 MAINTENANCE STARTED', {
        source: event.data.source,
        worldId: event.data.worldId,
        timestamp: event.timestamp,
        details: event.data.details,
      });
    });

    sdk.on('local.maintenance.ended', (event) => {
      logger.info('🟢 MAINTENANCE ENDED', {
        source: event.data.source,
        worldId: event.data.worldId,
        timestamp: event.timestamp,
      });
    });

    sdk.on('local.maintenance.updated', (event) => {
      logger.info('🟡 MAINTENANCE UPDATED', {
        source: event.data.source,
        worldId: event.data.worldId,
        timestamp: event.timestamp,
        details: event.data.details,
      });
    });

    // Print current maintenance status (once on startup)
    const serviceStatus = sdk.getServiceMaintenanceStatus();
    const worlds = sdk.getGameWorlds();

    logger.info('Current Status:', {
      service: {
        isUnderMaintenance: serviceStatus?.isUnderMaintenance ?? false,
        startsAt: serviceStatus?.detail?.startsAt,
        endsAt: serviceStatus?.detail?.endsAt,
        message: serviceStatus?.detail?.localeMessages,
        kickExistingPlayers: serviceStatus?.detail?.kickExistingPlayers,
        kickDelayMinutes: serviceStatus?.detail?.kickDelayMinutes,
      },
      worlds: worlds.map(w => ({
        worldId: w.worldId,
        name: w.name,
        isMaintenance: w.isMaintenance,
        startDate: w.maintenanceStartDate,
        endDate: w.maintenanceEndDate,
        message: w.maintenanceMessage,
        forceDisconnect: w.forceDisconnect,
        gracePeriodMinutes: w.gracePeriodMinutes,
      })),
    });

    logger.info('');
    logger.info('='.repeat(60));
    logger.info('Listening for local maintenance events...');
    logger.info('- 🔴 local.maintenance.started: when maintenance begins');
    logger.info('- 🟢 local.maintenance.ended: when maintenance ends');
    logger.info('- 🟡 local.maintenance.updated: when maintenance settings change');
    logger.info('');
    logger.info('Using Redis PubSub for real-time event updates');
    logger.info('');
    logger.info('To test:');
    logger.info('1. Enable/disable service maintenance in admin panel');
    logger.info('2. Enable/disable world maintenance in admin panel');
    logger.info('3. Change maintenance message while active (for updated event)');
    logger.info('4. Set future start time and wait for it');
    logger.info('='.repeat(60));
    logger.info('');
    logger.info('Press Ctrl+C to stop');

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Shutting down...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info('Shutting down...');
      process.exit(0);
    });

  } catch (error) {
    logger.error('Fatal error', { error });
    process.exit(1);
  }
}

main();

