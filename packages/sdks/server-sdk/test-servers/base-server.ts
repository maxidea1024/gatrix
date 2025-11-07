/**
 * Base Test Server
 * 
 * Common functionality for all test servers
 */

import { GatrixSDK } from '../src/GatrixSDK';
import { ServiceInstance } from '../src/types/api';
import os from 'os';

export interface BaseServerConfig {
  serverType: string;
  serviceGroup: string;
  instanceName: string;
  port: number;
  enableServiceDiscovery?: boolean;
  enableCache?: boolean;
  enableEvents?: boolean;
}

export class BaseTestServer {
  protected sdk: GatrixSDK;
  protected config: BaseServerConfig;
  protected startTime: Date;

  constructor(config: BaseServerConfig) {
    this.config = config;
    this.startTime = new Date();

    // Create SDK instance
    this.sdk = new GatrixSDK({
      gatrixUrl: process.env.GATRIX_URL || 'http://localhost:55000',
      apiToken: process.env.API_TOKEN || '3569268f61a7396e494a10ddc9b08652f583ee06875c91efac56e6b6b5633bf3',
      applicationName: config.serverType,
      
      // Redis for events
      redis: config.enableEvents !== false ? {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      } : undefined,

      // Cache configuration
      cache: {
        enabled: config.enableCache !== false,
        ttl: 300,
        autoRefresh: true,
      },

      // Service discovery configuration (disabled by default for testing)
      serviceDiscovery: config.enableServiceDiscovery === true ? {
        enabled: true,
        mode: 'redis',
        ttlSeconds: 30,
        heartbeatIntervalMs: 10000,
      } : {
        enabled: false,
      },

      // Logger configuration
      logger: {
        level: 'info',
      },
    });

    this.log('Server instance created');
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

    const instanceId = await this.sdk.registerService({
      type: this.config.serverType,
      serviceGroup: this.config.serviceGroup,
      hostname: os.hostname(),
      externalAddress: '0.0.0.0', // Would be actual public IP in production
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
      this.log(`  - ${popup.id}: ${popup.title || 'No title'}`);
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
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.config.instanceName}] ${message}`);
  }

  /**
   * Log error
   */
  protected logError(message: string, error: any): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [${this.config.instanceName}] ERROR: ${message}`, error);
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

