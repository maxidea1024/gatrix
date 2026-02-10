/**
 * FeaturesClient - Feature Flags client for Gatrix SDK
 * Handles feature flag fetching, caching, and access
 */
import { EventEmitter } from './EventEmitter';
import { EVENTS } from './events';
import {
  GatrixContext,
  GatrixClientConfig,
  FeaturesConfig,
  EvaluatedFlag,
  Variant,
  FlagsApiResponse,
  ImpressionEvent,
  ErrorEvent,
  SdkState,
  FeaturesStats,
  VariationResult,
} from './types';
import { StorageProvider } from './StorageProvider';
import { LocalStorageProvider } from './LocalStorageProvider';
import { InMemoryStorageProvider } from './InMemoryStorageProvider';
import { uuidv4, resolveAbortController, deepClone, computeContextHash } from './utils';
import { FlagProxy, FlagAccessCallback } from './FlagProxy';
import { WatchFlagGroup } from './WatchFlagGroup';
import { Logger, ConsoleLogger } from './Logger';
import { Metrics } from './Metrics';
import { GatrixError } from './errors';
import { SDK_NAME, SDK_VERSION } from './version';
import ky from 'ky';

const STORAGE_KEY_FLAGS = 'flags';
const STORAGE_KEY_SESSION = 'sessionId';
const STORAGE_KEY_ETAG = 'etag';

// MISSING_VARIANT is now defined in FlagProxy.ts

export class FeaturesClient {
  private emitter: EventEmitter;
  private config: GatrixClientConfig;
  private storage: StorageProvider;
  private createAbortController?: () => AbortController;
  private abortController?: AbortController | null;
  private logger: Logger;

  // Flag storage
  private realtimeFlags: Map<string, EvaluatedFlag> = new Map();
  private synchronizedFlags: Map<string, EvaluatedFlag> = new Map();

  // Context
  private context: GatrixContext = {};

  // State
  private sdkState: SdkState = 'initializing';
  private lastError: unknown = null;
  private started = false;
  private readyEventEmitted = false;
  private fetchedFromServer = false;
  private isFetchingFlags = false;
  private timerRef?: ReturnType<typeof setTimeout>;
  private etag = '';
  private consecutiveFailures: number = 0;
  private pollingStopped: boolean = false;
  private refreshInterval: number;
  private connectionId: string;
  private devMode: boolean;

  // Metrics
  private metrics: Metrics;
  private lastContextHash: string = '';

  // Statistics tracking
  private fetchFlagsCount: number = 0;
  private updateCount: number = 0;
  private notModifiedCount: number = 0;
  private errorCount: number = 0;
  private recoveryCount: number = 0;
  private impressionCount: number = 0;
  private contextChangeCount: number = 0;
  private lastFetchTime: Date | null = null;
  private lastUpdateTime: Date | null = null;
  private lastErrorTime: Date | null = null;
  private lastRecoveryTime: Date | null = null;
  private startTime: Date | null = null;
  private syncFlagsCount: number = 0;
  private metricsSentCount: number = 0;
  private metricsErrorCount: number = 0;
  private watchGroups: Map<string, WatchFlagGroup> = new Map();
  private flagEnabledCounts: Map<string, { yes: number; no: number }> = new Map();
  private flagVariantCounts: Map<string, Map<string, number>> = new Map();
  private flagLastChangedTimes: Map<string, Date> = new Map();

  // System context fields (cannot be removed)
  private static readonly SYSTEM_CONTEXT_FIELDS = ['appName', 'environment'];

  // Feature-specific config shortcuts
  private get featuresConfig() {
    return this.config.features ?? {};
  }

  constructor(emitter: EventEmitter, config: GatrixClientConfig) {
    this.emitter = emitter;
    // Normalize apiUrl - remove trailing slash
    this.config = {
      ...config,
      apiUrl: config.apiUrl.replace(/\/+$/, ''),
    };
    this.connectionId = uuidv4();

    // Initialize storage (pass cacheKeyPrefix to default providers)
    const cachePrefix = config.cacheKeyPrefix ? `${config.cacheKeyPrefix}:` : undefined;
    this.storage =
      config.storageProvider ??
      (typeof window !== 'undefined' ? new LocalStorageProvider(cachePrefix) : new InMemoryStorageProvider());

    // Initialize logger
    this.logger = config.logger ?? new ConsoleLogger('GatrixFeatureClient');

    // Dev mode
    this.devMode = config.enableDevMode ?? false;

    // Initialize abort controller
    this.createAbortController = resolveAbortController();

    // Refresh interval (default: 30 seconds)
    this.refreshInterval = this.featuresConfig.disableRefresh
      ? 0
      : (this.featuresConfig.refreshInterval ?? 30) * 1000;

    // Initial context with system fields
    this.context = {
      appName: config.appName,
      environment: config.environment,
      ...config.context,
    };

    // Initialize metrics
    this.metrics = new Metrics({
      appName: config.appName,
      apiUrl: config.apiUrl,
      apiToken: config.apiToken,
      environment: config.environment,
      customHeaders: config.customHeaders,
      disableMetrics: this.featuresConfig.disableMetrics,
      logger: this.logger,
      connectionId: this.connectionId,
      emitter: this.emitter,
    });

    // Handle metrics events for statistics
    this.emitter.on(EVENTS.FLAGS_METRICS_SENT, () => {
      this.metricsSentCount++;
    });
    this.emitter.on(EVENTS.FLAGS_METRICS_ERROR, () => {
      this.metricsErrorCount++;
    });

    // Bootstrap data
    const bootstrap = this.featuresConfig.bootstrap;
    if (bootstrap && bootstrap.length > 0) {
      this.setFlags(bootstrap);
    }
  }

  /**
   * Get client connection ID
   */
  public getConnectionId(): string {
    return this.connectionId;
  }

  /**
   * Initialize the features client
   */
  async init(): Promise<void> {
    // Resolve session ID
    const sessionId = await this.resolveSessionId();
    this.context.sessionId = sessionId;

    // Load cached etag
    const cachedEtag = await this.storage.get(STORAGE_KEY_ETAG);
    if (cachedEtag) {
      this.etag = cachedEtag;
    }

    // Load cached flags
    const cachedFlags = await this.storage.get(STORAGE_KEY_FLAGS);
    if (cachedFlags && Array.isArray(cachedFlags)) {
      this.setFlags(cachedFlags, true); // Force sync for initial cache load
      // Mark as ready if we have cached flags (provides offline-first experience)
      if (!this.readyEventEmitted && cachedFlags.length > 0) {
        this.setReady();
      }
    }

    // Handle bootstrap
    const bootstrap = this.featuresConfig.bootstrap;
    const hasBootstrap = bootstrap && bootstrap.length > 0;
    const bootstrapOverride = this.featuresConfig.bootstrapOverride !== false;

    this.sdkState = 'healthy';
    this.emitter.emit(EVENTS.FLAGS_INIT);

    if (hasBootstrap && (bootstrapOverride || this.realtimeFlags.size === 0)) {
      await this.storage.save(STORAGE_KEY_FLAGS, bootstrap);
      this.setFlags(bootstrap, true); // Force sync for bootstrap
      this.setReady();
    }
  }

  /**
   * Start polling for flag updates
   */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
    this.startTime = new Date();
    this.consecutiveFailures = 0;
    this.pollingStopped = false;

    this.devLog(`start() called. offlineMode=${this.config.offlineMode}, refreshInterval=${this.refreshInterval}ms, explicitSyncMode=${this.featuresConfig.explicitSyncMode}`);

    // Offline mode: skip all network requests, use cached/bootstrap flags only
    if (this.config.offlineMode) {
      if (this.realtimeFlags.size === 0) {
        const error = new GatrixError(
          'offlineMode requires bootstrap data or cached flags, but none are available'
        );
        this.sdkState = 'error';
        this.lastError = error;
        this.emitter.emit(EVENTS.SDK_ERROR, { type: 'offline_no_data', error });
        throw error;
      }
      this.setReady();
      this.metrics.start();
      return;
    }

    // Initial fetch (scheduleNextRefresh is called inside fetchFlags on completion)
    await this.fetchFlagsInternal('init');

    // Start metrics collection
    this.metrics.start();
  }

  /**
   * Stop polling
   */
  stop(): void {
    this.devLog('stop() called');
    if (this.timerRef) {
      clearTimeout(this.timerRef);
      this.timerRef = undefined;
    }
    this.pollingStopped = true;
    this.consecutiveFailures = 0;
    this.metrics.stop();
    this.started = false;
  }

  /**
   * Check if ready
   */
  isReady(): boolean {
    return this.readyEventEmitted;
  }

  /**
   * Get last error
   */
  getError(): unknown {
    return this.sdkState === 'error' ? this.lastError : undefined;
  }

  // ==================== Context Management ====================

  getContext(): GatrixContext {
    return deepClone(this.context);
  }

  async updateContext(context: GatrixContext): Promise<void> {
    // Filter out system fields from input
    const { appName, environment, ...userContext } = context;
    const newContext = {
      ...this.context,
      ...userContext,
    };

    // Check if context actually changed using hash
    const newHash = await computeContextHash(newContext);
    if (newHash === this.lastContextHash) {
      return; // No change, skip fetch
    }

    this.context = newContext;
    this.lastContextHash = newHash;
    this.contextChangeCount++;
    await this.fetchFlagsInternal('contextChange');
  }

  async setContextField(field: string, value: string | number | boolean): Promise<void> {
    // Prevent modifying system fields
    if (FeaturesClient.SYSTEM_CONTEXT_FIELDS.includes(field)) {
      this.logger.warn(`Cannot modify system context field: ${field}`);
      return;
    }

    const definedFields = ['userId', 'sessionId', 'deviceId', 'currentTime'];

    if (definedFields.includes(field)) {
      (this.context as Record<string, any>)[field] = value;
    } else {
      if (!this.context.properties) {
        this.context.properties = {};
      }
      this.context.properties[field] = value;
    }

    // Check if context actually changed
    const newHash = await computeContextHash(this.context);
    if (newHash === this.lastContextHash) {
      return;
    }
    this.lastContextHash = newHash;
    this.contextChangeCount++;
    await this.fetchFlagsInternal('contextChange');
  }

  async removeContextField(field: string): Promise<void> {
    // Prevent removing system fields
    if (FeaturesClient.SYSTEM_CONTEXT_FIELDS.includes(field)) {
      this.logger.warn(`Cannot remove system context field: ${field}`);
      return;
    }

    const definedFields = ['userId', 'sessionId', 'deviceId', 'currentTime'];

    if (definedFields.includes(field)) {
      delete (this.context as Record<string, any>)[field];
    } else if (this.context.properties) {
      delete this.context.properties[field];
    }

    // Check if context actually changed
    const newHash = await computeContextHash(this.context);
    if (newHash === this.lastContextHash) {
      return;
    }
    this.lastContextHash = newHash;
    this.contextChangeCount++;
    await this.fetchFlagsInternal('contextChange');
  }

  // ==================== Flag Access ====================

  /**
   * Create a FlagProxy for a given flag name, injecting metrics callback.
   * This is the single entry point for all flag access - ensures consistent metrics.
   */
  private createProxy(flagName: string): FlagProxy {
    const flags = this.selectFlags();
    const flag = flags.get(flagName);
    return new FlagProxy(flag, this.handleFlagAccess, flagName);
  }

  /**
   * Metrics callback injected into every FlagProxy.
   * Called on every variation method invocation.
   */
  private handleFlagAccess: FlagAccessCallback = (
    flagName: string,
    flag: EvaluatedFlag | undefined,
    eventType: string,
    variantName?: string
  ): void => {
    if (!flag) {
      this.metrics.countMissing(flagName);
      return;
    }

    this.metrics.count(flagName, flag.enabled);
    if (variantName) {
      this.metrics.countVariant(flagName, variantName);
    }

    this.trackFlagEnabledCount(flagName, flag.enabled);
    if (variantName) {
      this.trackVariantCount(flagName, variantName);
    }

    this.trackImpression(flagName, flag.enabled, flag, eventType as 'isEnabled' | 'getVariant', variantName);
  };

  isEnabled(flagName: string): boolean {
    return this.createProxy(flagName).enabled;
  }

  getVariant(flagName: string): Variant {
    const proxy = this.createProxy(flagName);
    // Access to trigger metrics
    proxy.variation('');
    return { ...proxy.variant };
  }

  getAllFlags(): EvaluatedFlag[] {
    const flags = this.selectFlags();
    return Array.from(flags.values());
  }

  // ==================== Flag Query Methods ====================

  hasFlag(flagName: string): boolean {
    const flags = this.selectFlags();
    return flags.has(flagName);
  }

  // ==================== Variation Methods ====================
  // All delegate to FlagProxy - single source of truth for value extraction.

  variation(flagName: string, missingValue: string): string {
    return this.createProxy(flagName).variation(missingValue);
  }

  boolVariation(flagName: string, missingValue: boolean): boolean {
    return this.createProxy(flagName).boolVariation(missingValue);
  }

  stringVariation(flagName: string, missingValue: string): string {
    return this.createProxy(flagName).stringVariation(missingValue);
  }

  numberVariation(flagName: string, missingValue: number): number {
    return this.createProxy(flagName).numberVariation(missingValue);
  }

  jsonVariation<T>(flagName: string, missingValue: T): T {
    return this.createProxy(flagName).jsonVariation(missingValue);
  }

  // ==================== Strict Variation Methods (OrThrow) ====================

  boolVariationOrThrow(flagName: string): boolean {
    return this.createProxy(flagName).boolVariationOrThrow();
  }

  stringVariationOrThrow(flagName: string): string {
    return this.createProxy(flagName).stringVariationOrThrow();
  }

  numberVariationOrThrow(flagName: string): number {
    return this.createProxy(flagName).numberVariationOrThrow();
  }

  jsonVariationOrThrow<T>(flagName: string): T {
    return this.createProxy(flagName).jsonVariationOrThrow<T>();
  }

  // ==================== Variation Details ====================

  boolVariationDetails(flagName: string, missingValue: boolean): VariationResult<boolean> {
    return this.createProxy(flagName).boolVariationDetails(missingValue);
  }

  stringVariationDetails(flagName: string, missingValue: string): VariationResult<string> {
    return this.createProxy(flagName).stringVariationDetails(missingValue);
  }

  numberVariationDetails(flagName: string, missingValue: number): VariationResult<number> {
    return this.createProxy(flagName).numberVariationDetails(missingValue);
  }

  jsonVariationDetails<T>(flagName: string, missingValue: T): VariationResult<T> {
    return this.createProxy(flagName).jsonVariationDetails(missingValue);
  }

  async syncFlags(fetchNow: boolean = true): Promise<void> {
    if (!this.featuresConfig.explicitSyncMode) {
      return;
    }

    if (fetchNow) {
      await this.fetchFlagsInternal('syncFlags');
    }

    this.synchronizedFlags = new Map(this.realtimeFlags);
    this.syncFlagsCount++;
    this.emitter.emit(EVENTS.FLAGS_SYNC);
  }

  /**
   * Check if explicit sync mode is enabled
   */
  public isExplicitSync(): boolean {
    return !!this.featuresConfig.explicitSyncMode;
  }

  /**
   * Alias for isExplicitSync() to check if syncFlags() can be called
   */
  public canSyncFlags(): boolean {
    if (!this.isExplicitSync()) {
      return false;
    }

    // Compare realtimeFlags and synchronizedFlags
    if (this.realtimeFlags.size !== this.synchronizedFlags.size) {
      return true;
    }

    for (const [name, flag] of this.realtimeFlags) {
      const syncFlag = this.synchronizedFlags.get(name);
      if (!syncFlag || syncFlag.version !== flag.version) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if offline mode is enabled
   */
  public isOfflineMode(): boolean {
    return !!this.config.offlineMode;
  }

  /**
   * Get current features configuration
   */
  public getConfig(): FeaturesConfig {
    return this.featuresConfig;
  }

  /**
   * Check if the client is currently fetching flags from the server
   */
  public isFetching(): boolean {
    return this.isFetchingFlags;
  }

  // ==================== Watch ====================

  /**
   * Watch callback type - supports both sync and async callbacks
   */
  watchFlag(
    flagName: string,
    callback: (flag: FlagProxy) => void | Promise<void>,
    name?: string
  ): () => void {
    const eventName = `flags.${flagName}.change`;
    const wrappedCallback = (rawFlag: EvaluatedFlag | undefined) => {
      callback(new FlagProxy(rawFlag, this.handleFlagAccess, flagName));
    };
    this.emitter.on(eventName, wrappedCallback, name);

    return () => {
      this.emitter.off(eventName, wrappedCallback);
    };
  }

  watchFlagWithInitialState(
    flagName: string,
    callback: (flag: FlagProxy) => void | Promise<void>,
    name?: string
  ): () => void {
    const eventName = `flags.${flagName}.change`;
    const wrappedCallback = (rawFlag: EvaluatedFlag | undefined) => {
      callback(new FlagProxy(rawFlag, this.handleFlagAccess, flagName));
    };
    this.emitter.on(eventName, wrappedCallback, name);

    // Emit initial state
    if (this.readyEventEmitted) {
      const flags = this.selectFlags();
      callback(new FlagProxy(flags.get(flagName), this.handleFlagAccess, flagName));
    } else {
      this.emitter.once(
        EVENTS.FLAGS_READY,
        () => {
          const flags = this.selectFlags();
          callback(new FlagProxy(flags.get(flagName), this.handleFlagAccess, flagName));
        },
        name ? `${name}_initial` : undefined
      );
    }

    return () => {
      this.emitter.off(eventName, wrappedCallback);
    };
  }

  /**
   * Create a watch group for batch management of multiple flag watchers
   */
  createWatchGroup(name: string): WatchFlagGroup {
    const group = new WatchFlagGroup(this, name);
    this.watchGroups.set(name, group);
    return group;
  }

  // ==================== Fetch ====================

  async fetchFlags(): Promise<void> {
    return this.fetchFlagsInternal('manual');
  }

  private async fetchFlagsInternal(caller: 'init' | 'polling' | 'manual' | 'syncFlags' | 'contextChange'): Promise<void> {
    // Offline mode: no network requests allowed
    if (this.config.offlineMode) {
      this.logger.warn('fetchFlags called but client is in offline mode, ignoring');
      return;
    }

    if (this.isFetchingFlags) {
      return;
    }

    this.isFetchingFlags = true;
    this.pollingStopped = false;
    this.logger.info(`fetchFlags [${caller}]: starting fetch. etag=${this.etag}`);
    this.emitter.emit(EVENTS.FLAGS_FETCH_START);

    // Cancel existing polling timer (manual call or re-entry)
    if (this.timerRef) {
      clearTimeout(this.timerRef);
      this.timerRef = undefined;
    }

    // Cancel previous request
    if (this.abortController && !this.abortController.signal.aborted) {
      this.abortController.abort();
    }
    this.abortController = this.createAbortController?.() ?? null;

    try {
      // Update statistics
      this.fetchFlagsCount++;
      this.lastFetchTime = new Date();

      // Build endpoint: {apiUrl}/client/features/{environment}/eval
      const url = new URL(`${this.config.apiUrl}/client/features/${this.config.environment}/eval`);

      // Add context as query params for GET request
      for (const [key, value] of Object.entries(this.context)) {
        if (value === undefined || value === null) continue;

        if (key === 'properties' && typeof value === 'object') {
          for (const [propKey, propValue] of Object.entries(value)) {
            if (propValue !== undefined && propValue !== null) {
              url.searchParams.set(`properties[${propKey}]`, String(propValue));
            }
          }
        } else {
          url.searchParams.set(key, String(value));
        }
      }

      const headers = this.buildHeaders();

      if (this.etag) {
        headers['If-None-Match'] = this.etag;
      }

      // Emit FETCH event with current etag
      this.emitter.emit(EVENTS.FLAGS_FETCH, { etag: this.etag || null });

      // Get retry options from config
      const retryOptions = this.featuresConfig.fetchRetryOptions ?? {};
      const timeout = retryOptions.timeout ?? 30000;
      const nonRetryableStatusCodes = retryOptions.nonRetryableStatusCodes ?? [401, 403];

      // SDK manages retry/backoff, so disable ky's built-in retry
      const response = await ky.get(url.toString(), {
        headers,
        signal: this.abortController?.signal,
        retry: 0,
        timeout,
        throwHttpErrors: false, // Handle status codes manually for ETag support
      });

      // Check for recovery
      if (this.sdkState === 'error' && response.status < 400) {
        this.sdkState = 'healthy';
        this.recoveryCount++;
        this.lastRecoveryTime = new Date();
        this.logger.info(`SDK recovered from error state (recovery #${this.recoveryCount})`);
        this.emitter.emit(EVENTS.FLAGS_RECOVERED);
      }

      if (response.ok) {
        const newEtag = response.headers.get('ETag') ?? '';
        if (newEtag !== this.etag) {
          this.etag = newEtag;
          await this.storage.save(STORAGE_KEY_ETAG, this.etag);
        }

        const data: FlagsApiResponse = await response.json();

        if (data.success && data.data?.flags) {
          const isInitialFetch = !this.fetchedFromServer;
          await this.storeFlags(data.data.flags, isInitialFetch);
          this.updateCount++;
          this.lastUpdateTime = new Date();

          if (!this.fetchedFromServer) {
            this.fetchedFromServer = true;
            this.setReady();
          }
        }

        // Success: reset failure counter and schedule at normal interval
        this.consecutiveFailures = 0;
        this.scheduleNextRefresh();
        this.emitter.emit(EVENTS.FLAGS_FETCH_SUCCESS);
      } else if (response.status === 304) {
        // Not modified - ETag matched
        this.notModifiedCount++;

        if (!this.fetchedFromServer) {
          this.fetchedFromServer = true;
          this.setReady();
        }

        // Success: reset failure counter and schedule at normal interval
        this.consecutiveFailures = 0;
        this.scheduleNextRefresh();
        this.emitter.emit(EVENTS.FLAGS_FETCH_SUCCESS);
      } else if (nonRetryableStatusCodes.includes(response.status)) {
        // Non-retryable error: stop polling entirely
        this.handleFetchError(response.status);
        this.pollingStopped = true;
        this.logger.error(
          `Polling stopped due to non-retryable status code ${response.status}. ` +
          `Call fetchFlags() manually to retry.`
        );
        this.emitter.emit(EVENTS.FLAGS_FETCH_ERROR, {
          status: response.status,
          retryable: false,
        });
      } else {
        // Retryable HTTP error: schedule with backoff
        this.handleFetchError(response.status);
        this.consecutiveFailures++;
        this.emitter.emit(EVENTS.FLAGS_FETCH_ERROR, {
          status: response.status,
          retryable: true,
        });
        this.scheduleNextRefresh();
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        return;
      }

      // Extract meaningful error message
      const errorMessage = this.extractErrorMessage(e);
      this.logger.error('Failed to fetch flags:', errorMessage);

      this.sdkState = 'error';
      this.lastError = e;
      this.errorCount++;
      this.lastErrorTime = new Date();
      this.emitter.emit(EVENTS.SDK_ERROR, {
        type: 'fetch-flags',
        message: errorMessage,
      } as ErrorEvent);
      this.emitter.emit(EVENTS.FLAGS_FETCH_ERROR, { error: e, message: errorMessage });

      // Network error: schedule with backoff
      this.consecutiveFailures++;
      this.scheduleNextRefresh();
    } finally {
      this.isFetchingFlags = false;
      this.abortController = null;
      this.emitter.emit(EVENTS.FLAGS_FETCH_END);
    }
  }

  // ==================== Private Methods ====================

  private setReady(): void {
    this.readyEventEmitted = true;
    this.devLog(`SDK ready. Total flags: ${this.realtimeFlags.size}`);
    this.emitter.emit(EVENTS.FLAGS_READY);
  }

  private scheduleNextRefresh(): void {
    if (this.refreshInterval <= 0 || !this.started || this.pollingStopped) {
      return;
    }

    // Ensure any existing timer is cleared before setting a new one
    if (this.timerRef) {
      clearTimeout(this.timerRef);
    }

    let delay = this.refreshInterval;

    // Apply exponential backoff on consecutive failures
    if (this.consecutiveFailures > 0) {
      const retryOptions = this.featuresConfig.fetchRetryOptions ?? {};
      const initialBackoff = retryOptions.initialBackoffMs ?? 1000;
      const maxBackoff = retryOptions.maxBackoffMs ?? 60000;

      // Exponential backoff: initialBackoff * 2^(failures-1), capped at maxBackoff
      const backoffDelay = Math.min(
        initialBackoff * Math.pow(2, this.consecutiveFailures - 1),
        maxBackoff
      );
      delay = backoffDelay;
      this.logger.warn(
        `Scheduling retry after ${delay}ms (consecutive failures: ${this.consecutiveFailures})`
      );
    }

    this.devLog(`scheduleNextRefresh: delay=${delay}ms, consecutiveFailures=${this.consecutiveFailures}, pollingStopped=${this.pollingStopped}`);

    this.timerRef = setTimeout(async () => {
      await this.fetchFlagsInternal('polling');
    }, delay);
  }

  /**
   * Log detailed debug information only when devMode is enabled
   */
  private devLog(message: string): void {
    if (this.devMode) {
      this.logger.debug(`[DEV] ${message}`);
    }
  }

  private selectFlags(): Map<string, EvaluatedFlag> {
    return this.featuresConfig.explicitSyncMode ? this.synchronizedFlags : this.realtimeFlags;
  }

  private setFlags(flags: EvaluatedFlag[], forceSync: boolean = false): void {
    this.realtimeFlags.clear();
    for (const flag of flags) {
      this.realtimeFlags.set(flag.name, flag);
    }

    this.devLog(`setFlags: ${flags.length} flags loaded, forceSync=${forceSync}`);

    if (!this.featuresConfig.explicitSyncMode || forceSync) {
      this.synchronizedFlags = new Map(this.realtimeFlags);
    }
  }

  /**
   * Store flags with change detection and event emission
   */
  private async storeFlags(flags: EvaluatedFlag[], forceSync: boolean = false): Promise<void> {
    const oldFlags = new Map(this.realtimeFlags);
    this.setFlags(flags, forceSync);
    await this.storage.save(STORAGE_KEY_FLAGS, flags);

    // Emit flag change events
    this.emitRealtimeFlagChanges(oldFlags, this.realtimeFlags);

    this.sdkState = 'healthy';

    // In synchronous mode or if forced, emit change
    if (!this.featuresConfig.explicitSyncMode || forceSync) {
      this.emitter.emit(EVENTS.FLAGS_CHANGE, { flags });
    }
  }

  /**
   * Emit flag change events using version field for comparison.
   * Per-flag change events include changeType: 'created' | 'updated'.
   * Removed flags emit a bulk 'flags.removed' event (not per-flag change).
   */
  private emitRealtimeFlagChanges(
    oldFlags: Map<string, EvaluatedFlag>,
    newFlags: Map<string, EvaluatedFlag>
  ): void {
    // Skip tracking on initial load (oldFlags is empty)
    const isInitialLoad = oldFlags.size === 0;
    const now = new Date();

    // Check for changed/new flags (compare by version)
    for (const [name, newFlag] of newFlags) {
      const oldFlag = oldFlags.get(name);
      if (!oldFlag || oldFlag.version !== newFlag.version) {
        const changeType = oldFlag ? 'updated' : 'created';
        // Only record change time for actual changes, not initial load
        if (!isInitialLoad) {
          this.flagLastChangedTimes.set(name, now);
        }
        this.emitter.emit(`flags.${name}.change`, newFlag, oldFlag, changeType);
      }
    }

    // Check for removed flags - emit bulk event, not per-flag change
    const removedNames: string[] = [];
    for (const [name] of oldFlags) {
      if (!newFlags.has(name)) {
        removedNames.push(name);
        this.flagLastChangedTimes.set(name, now);
      }
    }
    if (removedNames.length > 0) {
      this.emitter.emit(EVENTS.FLAGS_REMOVED, removedNames);
    }
  }

  private handleFetchError(statusCode: number): void {
    this.sdkState = 'error';
    this.lastError = { type: 'HttpError', code: statusCode };
    this.errorCount++;
    this.lastErrorTime = new Date();
    this.emitter.emit(EVENTS.SDK_ERROR, {
      type: 'HttpError',
      code: statusCode,
    } as ErrorEvent);
  }

  private async resolveSessionId(): Promise<string> {
    if (this.context.sessionId) {
      return this.context.sessionId;
    }

    let sessionId = await this.storage.get(STORAGE_KEY_SESSION);
    if (!sessionId) {
      sessionId = String(Math.floor(Math.random() * 1_000_000_000));
      await this.storage.save(STORAGE_KEY_SESSION, sessionId);
    }
    return sessionId;
  }

  private trackImpression(
    flagName: string,
    enabled: boolean,
    flag: EvaluatedFlag | undefined,
    eventType: 'isEnabled' | 'getVariant',
    variantName?: string
  ): void {
    // Only track if impressionDataAll is enabled or flag has impressionData set
    const shouldTrack = this.featuresConfig.impressionDataAll || flag?.impressionData;
    if (!shouldTrack) {
      return;
    }

    const event: ImpressionEvent = {
      eventType,
      eventId: uuidv4(),
      context: this.context,
      enabled,
      featureName: flagName,
      impressionData: flag?.impressionData ?? false,
      variantName,
      reason: flag?.reason,
    };

    this.impressionCount++;
    this.emitter.emit(EVENTS.FLAGS_IMPRESSION, event);
  }

  // ==================== Headers ====================

  /**
   * Build common API headers
   */
  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-Token': this.config.apiToken,
      'X-Application-Name': this.config.appName,
      'X-Environment': this.config.environment,
      'X-Connection-Id': this.connectionId,
      'X-SDK-Version': `${SDK_NAME}/${SDK_VERSION}`,
      ...this.config.customHeaders,
    };
  }

  /**
   * Extract user-friendly error message from error object
   */
  private extractErrorMessage(e: unknown): string {
    if (e instanceof Error) {
      // Check for network errors (ECONNREFUSED, ENOTFOUND, etc.)
      const cause = (e as any).cause;
      if (cause?.code === 'ECONNREFUSED') {
        return 'Connection refused - server may be down';
      }
      if (cause?.code === 'ENOTFOUND') {
        return 'Server not found - check URL';
      }
      if (cause?.code === 'ETIMEDOUT') {
        return 'Connection timed out';
      }
      // Generic fetch error
      if (e.message === 'fetch failed') {
        return 'Network error - unable to reach server';
      }
      return e.message;
    }
    return String(e);
  }

  // ==================== Statistics ====================

  /**
   * Track flag enabled/disabled access count
   */
  private trackFlagEnabledCount(flagName: string, enabled: boolean): void {
    if (this.featuresConfig.disableStats) return;

    const counts = this.flagEnabledCounts.get(flagName) ?? { yes: 0, no: 0 };
    if (enabled) {
      counts.yes++;
    } else {
      counts.no++;
    }
    this.flagEnabledCounts.set(flagName, counts);
  }

  /**
   * Track variant access count
   */
  private trackVariantCount(flagName: string, variantName: string): void {
    if (this.featuresConfig.disableStats) return;

    let variantCounts = this.flagVariantCounts.get(flagName);
    if (!variantCounts) {
      variantCounts = new Map<string, number>();
      this.flagVariantCounts.set(flagName, variantCounts);
    }
    variantCounts.set(variantName, (variantCounts.get(variantName) ?? 0) + 1);
  }

  /**
   * Get feature flag specific statistics
   */
  getStats(): FeaturesStats {
    const flags = this.selectFlags();

    // Convert Map to Record for flagEnabledCounts
    const flagEnabledCounts: Record<string, { yes: number; no: number }> = {};
    for (const [name, counts] of this.flagEnabledCounts) {
      flagEnabledCounts[name] = counts;
    }

    // Convert nested Map to Record for flagVariantCounts
    const flagVariantCounts: Record<string, Record<string, number>> = {};
    for (const [flagName, variantMap] of this.flagVariantCounts) {
      flagVariantCounts[flagName] = {};
      for (const [variantName, count] of variantMap) {
        flagVariantCounts[flagName][variantName] = count;
      }
    }

    // Get active watch group names
    const activeWatchGroups: string[] = [];
    for (const [name, group] of this.watchGroups) {
      if (group.size > 0) {
        activeWatchGroups.push(name);
      }
    }

    return {
      totalFlagCount: flags.size,
      missingFlags: this.metrics.getMissingFlags(),
      fetchFlagsCount: this.fetchFlagsCount,
      updateCount: this.updateCount,
      notModifiedCount: this.notModifiedCount,
      recoveryCount: this.recoveryCount,
      errorCount: this.errorCount,
      sdkState: this.sdkState,
      lastError: this.lastError,
      startTime: this.startTime,
      lastFetchTime: this.lastFetchTime,
      lastUpdateTime: this.lastUpdateTime,
      lastRecoveryTime: this.lastRecoveryTime,
      lastErrorTime: this.lastErrorTime,
      flagEnabledCounts,
      flagVariantCounts,
      syncFlagsCount: this.syncFlagsCount,
      activeWatchGroups,
      etag: this.etag || null,
      impressionCount: this.impressionCount,
      contextChangeCount: this.contextChangeCount,
      flagLastChangedTimes: Object.fromEntries(this.flagLastChangedTimes),
      metricsSentCount: this.metricsSentCount,
      metricsErrorCount: this.metricsErrorCount,
    };
  }
}
