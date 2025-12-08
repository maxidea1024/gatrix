import { GatrixServerSDK, GatrixSDKConfig } from '@gatrix/server-sdk';
import { config } from '../config/env';
import logger from '../config/logger';

/**
 * SDK Manager - Singleton for managing GatrixServerSDK instance
 */
class SDKManager {
  private sdk: GatrixServerSDK | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the SDK
   */
  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    logger.info('Initializing GatrixServerSDK...');

    const sdkConfig: GatrixSDKConfig = {
      gatrixUrl: config.gatrixUrl,
      apiToken: config.apiToken,
      applicationName: config.applicationName,

      // SDK required fields
      service: config.service,
      group: config.group,
      environment: config.environment,

      // Multi-environment mode for Edge
      environments: config.environments,

      // Redis for PubSub (optional)
      redis: config.redis.host ? {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db,
      } : undefined,

      // Cache configuration
      cache: {
        refreshMethod: config.cache.syncMethod,
      },

      // Enable Edge-specific features
      features: {
        // Disable features not needed for Edge
        gameWorld: false,
        popupNotice: false,
        survey: false,
        whitelist: false,
        serviceMaintenance: false,

        // Enable Edge-specific features
        clientVersion: true,
        serviceNotice: true,
        banner: true,
      },
    };

    try {
      this.sdk = new GatrixServerSDK(sdkConfig);
      await this.sdk.initialize();
      logger.info('GatrixServerSDK initialized successfully', {
        environments: config.environments,
        syncMethod: config.cache.syncMethod,
      });
    } catch (error) {
      logger.error('Failed to initialize GatrixServerSDK:', error);
      throw error;
    }
  }

  /**
   * Get the SDK instance
   */
  getSDK(): GatrixServerSDK | null {
    return this.sdk;
  }

  /**
   * Shutdown the SDK
   */
  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.close();
      this.sdk = null;
      this.initPromise = null;
      logger.info('GatrixServerSDK shutdown complete');
    }
  }
}

// Export singleton instance
export const sdkManager = new SDKManager();

