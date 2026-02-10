/**
 * GatrixClient - Main entry point for Gatrix Client SDK
 *
 * Provides access to various Gatrix services:
 * - features: Feature flags
 * - (future) surveys: Surveys
 * - (future) maintenance: Maintenance status
 */
import { EventEmitter } from './EventEmitter';
import { GatrixClientConfig, GatrixSdkStats } from './types';
import { FeaturesClient } from './FeaturesClient';
import { EVENTS } from './events';
import { SDK_VERSION } from './version';
import { GatrixError } from './errors';
import { Logger, ConsoleLogger } from './Logger';

export class GatrixClient {
  private emitter: EventEmitter;
  private config: GatrixClientConfig;
  private featuresClient: FeaturesClient;
  private initialized = false;
  private startPromise: Promise<void> | null = null;
  private logger: Logger;

  /**
   * Feature flags client
   * Access via client.features.isEnabled(), client.features.boolVariation(), etc.
   */
  get features(): FeaturesClient {
    return this.featuresClient;
  }

  constructor(config: GatrixClientConfig) {
    // Validate required config
    if (!config.apiUrl) {
      throw new GatrixError('apiUrl is required');
    }
    if (!config.apiToken) {
      throw new GatrixError('apiToken is required');
    }
    if (!config.appName) {
      throw new GatrixError('appName is required');
    }
    if (!config.environment) {
      throw new GatrixError('environment is required');
    }

    this.config = config;
    this.emitter = new EventEmitter();
    this.logger = config.logger ?? new ConsoleLogger('GatrixClient');
    this.featuresClient = new FeaturesClient(this.emitter, config);
  }

  /**
   * Start the SDK
   * Initializes all services and begins polling for updates
   */
  async start(): Promise<void> {
    if (this.startPromise) {
      return this.startPromise;
    }

    if (this.initialized) {
      return Promise.resolve();
    }

    const connId = this.featuresClient.getConnectionId();
    this.logger.info(`Starting SDK for ${this.config.appName} (v${SDK_VERSION}) [${connId}]`);

    this.startPromise = (async () => {
      try {
        await this.featuresClient.init();
        await this.featuresClient.start();
        this.initialized = true;
      } finally {
        this.startPromise = null;
      }
    })();

    return this.startPromise;
  }

  /**
   * Stop the SDK
   * Stops all polling and cleanup
   */
  stop(): void {
    this.featuresClient.stop();
    this.initialized = false;
    this.startPromise = null;
  }

  /**
   * Check if SDK is ready
   */
  isReady(): boolean {
    return this.featuresClient.isReady();
  }

  /**
   * Get last error
   */
  getError(): unknown {
    return this.featuresClient.getError();
  }

  /**
   * Get SDK statistics (combined from all services)
   */
  getStats(): GatrixSdkStats {
    const featStats = this.featuresClient.getStats();
    return {
      sdkState: featStats.sdkState || (this.getError() ? 'error' : this.isReady() ? 'healthy' : 'initializing'),
      startTime: featStats.startTime || null,
      connectionId: this.featuresClient.getConnectionId(),
      errorCount: featStats.errorCount ?? 0,
      lastError: featStats.lastError ?? this.getError(),
      lastErrorTime: featStats.lastErrorTime || null,
      offlineMode: this.config.offlineMode ?? false,
      features: featStats,
      eventHandlerStats: this.emitter.getHandlerStats(),
    };
  }

  // ==================== Event Subscription ====================

  /**
   * Subscribe to an event
   */
  on(event: string, callback: (...args: any[]) => void, name?: string): this {
    this.emitter.on(event, callback, name);
    return this;
  }

  /**
   * Subscribe to an event once
   */
  once(event: string, callback: (...args: any[]) => void, name?: string): this {
    this.emitter.once(event, callback, name);
    return this;
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, callback?: (...args: any[]) => void): this {
    this.emitter.off(event, callback);
    return this;
  }

  /**
   * Subscribe to ALL events
   * Callback receives (eventName, ...args)
   */
  onAny(callback: (event: string, ...args: any[]) => void, name?: string): this {
    this.emitter.onAny(callback, name);
    return this;
  }

  /**
   * Unsubscribe from ALL events listener
   */
  offAny(callback?: (event: string, ...args: any[]) => void): this {
    this.emitter.offAny(callback);
    return this;
  }

  // ==================== Static Helpers ====================

  /**
   * Get SDK version
   */
  static get version(): string {
    return SDK_VERSION;
  }

  /**
   * Event constants
   */
  static get EVENTS() {
    return EVENTS;
  }
}
