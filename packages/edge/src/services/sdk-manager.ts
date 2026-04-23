import {
  GatrixServerSDK,
  GatrixSDKConfig,
  IEnvironmentProvider,
  EnvironmentEntry,
} from '@gatrix/gatrix-node-server-sdk';
import { config } from '../config/env';
import { createLogger } from '../config/logger';
import { environmentRegistry } from './environment-registry';

const logger = createLogger('SDKManager');

/**
 * EdgeEnvironmentProvider - Generates environment entries from EnvironmentRegistry
 * for SDK's CacheManager multi-environment caching.
 *
 * Each entry maps environmentId to its unsecured token for API authentication.
 * Token format: unsecured-{orgId}:{projectId}:{envId}-server-api-token
 * environmentRegistry is lazily read — returns empty list until initialized.
 */
class EdgeEnvironmentProvider implements IEnvironmentProvider {
  private previousEntries: Map<string, EnvironmentEntry> = new Map();
  private cachedEntries: EnvironmentEntry[] = [];
  private dirty = true;
  private unsubscribeTreeChanged: (() => void) | null = null;

  constructor() {
    // Mark cache as dirty whenever the registry tree changes
    this.unsubscribeTreeChanged = environmentRegistry.onTreeChanged(() => {
      this.dirty = true;
    });
  }

  getEnvironmentTokens(): EnvironmentEntry[] {
    if (!this.dirty) {
      return this.cachedEntries;
    }

    const tree = environmentRegistry.getTree();
    if (tree.length === 0) {
      this.cachedEntries = [];
      this.dirty = false;
      return this.cachedEntries;
    }
    const entries: EnvironmentEntry[] = [];
    for (const org of tree) {
      for (const project of org.projects) {
        for (const env of project.environments) {
          entries.push({
            environmentId: env.id,
            token: `unsecured-${org.id}:${project.id}:${env.id}-server-api-token`,
            projectId: project.id,
            orgId: org.id,
          });
        }
      }
    }
    this.cachedEntries = entries;
    this.dirty = false;
    return this.cachedEntries;
  }

  onEnvironmentsChanged(
    callback: (added: EnvironmentEntry[], removed: EnvironmentEntry[]) => void
  ): () => void {
    return environmentRegistry.onTreeChanged(() => {
      // Invalidate cache first so getEnvironmentTokens rebuilds
      this.dirty = true;
      const currentEntries = new Map(
        this.getEnvironmentTokens().map((e) => [e.environmentId, e])
      );
      const added = [...currentEntries.values()].filter(
        (e) => !this.previousEntries.has(e.environmentId)
      );
      const removed = [...this.previousEntries.values()].filter(
        (e) => !currentEntries.has(e.environmentId)
      );
      this.previousEntries = currentEntries;
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

    const environmentProvider = new EdgeEnvironmentProvider();

    const sdkConfig: GatrixSDKConfig = {
      apiUrl: config.gatrixUrl,
      apiToken: config.apiToken,
      appName: config.appName,
      meta: {
        service: config.meta.service,
        group: config.meta.group,
      },

      // Multi-environment provider
      environmentProvider,

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
        bindAddress: config.metricsBindAddress,
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
        environmentCount: environmentProvider.getEnvironmentTokens().length,
        syncMethod: config.cache.syncMethod,
      });

      // Try to get host IP for internalAddress (bypass overlay network)
      let hostIp: string | undefined;
      try {
        const http = require('http');
        hostIp = await new Promise((resolve) => {
          const req = http.get('http://metadata.tencentyun.com/latest/meta-data/local-ipv4', { timeout: 1000 }, (res: any) => {
            if (res.statusCode !== 200) {
              resolve(undefined);
              return;
            }
            let data = '';
            res.on('data', (c: any) => data += c);
            res.on('end', () => resolve(data.trim()));
          });
          req.on('error', () => resolve(undefined));
          req.on('timeout', () => { req.destroy(); resolve(undefined); });
        });
        if (hostIp) {
          logger.info('Detected Host IP via cloud metadata', { hostIp });
        }
      } catch (err) {
        logger.warn('Failed to detect Host IP', { err });
      }

      // Register Edge service to Service Discovery
      const result = await this.sdk.serviceDiscovery.register({
        internalAddress: hostIp, // Register host IP to bypass VXLAN
        labels: {
          service: 'edge',
          group: config.meta.group,
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
        await this.sdk.serviceDiscovery.unregister();
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
