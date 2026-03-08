import {
  GatrixServerSDK,
  GatrixSDKConfig,
  ITokenProvider,
} from '@gatrix/server-sdk';
import { config } from '../config/env';
import { createLogger } from '../config/logger';
import { environmentRegistry } from './environment-registry';

const logger = createLogger('SDKManager');

/**
 * EdgeTokenProvider - Generates unsecured tokens from EnvironmentRegistry
 * for SDK's CacheManager multi-environment caching.
 *
 * Token format: unsecured-{orgId}:{projectId}:{envId}-server-api-token
 * environmentRegistry is lazily read — returns empty list until initialized.
 */
class EdgeTokenProvider implements ITokenProvider {
  private previousTokens: Set<string> = new Set();

  getTokens(): string[] {
    const tree = environmentRegistry.getTree();
    if (tree.length === 0) {
      return [];
    }
    const tokens: string[] = [];
    for (const org of tree) {
      for (const project of org.projects) {
        for (const env of project.environments) {
          tokens.push(
            `unsecured-${org.id}:${project.id}:${env.id}-server-api-token`
          );
        }
      }
    }
    return tokens;
  }

  onTokensChanged(
    callback: (added: string[], removed: string[]) => void
  ): () => void {
    return environmentRegistry.onTreeChanged(() => {
      const currentTokens = new Set(this.getTokens());
      const added = [...currentTokens].filter(
        (t) => !this.previousTokens.has(t)
      );
      const removed = [...this.previousTokens].filter(
        (t) => !currentTokens.has(t)
      );
      this.previousTokens = currentTokens;
      if (added.length > 0 || removed.length > 0) {
        callback(added, removed);
      }
    });
  }
}

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

    const tokenProvider = new EdgeTokenProvider();

    const sdkConfig: GatrixSDKConfig = {
      apiUrl: config.gatrixUrl,
      apiToken: config.apiToken,
      applicationName: config.applicationName,

      // SDK required fields
      service: config.service,
      group: config.group,

      // Multi-environment token provider
      tokenProvider,

      // Redis for PubSub (optional)
      redis: config.redis.host
        ? {
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            db: config.redis.db,
          }
        : undefined,

      // Cache configuration
      cache: {
        refreshMethod: config.cache.syncMethod,
      },

      // Enable all features for Edge (cache everything)
      uses: {
        gameWorld: true,
        popupNotice: true,
        survey: true,
        whitelist: true,
        serviceMaintenance: true,
        clientVersion: true,
        serviceNotice: true,
        banner: true,
        storeProduct: true,
        featureFlag: true,
        vars: true,
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
      // Use APP_VERSION env var (set via Docker build-arg) or fallback to package.json
      let serverVersion = process.env.APP_VERSION || '0.0.0';
      if (serverVersion === '0.0.0') {
        try {
          const packageJson = require('../../package.json');
          serverVersion = packageJson.version || '0.0.0';
        } catch (err) {
          logger.warn(
            'Failed to load package.json version, using default 0.0.0'
          );
        }
      }

      this.sdk = new GatrixServerSDK(sdkConfig);
      await this.sdk.initialize();
      logger.info('GatrixServerSDK initialized successfully', {
        serverTokenCount: tokenProvider.getTokens().length,
        syncMethod: config.cache.syncMethod,
      });

      // Register Edge service to Service Discovery
      const result = await this.sdk.registerService({
        labels: {
          service: 'edge',
          group: config.group,
          appVersion: serverVersion,
        },
        ports: {
          externalApi: config.port,
          internalApi: config.port + 10,
          metricsApi: config.metricsPort,
        },
        status: 'ready',
        meta: {
          instanceName: 'edge-1',
        },
      });
      logger.info('Edge service registered to Service Discovery via SDK', {
        instanceId: result.instanceId,
        version: serverVersion,
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
