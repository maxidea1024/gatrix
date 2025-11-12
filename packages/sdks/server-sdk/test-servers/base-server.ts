/**
 * Base Test Server
 *
 * Common functionality for all test servers
 */

import { GatrixServerSDK, getLogger } from '../src/index';
import { ServiceInstance, ServiceLabels } from '../src/types/api';
import os from 'os';
import { Logger } from '../src/utils/logger';

export interface BaseServerConfig {
  serviceType: string;
  serviceGroup?: string;
  customLabels?: Record<string, string>;
  instanceName: string;
  port: number;
  enableServiceDiscovery?: boolean;
  enableCache?: boolean;
  enableEvents?: boolean;
}

export class BaseTestServer {
  protected sdk: GatrixServerSDK;
  protected config: BaseServerConfig;
  protected startTime: Date;
  protected logger: Logger;
  private isShuttingDown: boolean = false;

  constructor(config: BaseServerConfig) {
    this.config = config;
    this.startTime = new Date();
    this.logger = getLogger(config.instanceName.toUpperCase());

    // Create SDK instance
    this.sdk = new GatrixServerSDK({
      gatrixUrl: process.env.GATRIX_URL || 'http://localhost:55000',
      apiToken: process.env.API_TOKEN || 'gatrix-unsecured-server-api-token',
      applicationName: config.serviceType,

      // Redis for events
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },

      // Cache configuration
      cache: {
        enabled: config.enableCache !== false,
        ttl: 300,
        refreshMethod: config.enableEvents ? 'event' : 'polling', // 'event' if events enabled, 'polling' otherwise
      },

      // Logger configuration
      logger: {
        level: 'info',
      },
    });

    this.logger.info('Server instance created');

    // Setup global error handlers
    this.setupErrorHandlers();
  }

  /**
   * Setup global error handlers for uncaught exceptions
   * This ensures the service status is updated to 'error' before shutdown
   */
  private setupErrorHandlers(): void {
    process.on('uncaughtException', async (error: Error) => {
      this.logError('Uncaught Exception', error);
      await this.handleFatalError('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', async (reason: any, promise: Promise<any>) => {
      this.logError('Unhandled Rejection', { reason, promise });
      await this.handleFatalError('UNHANDLED_REJECTION');
    });

    // Handle graceful shutdown signals
    process.on('SIGTERM', async () => {
      this.log('Received SIGTERM signal, initiating graceful shutdown...');
      await this.handleGracefulShutdown();
    });

    process.on('SIGINT', async () => {
      this.log('Received SIGINT signal, initiating graceful shutdown...');
      await this.handleGracefulShutdown();
    });
  }

  /**
   * Handle graceful shutdown (SIGTERM/SIGINT)
   * Unregister service and shut down cleanly
   */
  private async handleGracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return; // Prevent multiple shutdown attempts
    }
    this.isShuttingDown = true;

    try {
      this.log('Starting graceful shutdown...');

      // Unregister service if service discovery is enabled
      if (this.config.enableServiceDiscovery) {
        this.log('Unregistering service from discovery...');
        await this.sdk.serviceDiscovery.unregister().catch(err => {
          this.logError('Failed to unregister service', err);
        });
        this.log('Service unregistered successfully');
      }

      // Graceful shutdown
      this.log('Stopping server...');
      await this.stop();
      this.log('Server stopped');
    } catch (shutdownError) {
      this.logError('Error during graceful shutdown', shutdownError);
    } finally {
      this.log('Exiting process');
      process.exit(0);
    }
  }

  /**
   * Handle fatal errors by updating service status to 'error' and shutting down
   */
  private async handleFatalError(errorType: string): Promise<void> {
    if (this.isShuttingDown) {
      return; // Prevent multiple shutdown attempts
    }
    this.isShuttingDown = true;

    try {
      // Update service status to 'error' if service discovery is enabled
      if (this.config.enableServiceDiscovery) {
        await this.sdk.updateServiceStatus({
          status: 'error',
          stats: {
            errorType,
            errorTime: new Date().toISOString(),
          },
        }).catch(err => {
          this.logError('Failed to update service status to error', err);
        });
      }

      // Graceful shutdown
      await this.stop();
    } catch (shutdownError) {
      this.logError('Error during fatal error handling', shutdownError);
    } finally {
      process.exit(1);
    }
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      this.log('Starting server...');

      // Initialize SDK
      await this.sdk.initialize();
      this.log('SDK initialized');

      // Note: Events are disabled for testing, but Redis is still available for service discovery

      // Test service discovery via API
      await this.testServiceDiscoveryAPI();

      // Register to service discovery
      if (this.config.enableServiceDiscovery === true) {
        await this.registerService();
      }

      // Print initial cache state
      await this.printCacheState();

      // Setup event listeners
      if (this.config.enableEvents !== false) {
        this.setupEventListeners();
      }

      // Run server-specific logic
      await this.onStart();

      this.log('Server started successfully');
    } catch (error) {
      this.logError('Failed to start server', error);
      throw error;
    }
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    try {
      this.log('Stopping server...');

      // Run server-specific cleanup
      await this.onStop();

      // Close SDK
      await this.sdk.close();

      this.log('Server stopped');
    } catch (error) {
      this.logError('Error stopping server', error);
    }
  }

  /**
   * Register service to discovery
   */
  protected async registerService(): Promise<void> {
    const networkInterfaces = os.networkInterfaces();
    const internalIp = this.getInternalIp(networkInterfaces);

    // Build labels
    const labels: ServiceLabels = {
      service: this.config.serviceType,
      ...(this.config.serviceGroup && { group: this.config.serviceGroup }),
      ...(this.config.customLabels || {}),
    };

    const instanceId = await this.sdk.registerService({
      labels,
      hostname: os.hostname(),
      internalAddress: internalIp,
      ports: {
        http: [this.config.port],
      },
      status: 'ready',
      meta: {
        instanceName: this.config.instanceName,
        startTime: this.startTime.toISOString(),
      },
    });

    this.log(`Registered to service discovery with ID: ${instanceId}`);
  }

  /**
   * Print current cache state
   */
  protected async printCacheState(): Promise<void> {
    this.log('=== Cache State ===');

    // Game worlds
    const worlds = await this.sdk.getGameWorlds();
    this.log(`Game Worlds: ${worlds.length} loaded`);
    worlds.forEach(world => {
      const maintenance = this.sdk.isWorldInMaintenance(world.worldId);
      this.log(`  - ${world.name} (${world.worldId}) ${maintenance ? '[MAINTENANCE]' : '[ACTIVE]'}`);
    });

    // Popup notices
    const popups = await this.sdk.getPopupNotices();
    this.log(`Popup Notices: ${popups.length} loaded`);
    popups.forEach(popup => {
      const contentPreview = popup.message.substring(0, 50) + (popup.message.length > 50 ? '...' : '');
      this.log(`  - ${popup.id}: ${contentPreview}`);
    });

    // Surveys (may fail if admin auth is required)
    try {
      const surveys = await this.sdk.getSurveys();
      this.log(`Surveys: ${surveys.length} loaded`);
      surveys.forEach(survey => {
        this.log(`  - ${survey.id}: ${survey.surveyTitle || 'No title'}`);
      });
    } catch (error: any) {
      this.log(`Surveys: Not available (${error.message})`);
    }

    this.log('==================');
  }

  /**
   * Setup event listeners
   */
  protected setupEventListeners(): void {
    // Game world events
    this.sdk.on('gameworld.updated', (data) => {
      this.log(`[EVENT] Game world updated: ${JSON.stringify(data)}`);
    });

    this.sdk.on('gameworld.created', (data) => {
      this.log(`[EVENT] Game world created: ${JSON.stringify(data)}`);
    });

    this.sdk.on('gameworld.deleted', (data) => {
      this.log(`[EVENT] Game world deleted: ${JSON.stringify(data)}`);
    });

    // Popup events
    this.sdk.on('popup.updated', (data) => {
      this.log(`[EVENT] Popup updated: ${JSON.stringify(data)}`);
    });

    // Survey events
    this.sdk.on('survey.updated', (data) => {
      this.log(`[EVENT] Survey updated: ${JSON.stringify(data)}`);
    });

    // Custom events
    this.sdk.on('custom.event', (data) => {
      this.log(`[EVENT] Custom event: ${JSON.stringify(data)}`);
    });

    this.log('Event listeners registered');
  }

  /**
   * Get internal IP address
   */
  protected getInternalIp(networkInterfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>): string {
    for (const name of Object.keys(networkInterfaces)) {
      const interfaces = networkInterfaces[name];
      if (!interfaces) continue;

      for (const iface of interfaces) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }

  /**
   * Log message
   */
  protected log(message: string): void {
    this.logger.info(message);
  }

  /**
   * Log error
   */
  protected logError(message: string, error: any): void {
    this.logger.error(message, { error });
  }

  /**
   * Test service discovery via Backend API
   */
  protected async testServiceDiscoveryAPI(): Promise<void> {
    try {
      // Get all services
      const allServices = await this.sdk.getServices();
      this.log(`Service Discovery API: ${allServices.length} total services`);

      // Get services by service type
      const authServices = await this.sdk.getServices({ serviceType: 'authd' });
      this.log(`  - authd: ${authServices.length} instances`);

      const lobbydServices = await this.sdk.getServices({ serviceType: 'lobbyd' });
      this.log(`  - lobbyd: ${lobbydServices.length} instances`);

      const chatdServices = await this.sdk.getServices({ serviceType: 'chatd' });
      this.log(`  - chatd: ${chatdServices.length} instances`);

      const worlddServices = await this.sdk.getServices({ serviceType: 'worldd' });
      this.log(`  - worldd: ${worlddServices.length} instances`);

      // Get services by group
      if (worlddServices.length > 0) {
        const groups = [...new Set(worlddServices.map(s => s.labels.group).filter(Boolean))];
        this.log(`  - worldd groups: ${groups.join(', ')}`);
      }
    } catch (error: any) {
      this.log(`Service Discovery API not available: ${error.message}`);
    }
  }

  /**
   * Server-specific start logic (override in subclasses)
   */
  protected async onStart(): Promise<void> {
    // Override in subclasses
  }

  /**
   * Server-specific stop logic (override in subclasses)
   */
  protected async onStop(): Promise<void> {
    // Override in subclasses
  }
}

