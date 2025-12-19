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

      // Enable all features for Edge (cache everything)
      features: {
        gameWorld: true,
        popupNotice: true,
        survey: true,
        whitelist: true,
        serviceMaintenance: true,
        clientVersion: true,
        serviceNotice: true,
        banner: true,
        storeProduct: true,
      },

      // Enable metrics
      metrics: {
        enabled: true,
        serverEnabled: true,
        port: config.metricsPort,
        userMetricsEnabled: true,
      },
    };

    try {
      this.sdk = new GatrixServerSDK(sdkConfig);
      await this.sdk.initialize();
      logger.info('GatrixServerSDK initialized successfully', {
        environments: config.environments,
        syncMethod: config.cache.syncMethod,
      });

      // Register Edge service to Service Discovery
      const result = await this.sdk.registerService({
        labels: {
          service: 'edge',
          group: config.group,
        },
        ports: {
          externalApi: config.port,
          internalApi: config.port,
          metricsApi: config.metricsPort,
        },
        status: 'ready',
        meta: {
          instanceName: 'edge-1',
        },
      });
      logger.info('Edge service registered to Service Discovery via SDK', {
        instanceId: result.instanceId,
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
      try {
        await this.sdk.unregisterService();
        logger.info('Edge service unregistered from Service Discovery');
      } catch (error) {
        logger.warn('Error unregistering Edge service:', error);
      }
      await this.sdk.close();
      this.sdk = null;
      this.initPromise = null;
      logger.info('GatrixServerSDK shutdown complete');
    }
  }
}

// Export singleton instance
export const sdkManager = new SDKManager();

