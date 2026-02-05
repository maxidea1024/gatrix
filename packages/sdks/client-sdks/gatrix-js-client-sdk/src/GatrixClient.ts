/**
 * GatrixClient - Main entry point for Gatrix Client SDK
 *
 * Provides access to various Gatrix services:
 * - features: Feature flags
 * - (future) surveys: Surveys
 * - (future) maintenance: Maintenance status
 */
import { EventEmitter } from './EventEmitter';
import { GatrixClientConfig } from './types';
import { FeaturesClient } from './FeaturesClient';
import { EVENTS } from './events';
import { SDK_VERSION } from './version';

export class GatrixClient {
  private emitter: EventEmitter;
  private config: GatrixClientConfig;
  private featuresClient: FeaturesClient;
  private initialized = false;

  /**
   * Feature flags client
   * Access via client.features.isEnabled(), client.features.boolVariation(), etc.
   */
  get features(): FeaturesClient {
    return this.featuresClient;
  }

  constructor(config: GatrixClientConfig) {
    // Validate required config
    if (!config.url) {
      throw new Error('GatrixClient: url is required');
    }
    if (!config.apiKey) {
      throw new Error('GatrixClient: apiKey is required');
    }
    if (!config.appName) {
      throw new Error('GatrixClient: appName is required');
    }

    this.config = config;
    this.emitter = new EventEmitter();
    this.featuresClient = new FeaturesClient(this.emitter, config);

    console.log(`GatrixClient v${SDK_VERSION} created for ${config.appName}`);
  }

  /**
   * Start the SDK
   * Initializes all services and begins polling for updates
   */
  async start(): Promise<void> {
    if (this.initialized) {
      console.warn('GatrixClient already started');
      return;
    }

    await this.featuresClient.init();
    await this.featuresClient.start();
    this.initialized = true;
  }

  /**
   * Stop the SDK
   * Stops all polling and cleanup
   */
  stop(): void {
    this.featuresClient.stop();
    this.initialized = false;
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

  // ==================== Event Subscription ====================

  /**
   * Subscribe to an event
   */
  on(event: string, callback: (...args: any[]) => void): this {
    this.emitter.on(event, callback);
    return this;
  }

  /**
   * Subscribe to an event once
   */
  once(event: string, callback: (...args: any[]) => void): this {
    this.emitter.once(event, callback);
    return this;
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, callback?: (...args: any[]) => void): this {
    this.emitter.off(event, callback);
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
